// =============================================================
//  Envío de notificaciones push con Firebase Cloud Messaging (FCM v1)
//  Usa la cuenta de servicio de Firebase guardada en la variable de
//  entorno FIREBASE_SERVICE_ACCOUNT (el .json completo). Nunca subirla a GitHub.
// =============================================================
import crypto from "node:crypto";

export function cuentaServicio() {
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "");
    return sa?.client_email && sa?.private_key && sa?.project_id ? sa : null;
  } catch { return null; }
}

// El permiso para mandar dura 1 hora: se guarda mientras la función siga "despierta"
let cache = { token: null, vence: 0 };
export async function tokenAcceso(sa) {
  if (cache.token && Date.now() < cache.vence - 60_000) return cache.token;
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sinFirma = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600,
  });
  const firma = crypto.sign("RSA-SHA256", Buffer.from(sinFirma), sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${sinFirma}.${firma}` }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error("Firebase no dio permiso: " + (d.error_description || d.error || r.status));
  cache = { token: d.access_token, vence: Date.now() + (d.expires_in || 3600) * 1000 };
  return cache.token;
}

// Manda un aviso "de datos": la app arma la notificación (con su vibración especial)
export async function enviarPush(sa, token, datos) {
  const acceso = await tokenAcceso(sa);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${acceso}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, data: datos, android: { priority: "HIGH", ttl: "86400s" } } }),
  });
  if (r.ok) return { ok: true };
  const t = await r.text();
  return { ok: false, status: r.status, detalle: t.slice(0, 200) };
}
