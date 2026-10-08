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

  const PUNTOS = { comida: 5, caricia: 2, frase: 8, mensaje: 3, banio: 4, dormir: 2, juego: 3, sentir: 3, pregunta: 5, foto: 5 };
  const TOPES = { caricias_dia: 15, mensajes_dia: 15, horas_entre_comidas: 2, juegos_dia: 5, sentir_dia: 5, fotos_con_premio: 3, fotos_dia: 10, horas_entre_banios: 3 };

  // ---------- v2 (estilo Pou). Igual que item_info / desafios_hoy en schema.sql ----------
  // comida: precio · horas de panza llena · amor · energía extra · cariño
  // accesorio: precio · lugar (uno por lugar)
  const TIENDA = {
    manzana:     { tipo: "comida", nombre: "Manzana",     emoji: "🍎", precio: 8,  horas: 4, amor: 1, energia: 0 },
    zanahoria:   { tipo: "comida", nombre: "Zanahoria",   emoji: "🥕", precio: 6,  horas: 3, amor: 1, energia: 0 },
    leche:       { tipo: "comida", nombre: "Leche",       emoji: "🥛", precio: 10, horas: 3, amor: 1, energia: 15 },
    te:          { tipo: "comida", nombre: "Té de bambú", emoji: "🍵", precio: 12, horas: 2, amor: 1, energia: 25 },
    helado:      { tipo: "comida", nombre: "Helado",      emoji: "🍦", precio: 15, horas: 3, amor: 2, energia: 0, carino: true },
    dumpling:    { tipo: "comida", nombre: "Dumpling",    emoji: "🥟", precio: 18, horas: 7, amor: 2, energia: 0 },
    sushi:       { tipo: "comida", nombre: "Sushi",       emoji: "🍣", precio: 22, horas: 8, amor: 3, energia: 0 },
    torta:       { tipo: "comida", nombre: "Torta",       emoji: "🍰", precio: 30, horas: 6, amor: 5, energia: 0, carino: true },
    mono:        { tipo: "accesorio", nombre: "Moño",        emoji: "🎀", precio: 40,  lugar: "cabeza" },
    flor:        { tipo: "accesorio", nombre: "Flor",        emoji: "🌼", precio: 35,  lugar: "cabeza" },
    gorro:       { tipo: "accesorio", nombre: "Gorrito",     emoji: "🧶", precio: 60,  lugar: "cabeza" },
    auriculares: { tipo: "accesorio", nombre: "Auriculares", emoji: "🎧", precio: 90,  lugar: "cabeza" },
    corona:      { tipo: "accesorio", nombre: "Corona",      emoji: "👑", precio: 150, lugar: "cabeza" },
    lentes:      { tipo: "accesorio", nombre: "Lentes",      emoji: "🕶️", precio: 80,  lugar: "cara" },
    bufanda:     { tipo: "accesorio", nombre: "Bufanda",     emoji: "🧣", precio: 70,  lugar: "cuello" },
    pajarita:    { tipo: "accesorio", nombre: "Moñito",      emoji: "🎗️", precio: 50,  lugar: "cuello" },
  };

  // Desafíos del día (el servidor elige 3 por persona: 1 de pareja + 2 de cuidado)
  const DESAFIOS = {
    foto:     { pareja: true,  meta: 1, premio: 30, texto: "Mandale una foto a {otro}", emoji: "📸", tipos: ["foto"] },
    frase:    { pareja: true,  meta: 1, premio: 15, texto: "Dedicale una frase a {otro}", emoji: "💌", tipos: ["frase"] },
    mensajes: { pareja: true,  meta: 3, premio: 15, texto: "Mandale 3 mensajes a {otro}", emoji: "💬", tipos: ["mensaje"] },
    sentir:   { pareja: true,  meta: 1, premio: 15, texto: "Contale a {otro} cómo te sentís", emoji: "💭", tipos: ["sentir"] },
    pregunta: { pareja: true,  meta: 1, premio: 15, texto: "Respondé la pregunta del día", emoji: "❓", tipos: ["pregunta"] },
    mimos:    { pareja: false, meta: 5, premio: 10, texto: "Hacele 5 mimos a {panda}", emoji: "🤗", tipos: ["caricia"] },
    banio:    { pareja: false, meta: 1, premio: 10, texto: "Bañá a {panda}", emoji: "🛁", tipos: ["banio"] },
    comer:    { pareja: false, meta: 2, premio: 10, texto: "Dale de comer 2 veces a {panda}", emoji: "🍎", tipos: ["comida", "comer"] },
    jugar:    { pareja: false, meta: 1, premio: 15, texto: "Jugá con {panda} al minijuego", emoji: "🎮", tipos: ["juego"] },
    dormir:   { pareja: false, meta: 1, premio: 10, texto: "Acostá a {panda} a dormir", emoji: "😴", tipos: ["dormir"] },
  };
  const REGALO_DIARIO = 10;
  const MONEDAS_INICIALES = 50;
  const ABANDONO = { aviso1: 3, aviso2: 5, seVa: 7 }; // días sin que nadie lo cuide
  const MONEDAS_JUEGO = (puntaje) => Math.min(20, Math.floor(Math.min(300, puntaje) / 3));

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

  // 0..100: durmiendo sube 25 por hora, despierto baja 6 por hora (igual que energia_actual en schema.sql)
  function energia(m) {
    if (m.energia_base == null) return 100; // base de datos vieja
    const h = Math.max(0, horasDesde(m.energia_desde));
    return m.durmiendo ? Math.min(100, m.energia_base + Math.floor(h * 25)) : Math.max(0, m.energia_base - Math.floor(h * 6));
  }
  // 1 = limpito · 0 = muy sucio (aguanta 6 h limpio y a las 48 h está sucísimo)
  function limpieza(m) {
    if (!m.ultimo_banio) return 1;
    return Math.max(0, Math.min(1, 1 - (horasDesde(m.ultimo_banio) - 6) / 42));
  }
  // 1 = recién mimado · 0 = hace 30 h que nadie lo mima (ahí se pone triste)
  function carino(m) { return Math.max(0, Math.min(1, 1 - (horasDesde(m.ultima_caricia) - 1) / 29)); }
  const diasSinCuidado = (m) => (m.ultimo_cuidado ? horasDesde(m.ultimo_cuidado) / 24 : 0);
  const diasParaIrse = (m) => Math.max(0, Math.ceil(ABANDONO.seVa - diasSinCuidado(m)));
  const esDeNoche = (ahora = new Date()) => ahora.getHours() >= 23 || ahora.getHours() < 7;

  // Cómo se ve ahora (combina hambre, mimos, limpieza, energía, la hora y lo que dijo Gemini)
  function animoVisible(m, ahora = new Date()) {
    const ham = hambre(m);
    const sinMimos = horasDesde(m.ultima_caricia);
    if (m.se_fue) return { clave: "triste", texto: "Se fue…", emoji: "🎒" };
    if (m.durmiendo) return { clave: "dormido", texto: "Durmiendo", emoji: "😴" };
    if (ham > 0.75) return { clave: "hambriento", texto: "¡Tiene mucha hambre!", emoji: "🥺" };
    if (energia(m) < 15) return { clave: "cansado", texto: "Está agotado, acostalo", emoji: "🥱" };
    if (sinMimos > 30) return { clave: "triste", texto: "Extraña sus mimos", emoji: "😢" };
    if (limpieza(m) < 0.25) return { clave: "sucio", texto: "Está sucio, ¡bañalo!", emoji: "🫧" };
    if (esDeNoche(ahora)) return { clave: "sueno", texto: "Tiene sueño, apagale la luz", emoji: "🥱" };
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

  // Día de hoy (hora local) como número, para elegir la pregunta del día igual en los dos celulares
  const numeroDia = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  const esHoy = (f) => new Date(f).toDateString() === new Date().toDateString();

  globalThis.Reglas = {
    ETAPAS, PUNTOS, TOPES, TIENDA, DESAFIOS, REGALO_DIARIO, MONEDAS_INICIALES, ABANDONO, MONEDAS_JUEGO,
    etapaDe, nivelDe, hambre, energia, limpieza, carino, diasSinCuidado, diasParaIrse, esDeNoche,
    animoVisible, horasDesde, fechaCorta, haceCuanto, numeroDia, esHoy,
  };
})();
