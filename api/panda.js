// =============================================================
//  /api/panda — Lo único que usa Gemini (IA)
//
//  accion = "chat"      → charlar con el panda           (1 consulta)
//  accion = "animo"     → leer los últimos mensajes y
//                          decidir cómo se siente         (1 consulta cada 8 mensajes)
//  accion = "frase_dia" → frase tierna + pregunta del día (1 consulta por día,
//                          para los dos; no repite las últimas 40)
//
//  Cada persona usa SU key de Gemini (GEMINI_KEY_1 / GEMINI_KEY_2)
//  y tiene un límite diario (LIMITE_GEMINI_DIARIO, por defecto 60).
// =============================================================
import { rpc, consultar, gemini, keyGemini, LIMITE_DIARIO, SUPABASE_URL, cuerpo } from "./_comun.js";

const ETAPAS = ["bebé", "cachorrito", "pequeño", "juguetón", "grande", "panda sabio"];
const LIMITES_ETAPA = [0, 300, 1200, 3000, 6000, 10000];
const etapaDe = (amor) => LIMITES_ETAPA.reduce((i, d, n) => (amor >= d ? n : i), 0);

// Cuidados estilo Pou (limpieza, energía, sueño, monedas). Igual que web/js/reglas.js
function estadoPou(m) {
  if (m.energia_base == null) return "";
  const h = (f) => (Date.now() - new Date(f).getTime()) / 3600000;
  const energia = m.durmiendo ? Math.min(100, m.energia_base + Math.floor(h(m.energia_desde) * 25)) : Math.max(0, m.energia_base - Math.floor(h(m.energia_desde) * 8));
  const limpieza = Math.max(0, Math.min(1, 1 - (h(m.ultimo_banio) - 3) / 21));
  const dias = h(m.ultimo_cuidado) / 24;
  return `
- ${m.durmiendo ? "Estás durmiendo (te despertaron para hablar, hablás con sueñito)" : `Energía: ${energia}/100${energia < 20 ? " (¡estás muy cansado, querés dormir!)" : ""}`}
- Limpieza: ${Math.round(limpieza * 100)}%${limpieza < 0.3 ? " (estás sucio, querés un baño)" : ""}
- Monedas de la pareja: ${m.monedas} · accesorios puestos: ${(m.puestos || []).join(", ") || "ninguno"}${dias >= 2 ? `
- Hace ${Math.floor(dias)} días que nadie te cuida: te sentís solito y si pasan 7 días te vas a ir con tu mochila.` : ""}`;
}

