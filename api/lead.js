import { getDb } from "./_lib/db.js";
import { nextDailyCronDueAt } from "./_lib/sequence-schedule.js";

const CONSENT_VERSION = "2026-09-19-followup-v1";

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

  try {
    const sql = getDb();
    const firstSendAt = nextDailyCronDueAt();
    await sql`
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
    `;

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("Lead capture failed", error);
    return response.status(503).json({ success: false, error: "No pudimos guardar el registro. Probá de nuevo en unos minutos." });
  }
}
