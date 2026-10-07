// /api/config — le pasa a la app los datos PÚBLICOS de Supabase
// (la "anon key" está pensada para estar en el navegador; la seguridad la dan las reglas de la base)
import { SUPABASE_URL, SUPABASE_ANON_KEY, LIMITE_DIARIO } from "./_comun.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(404).json({ error: "Supabase no configurado: la app arranca en modo demo" });
  res.status(200).json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY, limiteGemini: LIMITE_DIARIO });
}