function personalidad(est) {
  const m = est.mascota, yo = est.yo.nombre, otro = est.otro?.nombre || "su pareja";
  const e = etapaDe(m.amor);
  const horas = (Date.now() - new Date(m.ultima_comida).getTime()) / 3600000;
  const forma = [
    "Sos un bebé: frases MUY cortas y simples, a veces decís 'jiji' o hacés ruiditos tiernos.",
    "Sos un cachorrito: frases cortas, curioso y juguetón.",
    "Sos un panda pequeño: tierno, alegre, hablás como un nene de 6 años.",
    "Sos un panda juguetón: divertido, cariñoso, te gusta proponer cosas lindas para la pareja.",
    "Sos un panda grande: cariñoso, compañero y un poquito más maduro.",
    "Sos un panda sabio: dulce y tranquilo, das consejos de amor con ternura.",
  ][e];
  return `Sos ${m.nombre}, un osito panda virtual que vive en el celular de una pareja: ${yo} y ${otro}. Ahora te habla ${yo}.
Representás el amor que se tienen: crecés cuando se dan mimos, te dan bambú y se dedican frases.
${forma}
Hablás en español rioplatense (voseo), con ternura, como un nene. Respondés en 1 a 3 oraciones cortas (máximo 45 palabras).
Sin emojis en el texto (se lee en voz alta), sin listas ni markdown.
Si te preguntan algo general, respondé simple y correcto, a tu manera tierna.
Si ${yo} está triste o mal, sé muy cariñoso y sugerí hablar con ${otro} o con alguien de confianza. No des consejos médicos ni legales.
Nunca inventes cosas que hizo ${otro}: solo sabés lo que figura abajo.

Cómo estás ahora:
- Etapa: ${ETAPAS[e]} · amor acumulado: ${m.amor} · racha: ${m.racha} días seguidos (mejor: ${m.mejor_racha})
- Última comida: hace ${horas < 1 ? "menos de una hora" : Math.round(horas) + " horas"}${horas > 6 ? " (¡tenés hambre!)" : ""}
- Ánimo según sus mensajes: ${m.animo}${m.animo_nota ? " (" + m.animo_nota + ")" : ""}${estadoPou(m)}
- Hora en Argentina: ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Usá POST" });
  if (!SUPABASE_URL) return res.status(503).json({ error: "Falta configurar SUPABASE_URL en Vercel" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sin sesión" });
  const b = cuerpo(req);
  const accion = String(b.accion || "");
  if (!["chat", "animo", "frase_dia"].includes(accion)) return res.status(400).json({ error: "Acción desconocida" });

  // 1) ¿Quién es? (la base valida la sesión y que pertenezca a una pareja)
  let est;
  try { est = await rpc(token, "mi_estado"); } catch (e) { return res.status(401).json({ error: "Sesión inválida" }); }
  if (!est?.pareja) return res.status(403).json({ error: "No estás en una pareja" });
  if (accion === "frase_dia" && est.mascota.frase_fecha === est.hoy) return res.status(200).json({ frase: est.mascota.frase_dia, pregunta: est.mascota.pregunta_dia || null });

  // 2) ¿Le quedan consultas hoy?
  const uso = await rpc(token, "usar_gemini", { limite: LIMITE_DIARIO });
  if (!uso.ok) return res.status(200).json({ limite: true, usadas: uso.usadas, limiteDiario: LIMITE_DIARIO });
  const key = keyGemini(uso.lugar);
  if (!key) return res.status(503).json({ error: `Falta la variable GEMINI_KEY_${uso.lugar} en Vercel` });

  const base = { usadas: uso.usadas, limiteDiario: LIMITE_DIARIO };
  const yo = est.yo.nombre, otro = est.otro?.nombre || "su pareja";

  try {
    if (accion === "chat") {
      const mensaje = String(b.mensaje || "").slice(0, 400).trim();
      if (!mensaje) return res.status(400).json({ error: "Mensaje vacío" });
      const historial = (Array.isArray(b.historial) ? b.historial : []).slice(-8)
        .filter((t) => t && ["user", "model"].includes(t.rol) && t.texto)
        .map((t) => ({ role: t.rol, parts: [{ text: String(t.texto).slice(0, 400) }] }));
      while (historial.length && historial[0].role !== "user") historial.shift();
      const r = await gemini(key, {
        sistema: personalidad(est),
        contents: [...historial, { role: "user", parts: [{ text: mensaje }] }],
        esquema: {
          type: "OBJECT",
          properties: {
            respuesta: { type: "STRING" },
            emocion: { type: "STRING", enum: ["feliz", "enamorado", "triste", "sorprendido", "hambriento", "pensativo"] },
          },
          required: ["respuesta", "emocion"],
        },
      });
      if (!r.ok) return res.status(502).json({ error: "Gemini no respondió", errores: r.errores, ...base });
      return res.status(200).json({ respuesta: String(r.datos.respuesta || "").trim(), emocion: r.datos.emocion || "feliz", modelo: r.modelo, ...base });
    }

    if (accion === "animo") {
      const msjs = await consultar(token, "eventos?select=de,tipo,texto,creado&tipo=in.(mensaje,frase)&order=creado.desc&limit=12");
      const texto = msjs.reverse().map((m) => `${m.de === est.yo.id ? yo : otro}: ${m.texto}`).join("\n");
      const r = await gemini(key, {
        sistema: `Sos ${est.mascota.nombre}, el panda de ${yo} y ${otro}. Leés sus últimos mensajes y decidís cómo te sentís según el clima de la pareja. Respondé en JSON.`,
        contents: [{ role: "user", parts: [{ text: `Mensajes recientes:\n${texto}\n\nElegí tu ánimo y escribí una nota MUY corta (máx. 12 palabras) de por qué, en tercera persona sobre la pareja.` }] }],
        esquema: {
          type: "OBJECT",
          properties: {
            animo: { type: "STRING", enum: ["feliz", "enamorado", "mimoso", "extrana", "triste", "preocupado", "juguetón"] },
            nota: { type: "STRING" },
          },
          required: ["animo", "nota"],
        },
        temperatura: 0.4,
      });
      if (!r.ok) return res.status(502).json({ error: "Gemini no respondió", ...base });
      await rpc(token, "guardar_animo", { nuevo_animo: r.datos.animo, nota: String(r.datos.nota || "").slice(0, 200) });
      return res.status(200).json({ animo: r.datos.animo, nota: r.datos.nota, ...base });
    }

    if (accion === "frase_dia") {
      const m = est.mascota;
      const previas = (m.frases_previas || []).slice(0, 25).map((f) => "- " + f).join("\n");
      const pregPrevias = (m.preguntas_previas || []).slice(0, 40).map((f) => "- " + f).join("\n");
      const r = await gemini(key, {
        sistema: personalidad(est),
        contents: [{ role: "user", parts: [{ text: `Hoy necesito dos cosas para ${yo} y ${otro}:
1) "frase": la frase del día, algo tierno y original sobre su amor o para alegrarles el día, dicho por vos. Máximo 25 palabras. Podés usar UN emoji al final.
2) "pregunta": la pregunta del día para que respondan los dos y se conozcan más (divertida, romántica o curiosa; ni íntima ni incómoda). Máximo 15 palabras, con signos de pregunta.
Tienen que ser DISTINTAS a estas que ya usaron:
Frases anteriores:
${previas || "(ninguna)"}
Preguntas anteriores:
${pregPrevias || "(ninguna)"}` }] }],
        esquema: { type: "OBJECT", properties: { frase: { type: "STRING" }, pregunta: { type: "STRING" } }, required: ["frase", "pregunta"] },
        temperatura: 1,
      });
      if (!r.ok) return res.status(502).json({ error: "Gemini no respondió", ...base });
      const frase = String(r.datos.frase || "").trim().slice(0, 300);
      const pregunta = String(r.datos.pregunta || "").trim().slice(0, 200);
      try {
        // la primera de la pareja que llega gana (así los dos ven la misma)
        const g = await rpc(token, "guardar_dia", { frase, pregunta });
        return res.status(200).json({ frase: g.frase, pregunta: g.pregunta, ...base });
      } catch {
        await rpc(token, "guardar_frase_dia", { frase }); // base sin actualizar
        return res.status(200).json({ frase, ...base });
      }
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno", ...base });
  }
}
