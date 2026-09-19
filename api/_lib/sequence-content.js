import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = new URL("../../emails/seguimiento-lead-magnet.txt", import.meta.url);

export function loadSequence() {
  const source = readFileSync(fileURLToPath(sourcePath), "utf8");
  const sections = source.split(/\r?\n(?=EMAIL [1-6] —)/).filter((section) => /^EMAIL [1-6] —/m.test(section));

  return sections.map((section) => {
    const lines = section.split(/\r?\n/);
    const number = Number(lines[0].match(/^EMAIL (\d)/)?.[1]);
    const subject = lines[1]?.replace(/^Asunto:\s*/, "").trim();
    const preview = lines[2]?.replace(/^Subtexto:\s*/, "").trim();
    const body = lines.slice(4).join("\n").trim();

    if (!number || !subject || !preview || !body) {
      throw new Error(`Invalid email sequence content in section ${number || "unknown"}`);
    }

    return { number, subject, preview, body };
  });
}

export function renderEmailHtml({ name, unsubscribeUrl, sequenceEmail }) {
  const rawName = String(name || "");
  const subject = sequenceEmail.subject.replaceAll("{{nombre}}", rawName);
  const body = sequenceEmail.body
    .replaceAll("{{nombre}}", rawName)
    .replaceAll("https://www.cuidatebien.com/zca", "")
    .replace(/\nEquipo Cuídate Bien\s*/g, "\n")
    .replace(/\nUn saludo,\s*$/, "")
    .trim();
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 18px;line-height:1.7;color:#33483f">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f5f2e9;font-family:Arial,sans-serif;color:#243d34"><span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(sequenceEmail.preview)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2e9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf7;border-radius:16px"><tr><td style="padding:32px 28px 8px"><p style="margin:0 0 24px;color:#b84f35;font-weight:bold;letter-spacing:.04em">Cuídate Bien</p><h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#243d34">${escapeHtml(subject)}</h1>${paragraphs}<p style="margin:28px 0;text-align:center"><a href="https://www.cuidatebien.com/zca" style="display:inline-block;padding:15px 24px;background:#b84f35;color:#fff;text-decoration:none;font-weight:bold;border-radius:8px">Conocer el Sistema ZCA</a></p><p style="margin:0 0 28px;line-height:1.7;color:#33483f">Un saludo,<br>Equipo Cuídate Bien</p></td></tr><tr><td style="padding:20px 28px;background:#eef0e7;border-radius:0 0 16px 16px;font-size:12px;line-height:1.6;color:#53655d">Recibís este correo porque te registraste voluntariamente al diagnóstico y aceptaste recibir novedades relacionadas.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#33483f">Darte de baja de estos correos</a> · <a href="mailto:soporte@cuidatebien.com" style="color:#33483f">soporte@cuidatebien.com</a></td></tr></table></td></tr></table></body></html>`;
}

export function renderEmailText({ name, unsubscribeUrl, sequenceEmail }) {
  const body = sequenceEmail.body
    .replaceAll("{{nombre}}", name || "")
    .replaceAll("https://www.cuidatebien.com/zca", "")
    .trim();

  return `${body}\n\nConocer el Sistema de Zonificación Creativa con Mascota™: https://www.cuidatebien.com/zca\n\nDarte de baja: ${unsubscribeUrl}\nSoporte: soporte@cuidatebien.com`;
}

export function renderUnsubscribePage(token) {
  const safeToken = encodeURIComponent(token);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferencias de correo — Cuídate Bien</title><body style="margin:0;background:#f5f2e9;font-family:Arial,sans-serif;color:#243d34;min-height:100vh;display:grid;place-items:center"><main style="max-width:520px;margin:24px;padding:32px;background:#fffdf7;border-radius:16px"><p style="color:#b84f35;font-weight:bold">Cuídate Bien</p><h1 style="font-size:26px">¿Querés dejar de recibir estos correos?</h1><p style="line-height:1.7">Podés darte de baja de los mensajes de seguimiento del diagnóstico. Esto no cambia ninguna compra que hayas realizado.</p><form method="post" action="/api/unsubscribe?token=${safeToken}"><button style="padding:14px 20px;background:#b84f35;color:#fff;border:0;border-radius:8px;font-weight:bold;font-size:16px">Confirmar baja</button></form></main></body></html>`;
}

export function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
