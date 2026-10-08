// /api/config — le pasa a la app los datos PÚBLICOS de Supabase
// (la "anon key" está pensada para estar en el navegador; la seguridad la dan las reglas de la base)
import { SUPABASE_URL, SUPABASE_ANON_KEY, LIMITE_DIARIO } from "./_comun.js";

// Versión de la web publicada: si cambia, la app se recarga sola (ver vigilarVersion en app.js)
const VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // push: si Vercel tiene la cuenta de Firebase (la app usa esto para no repetir avisos)
  const push = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  if (req.query?.solo === "version") return res.status(200).json({ version: VERSION, push });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(404).json({ error: "Supabase no configurado: la app arranca en modo demo" });
  res.status(200).json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY, limiteGemini: LIMITE_DIARIO, version: VERSION, push });
}
