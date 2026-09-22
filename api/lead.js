import { getDb } from "./_lib/db.js";
import { loadSequence, renderEmailHtml, renderEmailText } from "./_lib/sequence-content.js";
import {
  buildSequenceIdempotencyKey,
  firstEmailScheduledAt,
  nextEmailDueAt,
} from "./_lib/sequence-schedule.js";

const CONSENT_VERSION = "2026-09-19-followup-v1";
const SITE_URL = (process.env.ZCA_LEAD_SITE_URL || "https://cuidatebien.com").replace(/\/$/, "");

export default async function handler(request, response) {
  response.setHeader("Allow", "POST");

  if (request.method !== "POST") {
    return response.status(405).json({ success: false, error: "Método no permitido" });
  }

  const { name, email, consent, consentVersion, website } = request.body ?? {};

  // Honeypot: return a successful response without storing or sending to bots.
  if (typeof website === "string" && website.trim() !== "") {
    return response.status(200).json({ success: true });
  }

  const normalizedName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  if (normalizedName.length < 2 || !validEmail || consent !== true || consentVersion !== CONSENT_VERSION) {
    return response.status(400).json({
      success: false,
      error: "Revisá tu nombre, tu email y la autorización para recibir estos correos.",
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return response.status(503).json({ success: false, error: "El servicio de correo no está configurado." });
  }

  try {
    const sql = getDb();
    const firstSendAt = firstEmailScheduledAt();
    const leads = await sql`
      INSERT INTO zca_leads (
        name, email, consent_at, consent_version, consent_source,
        sequence_generation, next_email_number, next_send_at
      ) VALUES (
        ${normalizedName}, ${normalizedEmail}, now(), ${CONSENT_VERSION},
        '/lead-magnet', 1, 1, ${firstSendAt.toISOString()}::timestamptz
      )
      ON CONFLICT (lower(email)) DO UPDATE SET
        name = EXCLUDED.name,
        consent_at = EXCLUDED.consent_at,
        consent_version = EXCLUDED.consent_version,
        consent_source = EXCLUDED.consent_source,
        unsubscribed_at = NULL,
        unsubscribe_token = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN gen_random_uuid()
          ELSE zca_leads.unsubscribe_token
        END,
        sequence_generation = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN zca_leads.sequence_generation + 1
          ELSE zca_leads.sequence_generation
        END,
        next_email_number = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN 1
          ELSE zca_leads.next_email_number
        END,
        next_send_at = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN ${firstSendAt.toISOString()}::timestamptz
          ELSE zca_leads.next_send_at
        END,
        last_sent_at = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.last_sent_at
        END,
        completed_at = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.completed_at
        END,
        paused_at = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.paused_at
        END,
        pause_reason = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.pause_reason
        END,
        claim_id = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.claim_id
        END,
        claim_until = CASE
          WHEN zca_leads.unsubscribed_at IS NOT NULL THEN NULL
          ELSE zca_leads.claim_until
        END,
        updated_at = now()
      RETURNING id, name, email, unsubscribe_token, sequence_generation,
                next_email_number, next_send_at, unsubscribed_at, paused_at
    `;

    const lead = leads[0];
    if (!lead || Number(lead.next_email_number) !== 1 || lead.unsubscribed_at || lead.paused_at) {
      return response.status(200).json({ success: true, firstEmailScheduled: false });
    }

    const generation = Number(lead.sequence_generation);
    const step = 1;
    const scheduledFirstEmailAt = new Date(lead.next_send_at);
    if (Number.isNaN(scheduledFirstEmailAt.getTime())) {
      throw new Error("The first email does not have a valid scheduled time");
    }
    const idempotencyKey = buildSequenceIdempotencyKey(lead.id, generation, step);
    const existingRows = await sql`
      SELECT status, sent_at
      FROM zca_email_sends
      WHERE lead_id = ${lead.id}::uuid
        AND sequence_generation = ${generation}
        AND sequence_step = ${step}
      LIMIT 1
    `;
    const existing = existingRows[0];

    if (existing?.status === "sent") {
      await advanceToSecondEmail(sql, lead.id, generation, existing.sent_at || scheduledFirstEmailAt);
      return response.status(200).json({ success: true, firstEmailScheduled: true });
    }

    if (existing?.status === "unknown") {
      return response.status(503).json({
        success: false,
        error: "Guardamos tu registro, pero no pudimos confirmar la programación del correo. Contactá a soporte.",
      });
    }

    if (existing?.status === "failed") {
      await sql`
        UPDATE zca_email_sends
        SET status = 'sending', attempt_started_at = now(), attempt_count = attempt_count + 1,
            last_error = NULL, updated_at = now()
        WHERE lead_id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND sequence_step = ${step}
          AND status = 'failed'
      `;
    } else if (!existing) {
      await sql`
        INSERT INTO zca_email_sends (
          lead_id, sequence_generation, sequence_step, status, idempotency_key
        ) VALUES (${lead.id}::uuid, ${generation}, ${step}, 'sending', ${idempotencyKey})
        ON CONFLICT (lead_id, sequence_generation, sequence_step) DO NOTHING
      `;
    }

    const eligibleRows = await sql`
      SELECT id
      FROM zca_leads
      WHERE id = ${lead.id}::uuid
        AND sequence_generation = ${generation}
        AND next_email_number = 1
        AND unsubscribed_at IS NULL
        AND paused_at IS NULL
    `;
    if (!eligibleRows.length) {
      return response.status(200).json({ success: true, firstEmailScheduled: false });
    }

    const sequence = loadSequence();
    if (sequence.length !== 6) throw new Error("The recovery sequence must contain exactly six emails");
    const emailContent = sequence[0];
    const unsubscribeUrl = `${SITE_URL}/lead-magnet/api/unsubscribe?token=${encodeURIComponent(lead.unsubscribe_token)}`;
    const personalized = { name: lead.name, unsubscribeUrl, sequenceEmail: emailContent };

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: `Cuídate Bien <${fromEmail}>`,
          to: [lead.email],
          subject: emailContent.subject.replaceAll("{{nombre}}", lead.name || ""),
          text: renderEmailText(personalized),
          html: renderEmailHtml(personalized),
          scheduled_at: scheduledFirstEmailAt.toISOString(),
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
    } catch (error) {
      console.error("Initial Resend request outcome unknown", { leadId: lead.id, message: error?.message });
      await sql`
        UPDATE zca_email_sends
        SET status = 'unknown', last_error = 'Network outcome unknown; manual review required', updated_at = now()
        WHERE lead_id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND sequence_step = 1
      `;
      await sql`
        UPDATE zca_leads
        SET paused_at = now(), pause_reason = 'send_result_unknown', next_send_at = NULL, updated_at = now()
        WHERE id = ${lead.id}::uuid AND sequence_generation = ${generation}
      `;
      return response.status(503).json({
        success: false,
        error: "Guardamos tu registro, pero no pudimos confirmar la programación del correo. Contactá a soporte.",
      });
    }

    const responseBody = await resendResponse.json().catch(() => ({}));
    const resendResult = responseBody && typeof responseBody === "object" ? responseBody : {};
    if (!resendResponse.ok) {
      const resendError = String(resendResult.message || `Resend HTTP ${resendResponse.status}`).slice(0, 500);
      await sql`
        UPDATE zca_email_sends
        SET status = 'failed', last_error = ${resendError}, updated_at = now()
        WHERE lead_id = ${lead.id}::uuid
          AND sequence_generation = ${generation}
          AND sequence_step = 1
      `;
      return response.status(503).json({
        success: false,
        error: "Guardamos tu registro, pero no pudimos programar el primer correo. Probá nuevamente en unos minutos.",
      });
    }

    await sql`
      UPDATE zca_email_sends
      SET status = 'sent', resend_email_id = ${resendResult.id || null},
          sent_at = ${scheduledFirstEmailAt.toISOString()}::timestamptz, updated_at = now()
      WHERE lead_id = ${lead.id}::uuid
        AND sequence_generation = ${generation}
        AND sequence_step = 1
        AND status = 'sending'
    `;
    await advanceToSecondEmail(sql, lead.id, generation, scheduledFirstEmailAt);

    return response.status(200).json({ success: true, firstEmailScheduled: true });
  } catch (error) {
    console.error("Lead capture failed", error);
    return response.status(503).json({ success: false, error: "No pudimos guardar el registro. Probá de nuevo en unos minutos." });
  }
}

async function advanceToSecondEmail(sql, leadId, generation, firstEmailAt) {
  const nextSendAt = nextEmailDueAt(firstEmailAt);
  await sql`
    UPDATE zca_leads
    SET next_email_number = 2,
        next_send_at = ${nextSendAt.toISOString()}::timestamptz,
        last_sent_at = ${new Date(firstEmailAt).toISOString()}::timestamptz,
        updated_at = now()
    WHERE id = ${leadId}::uuid
      AND sequence_generation = ${generation}
      AND next_email_number = 1
      AND unsubscribed_at IS NULL
      AND paused_at IS NULL
  `;
}
