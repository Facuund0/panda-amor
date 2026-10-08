// =============================================================
//  /api/estado — DIAGNÓSTICO: abrilo en el navegador para ver si
//  todo está bien configurado (no muestra ninguna clave).
// =============================================================
import { rpc, gemini, keyGemini, SUPABASE_URL, SUPABASE_ANON_KEY, LIMITE_DIARIO, MODELOS } from "./_comun.js";
import { cuentaServicio, tokenAcceso } from "./_push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const out = {
    supabase: { url: !!SUPABASE_URL, anonKey: !!SUPABASE_ANON_KEY, conexion: null },
    gemini: { limiteDiarioPorPersona: LIMITE_DIARIO, modelos: MODELOS, persona1: null, persona2: null },
  };
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try { await rpc(null, "ping"); out.supabase.conexion = "OK"; }
    catch (e) { out.supabase.conexion = "ERROR: " + e.message + " (¿ejecutaste supabase/schema.sql?)"; }
  }
  for (const lugar of [1, 2]) {
    const key = keyGemini(lugar);
    if (!key) { out.gemini["persona" + lugar] = `falta GEMINI_KEY_${lugar}`; continue; }
    if (req.query?.probar !== "1") { out.gemini["persona" + lugar] = "key cargada (agregá ?probar=1 para probarla, gasta 1 consulta)"; continue; }
    const r = await gemini(key, {
      sistema: "Respondé en JSON.",
      contents: [{ role: "user", parts: [{ text: "Decí hola en una palabra." }] }],
      esquema: { type: "OBJECT", properties: { texto: { type: "STRING" } }, required: ["texto"] },
      maxTokens: 20,
    });
    out.gemini["persona" + lugar] = r.ok ? `OK (${r.modelo})` : { error: r.errores };
  }
  // Notificaciones push (Firebase)
  const sa = cuentaServicio();
  if (!sa) out.push = process.env.FIREBASE_SERVICE_ACCOUNT ? "ERROR: FIREBASE_SERVICE_ACCOUNT no es un JSON válido (pegá el archivo completo)" : "falta FIREBASE_SERVICE_ACCOUNT";
  else if (req.query?.probar !== "1") out.push = `cuenta cargada (${sa.project_id}) · agregá ?probar=1 para probarla`;
  else { try { await tokenAcceso(sa); out.push = `OK (${sa.project_id})`; } catch (e) { out.push = "ERROR: " + e.message; } }
  res.status(200).json(out);
}
