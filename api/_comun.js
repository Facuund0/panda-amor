// =============================================================
//  Funciones compartidas por las funciones de Vercel
//  (los archivos que empiezan con "_" no se publican como endpoints)
// =============================================================
export const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
export const LIMITE_DIARIO = Math.max(1, parseInt(process.env.LIMITE_GEMINI_DIARIO || "60", 10));

// Modelos: primero el más rápido; si falla o está saturado, prueba el siguiente
export const MODELOS = [process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"].filter(Boolean);

export function keyGemini(lugar) {
  return process.env[`GEMINI_KEY_${lugar}`] || process.env.GEMINI_API_KEY || "";
}

// Llama a una función de la base de datos como el usuario (respeta la seguridad por pareja)
export async function rpc(token, fn, args = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) { const e = new Error(d?.message || `Supabase ${r.status}`); e.status = r.status; throw e; }
  return d;
}

export async function consultar(token, ruta) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function conLimite(url, opciones, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opciones, signal: c.signal }); } finally { clearTimeout(t); }
}

// Pide a Gemini una respuesta en JSON. Devuelve { ok, datos, modelo } o { ok:false, errores }
export async function gemini(key, { sistema, contents, esquema, temperatura = 0.8, maxTokens = 500 }) {
  const errores = [];
  const inicio = Date.now();
  for (const modelo of MODELOS) {
    if (Date.now() - inicio > 20000) break;
    // intentos: con esquema y pensamiento corto → sin esquema → sin configurar pensamiento
    for (const [conEsquema, pensar] of [[true, true], [false, true], [false, false]]) {
      const cfg = { temperature: temperatura, maxOutputTokens: maxTokens + 1500, responseMimeType: "application/json" };
      if (conEsquema && esquema) cfg.responseSchema = esquema;
      if (pensar) cfg.thinkingConfig = /lite/.test(modelo) ? { thinkingLevel: "minimal" } : { thinkingLevel: "low" };
      try {
        const r = await conLimite(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] }, contents, generationConfig: cfg }),
        }, 12000);
        if (!r.ok) {
          const detalle = (await r.text()).replace(key, "***").slice(0, 300);
          errores.push({ modelo, status: r.status, detalle });
          if ([401, 403].includes(r.status) || /API key not valid|API_KEY_INVALID/i.test(detalle)) return { ok: false, errores };
          if (r.status === 400) continue; // prueba la configuración más simple
          break; // 404, 429, 5xx → siguiente modelo
        }
        const d = await r.json();
        const texto = (d?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
        let datos = null;
        try { datos = JSON.parse(texto.replace(/^```(json)?|```$/g, "").trim()); } catch {}
        if (datos) return { ok: true, datos, modelo };
        errores.push({ modelo, status: 204, detalle: "respuesta vacía o no JSON" });
        break;
      } catch (e) {
        errores.push({ modelo, status: 0, detalle: e.name === "AbortError" ? "tardó demasiado" : String(e).slice(0, 150) });
        break;
      }
    }
  }
  return { ok: false, errores };
}

export function cuerpo(req) {
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body || {};
}
