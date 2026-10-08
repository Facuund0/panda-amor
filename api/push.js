// =============================================================
//  /api/push — lo llama la base de datos (trigger avisar_push en schema.sql)
//  cuando hay un evento importante, para avisarle a la otra persona.
//  Recibe { tokens: [...], titulo, texto, tipo } y manda la push a cada celular.
//  No devuelve datos: sin conocer un token (son secretos) no sirve para nada.
// =============================================================
import { cuerpo } from "./_comun.js";
import { cuentaServicio, enviarPush } from "./_push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  const sa = cuentaServicio();
  if (!sa) return res.status(503).json({ error: "Falta FIREBASE_SERVICE_ACCOUNT en Vercel" });
  const b = cuerpo(req);
  const tokens = (Array.isArray(b.tokens) ? b.tokens : []).filter((t) => typeof t === "string" && t.length > 20).slice(0, 4);
  if (!tokens.length) return res.status(400).json({ error: "Sin destinatarios" });
  const datos = {
    titulo: String(b.titulo || "Nuestro Panda 🐼").slice(0, 120),
    texto: String(b.texto || "").slice(0, 300),
    tipo: String(b.tipo || "general").slice(0, 30),
  };
  // "demora" (solo para la prueba): espera hasta 15 s antes de mandar, para que cierres la app
  const demora = Math.min(15, Math.max(0, Number(b.demora) || 0));
  if (demora) await new Promise((r) => setTimeout(r, demora * 1000));
  const resultados = await Promise.all(tokens.map((t) => enviarPush(sa, t, datos).catch((e) => ({ ok: false, detalle: String(e.message || e) }))));
  res.status(200).json({ enviados: resultados.filter((r) => r.ok).length, de: tokens.length });
}
