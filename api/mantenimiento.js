// =============================================================
//  /api/mantenimiento — lo ejecuta Vercel una vez por día (vercel.json → crons)
//   · Limpia datos viejos para que la base gratis no se llene.
//   · Mantiene "despierto" el proyecto de Supabase (el plan gratis
//     se pausa si pasa 1 semana sin uso).
// =============================================================
import { rpc, SUPABASE_URL } from "./_comun.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) return res.status(401).json({ error: "No autorizado" });
  if (!SUPABASE_URL) return res.status(503).json({ error: "Falta SUPABASE_URL" });
  try {
    const r = await rpc(null, "mantenimiento");
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
