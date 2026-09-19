import { randomUUID, timingSafeEqual } from "node:crypto";
import { getDb } from "./_lib/db.js";
import { loadSequence, renderEmailHtml, renderEmailText } from "./_lib/sequence-content.js";
import { buildSequenceIdempotencyKey, nextDailyCronDueAt } from "./_lib/sequence-schedule.js";

const SITE_URL = (process.env.ZCA_LEAD_SITE_URL || "https://cuidatebien.com").replace(/\/$/, "");
const MAX_BATCH = 20;

function matchesSecret(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ success: false, error: "Método no permitido" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return response.status(503).json({ success: false, error: "CRON_SECRET no está configurado" });
  if (!matchesSecret(request.headers.authorization?.replace(/^Bearer\s+/i, ""), cronSecret)) {
    return response.status(401).json({ success: false, error: "No autorizado" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return response.status(503).json({ success: false, error: "Faltan las variables de Resend" });
  }

  try {
    const sql = getDb();
    const sequence = loadSequence();
    if (sequence.length !== 6) throw new Error("The recovery sequence must contain exactly six emails");

    const claimId = randomUUID();
    const dueLeads = await sql`
      WITH due AS (
        SELECT id, sequence_generation
        FROM zca_leads
        WHERE unsubscribed_at IS NULL
          AND completed_at IS NULL
          AND paused_at IS NULL
          AND next_send_at <= now()
          AND (claim_until IS NULL OR claim_until < now())
        ORDER BY next_send_at ASC
        LIMIT ${MAX_BATCH}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE zca_leads AS lead
      SET claim_id = ${claimId}::uuid,
          claim_until = now() + interval '15 minutes',
          updated_at = now()
      FROM due
      WHERE lead.id = due.id
        AND lead.sequence_generation = due.sequence_generation
      RETURNING lead.id, lead.name, lead.email, lead.unsubscribe_token,
                lead.sequence_generation, lead.next_email_number
    `;

    const counts = { sent: 0, reconciled: 0, failed: 0, paused: 0, skipped: 0 };
    for (const lead of dueLeads) {
      const step = Number(lead.next_email_number);
      const generation = Number(lead.sequence_generation);
      const emailContent = sequence[step - 1];
      if (!emailContent) {
        counts.skipped += 1;
        await clearClaim(sql, lead.id, generation, claimId);
        continue;
      }

      const idempotencyKey = buildSequenceIdempotencyKey(lead.id, generation, step);
      const existing = await sql`
        SELECT status, attempt_started_at, sent_at
        FROM zca_email_sends
        WHERE lead_id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND sequence_step = ${step}
        LIMIT 1
      `;
      const prior = existing[0];

      if (prior?.status === "sent") {
        await advanceLeadAfterSent(sql, lead.id, generation, claimId, step, prior.sent_at);
        counts.reconciled += 1;
        continue;
      }

      if (prior?.status === "unknown") {
        await pauseLead(sql, lead.id, generation, claimId, "send_result_unknown");
        counts.paused += 1;
        continue;
      }

      if (prior?.status === "sending") {
        const stale = await sql`
          SELECT ${prior.attempt_started_at}::timestamptz < now() - interval '20 hours' AS is_stale
        `;
        if (stale[0]?.is_stale) {
          await sql`
            UPDATE zca_email_sends
            SET status = 'unknown', last_error = 'Previous send outcome could not be confirmed', updated_at = now()
            WHERE lead_id = ${lead.id}::uuid
              AND sequence_generation = ${generation}
              AND sequence_step = ${step}
              AND status = 'sending'
          `;
          await pauseLead(sql, lead.id, generation, claimId, "send_result_unknown");
          counts.paused += 1;
        } else {
          await clearClaim(sql, lead.id, generation, claimId);
          counts.skipped += 1;
        }
        continue;
      }

      if (prior?.status === "failed") {
        await sql`
          UPDATE zca_email_sends
          SET status = 'sending', attempt_started_at = now(), attempt_count = attempt_count + 1,
              last_error = NULL, updated_at = now()
          WHERE lead_id = ${lead.id}::uuid
            AND sequence_generation = ${generation}
            AND sequence_step = ${step}
            AND status = 'failed'
        `;
      } else {
        const created = await sql`
          INSERT INTO zca_email_sends (
            lead_id, sequence_generation, sequence_step, status, idempotency_key
          )
          VALUES (${lead.id}::uuid, ${generation}, ${step}, 'sending', ${idempotencyKey})
          ON CONFLICT (lead_id, sequence_generation, sequence_step) DO NOTHING
          RETURNING id
        `;
        if (!created.length) {
          await clearClaim(sql, lead.id, generation, claimId);
          counts.skipped += 1;
          continue;
        }
      }

      const stillEligible = await sql`
        SELECT id
        FROM zca_leads
        WHERE id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND claim_id = ${claimId}::uuid
          AND unsubscribed_at IS NULL
          AND paused_at IS NULL
      `;
      if (!stillEligible.length) {
        await clearClaim(sql, lead.id, generation, claimId);
        counts.skipped += 1;
        continue;
      }

      const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(lead.unsubscribe_token)}`;
      const personalized = {
        name: lead.name,
        unsubscribeUrl,
        sequenceEmail: emailContent,
      };
      const resendPayload = {
        from: `Cuídate Bien <${fromEmail}>`,
        to: [lead.email],
        subject: emailContent.subject.replaceAll("{{nombre}}", lead.name || ""),
        text: renderEmailText(personalized),
        html: renderEmailHtml(personalized),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };

      let resendResponse;
      try {
        resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(resendPayload),
        });
      } catch (error) {
        console.error("Resend request outcome unknown", { leadId: lead.id, step, message: error?.message });
        await sql`
          UPDATE zca_email_sends
          SET status = 'unknown', last_error = 'Network outcome unknown; manual review required', updated_at = now()
          WHERE lead_id = ${lead.id}::uuid
            AND sequence_generation = ${generation}
            AND sequence_step = ${step}
        `;
        await pauseLead(sql, lead.id, generation, claimId, "send_result_unknown");
        counts.paused += 1;
        continue;
      }

      const responseBody = await resendResponse.json().catch(() => ({}));
      const resendResult = responseBody && typeof responseBody === "object" ? responseBody : {};

      if (!resendResponse.ok) {
        await sql`
          UPDATE zca_email_sends
          SET status = 'failed', last_error = ${String(resendResult.message || `Resend HTTP ${resendResponse.status}`).slice(0, 500)}, updated_at = now()
          WHERE lead_id = ${lead.id}::uuid
            AND sequence_generation = ${generation}
            AND sequence_step = ${step}
        `;
        await clearClaim(sql, lead.id, generation, claimId);
        counts.failed += 1;
        continue;
      }

      const sentRows = await sql`
        UPDATE zca_email_sends
        SET status = 'sent', resend_email_id = ${resendResult.id || null}, sent_at = now(), updated_at = now()
        WHERE lead_id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND sequence_step = ${step}
          AND status = 'sending'
        RETURNING sent_at
      `;
      if (!sentRows.length) throw new Error("The confirmed send could not be marked as sent");

      await advanceLeadAfterSent(sql, lead.id, generation, claimId, step, sentRows[0].sent_at);
      counts.sent += 1;
    }

    return response.status(200).json({ success: true, processed: dueLeads.length, ...counts });
  } catch (error) {
    console.error("Lead recovery cron failed", error);
    return response.status(503).json({ success: false, error: "No se pudo procesar la secuencia" });
  }
}

async function clearClaim(sql, leadId, generation, claimId) {
  await sql`
    UPDATE zca_leads
    SET claim_id = NULL, claim_until = NULL, updated_at = now()
    WHERE id = ${leadId}::uuid
      AND sequence_generation = ${generation}
      AND claim_id = ${claimId}::uuid
  `;
}

async function advanceLeadAfterSent(sql, leadId, generation, claimId, step, sentAt = null) {
  const nextSendAt = nextDailyCronDueAt(sentAt || new Date());
  await sql`
    UPDATE zca_leads
    SET next_email_number = CASE WHEN ${step} < 6 THEN ${step + 1} ELSE 6 END,
        next_send_at = CASE
          WHEN unsubscribed_at IS NOT NULL OR ${step} = 6 THEN NULL
          ELSE ${nextSendAt.toISOString()}::timestamptz
        END,
        completed_at = CASE WHEN ${step} = 6 THEN COALESCE(${sentAt}::timestamptz, now()) ELSE completed_at END,
        last_sent_at = COALESCE(${sentAt}::timestamptz, now()),
        claim_id = NULL, claim_until = NULL, updated_at = now()
    WHERE id = ${leadId}::uuid
      AND sequence_generation = ${generation}
      AND claim_id = ${claimId}::uuid
      AND next_email_number = ${step}
  `;
}

async function pauseLead(sql, leadId, generation, claimId, reason) {
  await sql`
    UPDATE zca_leads
    SET paused_at = now(), pause_reason = ${reason}, next_send_at = NULL,
        claim_id = NULL, claim_until = NULL, updated_at = now()
    WHERE id = ${leadId}::uuid
      AND sequence_generation = ${generation}
      AND claim_id = ${claimId}::uuid
  `;
}
