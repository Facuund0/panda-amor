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
      ubicacion_vivo: "{otro} empezó a compartir su ubicación en vivo.",
      alerta_mujer: "¡Alerta, alerta! {otro} quiere saber si estás con otra mujer.",
      alerta_hombre: "¡Alerta, alerta! {otro} quiere saber si estás con otro hombre.",
      banio: "¡{otro} me bañó! Quedé limpito.",
      dormir: "{otro} me acostó a dormir…",
      despertar: "¡{otro} me despertó!",
      comer: "¡{otro} me dio {item}!",
      juego: "¡{otro} jugó conmigo e hizo {texto} puntos!",
      sentir: "{otro} te cuenta: {texto}",
      pregunta: "¡{otro} respondió la pregunta del día!",
      foto: "¡{otro} te mandó una foto! 📸",
    },
    // ---------- v2: cuidados ----------
    banio_listo: ["¡Qué rico baño! Quedé re limpito.", "¡Olor a jabón! Gracias, {yo}.", "¡Brillo de limpio!"],
    limpio: ["¡Ya estoy limpito! Me bañaron hace un ratito.", "¡Si me bañás de nuevo me arrugo! Jiji."],
    sucio: ["Estoy un poquito sucio… ¿me bañás?", "Me pica la pancita… ¡necesito un baño!", "Uy, huelo a bambú viejo… jiji."],
    a_dormir: ["Buenas noches… Zzz", "Qué rico apagar la luz… Zzz", "Hasta mañana, {yo}…"],
    sin_sueno: ["No tengo mucho sueño… pero bueno, cierro los ojitos.", "Una siestita cortita, ¿dale?"],
    despertar: ["¡Buen día! ¡Qué bien dormí!", "¡Ya me desperté! ¿Jugamos?"],
    sueno_despertar: ["Mmm… todavía tengo sueñito…", "¡Uh! Me despertaron con sueño…"],
    durmiendo_toque: ["Shh… está durmiendo.", "Zzz…"],
    cansado: ["Estoy re cansadito… ¿me acostás?", "Me pesan los ojitos…"],
    sueno: ["Ya es tarde… ¿me apagás la luz?", "Tengo sueñito… ¡a la cama!"],
    comer_item: ["¡Mmm, {item}! ¡Riquísimo!", "¡Me encanta {item}! Gracias, {yo}.", "¡Ñam! ¡{item}!"],
    juego_fin: ["¡Qué divertido! Hiciste {puntos} puntos.", "¡{puntos} puntos! ¡Sos re bueno jugando!"],
    juego_cansado: ["Estoy muy cansado para jugar… ¿me acostás un ratito?"],
    compra: ["¡Gracias por {item}!", "¡Uy, {item}! ¡Me encanta!"],
    accesorio: ["¿Cómo me queda? ¡Me siento re lindo!", "¡Mirá qué facha tengo!"],
    monedas: ["¡Ganaste {monedas} monedas!"],
    foto_enviada: ["¡Le llevé la foto a {otro}!", "¡Foto enviada! Qué lindos que son."],
    sentir_enviado: ["Ya le conté a {otro} cómo te sentís. Te mando un abrazo de panda.", "Se lo llevé a {otro}. Acá estoy, {yo}."],
    aviso_abandono_1: ["Me siento solito… hace días que nadie me cuida. Si siguen así, me voy a ir.", "Los extraño mucho… ¿se olvidaron de mí?"],
    aviso_abandono_2: ["Última oportunidad… si no me cuidan pronto, agarro mi mochila y me voy.", "Ya armé mi mochila… ¿me cuidan, porfa?"],
    adoptado: ["¡Hola! Soy {panda}. Recién llegué… ¿me cuidan mucho?"],
    limite: ["Estoy cansadito de tanto pensar. Mañana charlamos más, ¿sí?"],
    error_ia: ["Uy, no te escuché bien. ¿Me lo decís de nuevo?"],
  };

  // "¿Cómo estás?": no todo es feliz. Al otro le llega con un aviso.
  const SENTIMIENTOS = [
    { id: "feliz", emoji: "😊", texto: "Estoy feliz" },
    { id: "amo", emoji: "🥰", texto: "Te amo mucho" },
    { id: "extrano", emoji: "🥺", texto: "Te extraño" },
    { id: "triste", emoji: "😢", texto: "Estoy triste" },
    { id: "abrazo", emoji: "🫂", texto: "Necesito un abrazo" },
    { id: "hablar", emoji: "💬", texto: "Necesito hablar" },
    { id: "cansado", emoji: "😴", texto: "Estoy cansado/a" },
    { id: "enojado", emoji: "😤", texto: "Estoy enojado/a" },
    { id: "preocupado", emoji: "😰", texto: "Estoy preocupado/a" },
    { id: "mal", emoji: "🤒", texto: "Me siento mal" },
    { id: "perdon", emoji: "🙏", texto: "Perdón" },
    { id: "orgullo", emoji: "🤩", texto: "Estoy orgulloso/a de vos" },
  ];
  const TRISTES = ["extrano", "triste", "abrazo", "hablar", "cansado", "enojado", "preocupado", "mal", "perdon"];
  // Qué dice el panda de la otra persona según cómo se siente
  const RESPUESTA_SENTIR = {
    feliz: "¡{otro} está feliz! Eso me pone re contento.",
    amo: "¡{otro} te ama mucho! Me derrito de amor.",
    extrano: "{otro} te extraña… ¿le mandás un mimo?",
    triste: "{otro} está triste… ¿le mandás un abrazo o una frase linda?",
    abrazo: "{otro} necesita un abrazo. ¡Mandale mimos!",
    hablar: "{otro} necesita hablar con vos. ¿Lo llamás?",
    cansado: "{otro} está cansadito. Mandale fuerzas.",
    enojado: "{otro} está enojado… Hablen con calma, ¿sí?",
    preocupado: "{otro} está preocupado. Un mensajito le va a hacer bien.",
    mal: "{otro} se siente mal… Cuidalo mucho.",
    perdon: "{otro} te pide perdón. ¿Se dan un abrazo?",
    orgullo: "¡{otro} está orgulloso de vos! ¡Y yo también!",
  };
  // Ideas de frases, por tema (no solo cosas felices)
  const IDEAS_FRASES = {
    "💗 Amor": ["Gracias por estar siempre 💗", "Sos mi lugar favorito", "Te elegiría mil veces más", "Me encanta tu risa"],
    "🥺 Te extraño": ["Hoy te extraño un montón", "Cuento las horas para verte", "Me hacés falta"],
    "😢 Triste": ["Hoy no es un buen día, necesito tu abrazo", "Estoy bajoneado/a, ¿me hablás?", "Me siento solo/a hoy"],
    "🙏 Perdón": ["Perdón por lo de hoy, te quiero", "No quise lastimarte", "¿Hablamos tranqui?"],
    "💪 Ánimo": ["Vos podés con todo", "Estoy orgulloso/a de vos", "Pase lo que pase, estoy acá"],
    "🌙 Buenas noches": ["Que sueñes lindo 🌙", "Buenas noches, mi amor", "Mañana te veo en mis sueños"],
  };
  // Pregunta del día para la pareja (la misma para los dos; se ve la respuesta del otro cuando respondés)
  const PREGUNTAS = [
    "¿Cuál es tu recuerdo favorito de nosotros?", "¿Qué fue lo primero que te gustó de mí?", "¿A dónde te gustaría viajar juntos?",
    "¿Qué canción te hace pensar en mí?", "¿Cuál sería nuestra cita perfecta?", "¿Qué es lo que más te hace reír de mí?",
    "¿Qué te gustaría que hagamos este fin de semana?", "¿Qué comida te gustaría que cocinemos juntos?", "¿Cuál es tu sueño más grande?",
    "Si fuéramos un dúo de película, ¿cuál seríamos?", "¿Qué cosa chiquita que hago te hace feliz?", "¿Qué te gustaría aprender juntos?",
    "¿Cuál fue el mejor día que pasamos?", "¿Qué te pone nervioso/a de nosotros?", "¿Cómo te imaginás dentro de 5 años?",
    "¿Qué serie o peli vemos juntos?", "¿Qué te hace sentir querido/a?", "¿Qué es algo que nunca me contaste?",
    "¿Qué apodo nuevo me pondrías?", "¿Qué parte de tu día te gustaría compartir más conmigo?", "¿Qué animal sería yo?",
    "¿Cuál es tu lugar favorito para estar conmigo?", "¿Qué te gustaría que te diga más seguido?", "¿Qué plan barato y lindo hacemos?",
    "¿Qué admirás de mí?", "¿Cuál es tu forma favorita de recibir cariño?", "¿Qué foto nuestra es tu favorita?",
    "¿Qué te gustaría mejorar de nosotros?", "¿Qué te da tranquilidad cuando estás mal?", "¿Qué haríamos con un día libre sin celular?",
  ];
  const preguntaDelDia = (n) => PREGUNTAS[((n % PREGUNTAS.length) + PREGUNTAS.length) % PREGUNTAS.length];

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

  globalThis.Frases = { frase, deOtro, saludo, SENTIMIENTOS, TRISTES, RESPUESTA_SENTIR, IDEAS_FRASES, PREGUNTAS, preguntaDelDia };
})();
