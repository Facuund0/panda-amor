// =============================================================
//  FRASES DEL PANDA (sin IA: no gastan cuota de Gemini)
//  {yo} = quien usa el celular · {otro} = su pareja · {panda} = nombre del panda
// =============================================================
(function () {
  const F = {
    saludo_manana: ["¡Buen día, {yo}! ¿Desayunamos juntos?", "¡Buenos días! Soñé con bambú y con ustedes dos."],
    saludo_tarde: ["¡Hola, {yo}! Te estaba esperando.", "¡Volviste! Qué lindo verte."],
    saludo_noche: ["Hola, {yo}. Ya tengo sueñito…", "Buenas noches, {yo}. ¿Me das un mimito antes de dormir?"],
    comida: ["¡Ñam ñam! Gracias, {yo}.", "¡Qué rico bambú! Me encanta.", "¡Mmm! Estaba riquísimo."],
    lleno: ["Ya estoy llenito, gracias. ¡Mejor un mimo!", "¡No me entra más bambú! Jiji."],
    caricia: ["¡Jiji, me hacés cosquillas!", "Mmm, qué lindo mimo.", "¡Más mimos, más mimos!", "Te quiero, {yo}."],
    tope_caricias: ["¡Tantos mimos hoy! Ya estoy lleno de amor."],
    frase: ["¡Qué lindo lo que le dijiste a {otro}! Se lo llevo volando.", "Esa frase me hizo crecer el corazón."],
    mensaje: ["¡Mensaje enviado a {otro}!", "Ya se lo llevé a {otro}."],
    necesito_amor_enviado: ["Le avisé a {otro} que necesitás amor. ¡Ya va a venir!", "Le hice vibrar el celular a {otro}."],
    pedir_ubicacion: ["Le pregunté a {otro} dónde está.", "Ya le pregunto a {otro}."],
    racha: ["¡Los dos me cuidaron hoy! La racha sigue: {racha} días.", "¡Racha de {racha} días! Son los mejores."],
    hambre: ["Tengo hambre… ¿me das bambú?", "Mi pancita hace ruido…", "¿Hay bambú por ahí?"],
    triste: ["Extraño sus mimos…", "Hace mucho que nadie me acaricia."],
    dormido: ["Zzz…"],
    crecer: ["¡Crecí! Ahora soy {etapa}. ¡Gracias por tanto amor!"],
    // cuando llega algo de la otra persona
    de_otro: {
      comida: "¡{otro} me dio bambú!",
      caricia: "¡{otro} me hizo mimos!",
      frase: "{otro} te dedicó una frase: {texto}",
      mensaje: "Mensaje de {otro}: {texto}",
      necesito_amor: "¡{otro} necesita amor! Mandale un mimo.",
      pedir_ubicacion: "{otro} quiere saber dónde estás.",
      ubicacion: "{otro} compartió dónde está.",
    },
    limite: ["Estoy cansadito de tanto pensar. Mañana charlamos más, ¿sí?"],
    error_ia: ["Uy, no te escuché bien. ¿Me lo decís de nuevo?"],
  };

  function frase(clave, datos = {}) {
    let lista = F[clave];
    if (!lista) return "";
    const t = Array.isArray(lista) ? lista[Math.floor(Math.random() * lista.length)] : lista;
    return t.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? "");
  }
  function deOtro(tipo, datos) {
    const t = F.de_otro[tipo];
    return t ? t.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? "") : "";
  }
  function saludo(datos) {
    const h = new Date().getHours();
    return frase(h < 12 && h >= 6 ? "saludo_manana" : h >= 21 || h < 6 ? "saludo_noche" : "saludo_tarde", datos);
  }

  globalThis.Frases = { frase, deOtro, saludo };
})();
