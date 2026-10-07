// =============================================================
//  REGLAS DEL PANDA
//  Los puntos "de verdad" los calcula la base de datos
//  (supabase/schema.sql → registrar_accion). Si cambiás algo acá,
//  cambialo también allá para que coincidan.
// =============================================================
(function () {
  const ETAPAS = [
    { desde: 0,     nombre: "Bebé",        emoji: "🍼", escala: 0.62 },
    { desde: 300,   nombre: "Cachorrito",  emoji: "🐾", escala: 0.72 },
    { desde: 1200,  nombre: "Pequeño",     emoji: "🎋", escala: 0.82 },
    { desde: 3000,  nombre: "Juguetón",    emoji: "🎈", escala: 0.9 },
    { desde: 6000,  nombre: "Grande",      emoji: "💚", escala: 0.97 },
    { desde: 10000, nombre: "Panda sabio", emoji: "🌸", escala: 1.0 },
  ];

  const PUNTOS = { comida: 5, caricia: 2, frase: 8, mensaje: 3 };
  const TOPES = { caricias_dia: 15, mensajes_dia: 15, horas_entre_comidas: 2 };

  function etapaDe(amor) {
    let i = 0;
    ETAPAS.forEach((e, n) => { if (amor >= e.desde) i = n; });
    const actual = ETAPAS[i], sig = ETAPAS[i + 1];
    const progreso = sig ? (amor - actual.desde) / (sig.desde - actual.desde) : 1;
    return { indice: i, ...actual, siguiente: sig || null, progreso: Math.max(0, Math.min(1, progreso)), faltan: sig ? sig.desde - amor : 0 };
  }

  // Nivel numérico (sigue subiendo aunque ya sea Panda sabio)
  const nivelDe = (amor) => 1 + Math.floor(Math.sqrt(amor / 12));

  const horasDesde = (fecha) => (Date.now() - new Date(fecha).getTime()) / 3600000;

  // 0 = lleno · 1 = muerto de hambre
  function hambre(m) {
    const h = horasDesde(m.ultima_comida);
    return Math.max(0, Math.min(1, (h - 2) / 22));
  }

  // Cómo se ve ahora (combina hambre, mimos, la hora y lo que dijo Gemini)
  function animoVisible(m, ahora = new Date()) {
    const hora = ahora.getHours();
    const ham = hambre(m);
    const sinMimos = horasDesde(m.ultima_caricia);
    if (hora >= 23 || hora < 7) return { clave: "dormido", texto: "Durmiendo", emoji: "😴" };
    if (ham > 0.75) return { clave: "hambriento", texto: "¡Tiene mucha hambre!", emoji: "🥺" };
    if (sinMimos > 30) return { clave: "triste", texto: "Extraña sus mimos", emoji: "😢" };
    if (ham > 0.4) return { clave: "hambriento", texto: "Tiene hambre", emoji: "🎋" };
    const g = m.animo || "feliz";
    const mapa = {
      feliz: ["feliz", "Feliz", "😊"], enamorado: ["enamorado", "Enamorado", "🥰"], mimoso: ["mimoso", "Mimoso", "🤗"],
      extrana: ["triste", "Los extraña", "🥹"], triste: ["triste", "Un poquito triste", "😔"],
      preocupado: ["preocupado", "Preocupado", "😟"], "juguetón": ["jugueton", "Juguetón", "😜"],
    };
    const [clave, texto, emoji] = mapa[g] || mapa.feliz;
    return { clave, texto, emoji };
  }

  const fechaCorta = (f) => new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  function haceCuanto(f) {
    const s = (Date.now() - new Date(f).getTime()) / 1000;
    if (s < 60) return "recién";
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return `hace ${Math.round(s / 86400)} días`;
  }

  globalThis.Reglas = { ETAPAS, PUNTOS, TOPES, etapaDe, nivelDe, hambre, animoVisible, horasDesde, fechaCorta, haceCuanto };
})();
