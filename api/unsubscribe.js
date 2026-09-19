import { getDb } from "./_lib/db.js";
import { escapeHtml, renderUnsubscribePage } from "./_lib/sequence-content.js";

export default async function handler(request, response) {
  const token = typeof request.query?.token === "string" ? request.query.token : "";
  if (!token) return response.status(400).send("Enlace de baja inválido.");

  if (request.method === "GET") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).send(renderUnsubscribePage(token));
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).send("Método no permitido.");
  }

  try {
    const sql = getDb();
    const result = await sql`
      UPDATE zca_leads
      SET unsubscribed_at = COALESCE(unsubscribed_at, now()),
          next_send_at = NULL,
          claim_id = NULL,
          claim_until = NULL,
          updated_at = now()
      WHERE unsubscribe_token = ${token}::uuid
      RETURNING id
    `;

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    const message = result.length
      ? "Listo, ya no vas a recibir esta secuencia de correos."
      : "No encontramos una suscripción activa para este enlace.";
    return response.status(result.length ? 200 : 404).send(
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferencias de correo</title><body style="margin:0;background:#f5f2e9;font-family:Arial,sans-serif;color:#243d34;min-height:100vh;display:grid;place-items:center"><main style="max-width:520px;margin:24px;padding:32px;background:#fffdf7;border-radius:16px"><p style="color:#b84f35;font-weight:bold">Cuídate Bien</p><h1>${escapeHtml(message)}</h1><p>Gracias por avisarnos.</p></main></body></html>`,
    );
  } catch (error) {
    console.error("Unsubscribe failed", error);
    return response.status(503).send("No pudimos procesar la baja. Probá de nuevo más tarde.");
  }
}
