// =============================================================
//  MODO +18 🔥 (solo si lo activan en Ajustes)
//  Verdad o reto, preguntas y retos para la pareja, en 5 niveles de picante.
//  Todo es local (no usa Gemini ni internet). Sugerente, no explícito.
//  Para agregar cartas: sumalas al nivel que corresponda.
// =============================================================
(function () {
  const NIVELES = [
    null,
    { nombre: "Coqueto", emoji: "🌶️" },
    { nombre: "Romántico", emoji: "🌶️🌶️" },
    { nombre: "Atrevido", emoji: "🌶️🌶️🌶️" },
    { nombre: "Muy picante", emoji: "🌶️🌶️🌶️🌶️" },
    { nombre: "Fuego", emoji: "🔥🔥🔥🔥🔥" },
  ];

  const VERDADES = {
    1: [
      "¿Qué fue lo primero que te atrajo de mí físicamente?",
      "¿Qué prenda mía te gusta más cómo me queda?",
      "¿Alguna vez soñaste conmigo? Contá el sueño.",
      "¿Qué parte de mi cuerpo te gusta mirar cuando no me doy cuenta?",
      "¿Cuál fue el beso nuestro que más te gustó y por qué?",
      "¿Qué es lo más lindo que pensaste de mí hoy?",
      "¿Qué perfume o olor mío te encanta?",
      "¿Qué te pone nervioso/a de mí en el buen sentido?",
      "¿Cuándo fue la primera vez que tuviste ganas de besarme?",
      "Del 1 al 10, ¿qué tan lindo/a me veo ahora mismo?",
      "¿Qué apodo cariñoso querés que te diga más seguido?",
      "¿Qué hago que te derrite sin que yo lo sepa?",
    ],
    2: [
      "¿Dónde te gustaría que te bese ahora mismo?",
      "¿Cuál es tu recuerdo más romántico conmigo?",
      "¿Qué te gustaría que hagamos en una cita perfecta que termine en casa?",
      "¿Qué parte de tu cuerpo te gusta que te acaricie?",
      "¿Qué canción te pone en modo romántico pensando en mí?",
      "¿Preferís besos lentos o besos con ganas?",
      "¿Qué ropa te gustaría verme puesta en una noche especial?",
      "¿Cuál es el lugar más lindo donde nos besamos?",
      "¿Qué te gustaría que te susurre al oído?",
      "¿Qué es lo que más te gusta de cuando dormimos juntos?",
      "¿Hay algo romántico que siempre quisiste que hagamos y nunca dijiste?",
      "¿Qué te dan más ganas: un baño juntos o un masaje? ¿Por qué?",
    ],
    3: [
      "¿Cuál es la parte de mi cuerpo que más te gusta besar?",
      "¿Qué es lo más atrevido que pensaste hacer conmigo?",
      "¿Cuál fue el momento en que más ganas me tuviste?",
      "¿Qué te gusta que te haga para encenderte?",
      "¿Preferís que tome yo la iniciativa o tomarla vos?",
      "¿Qué ropa interior te gustaría verme puesta?",
      "¿Alguna vez pensaste en mí de forma picante en un lugar público? ¿Dónde?",
      "¿Qué lugar fuera de la cama te gustaría probar conmigo?",
      "Contá un recuerdo nuestro que te sigue dando calor.",
      "¿Qué palabra o frase mía te pone a mil?",
      "¿Qué te gustaría que te haga con los labios?",
      "Del 1 al 10, ¿cuántas ganas tenés de mí ahora?",
    ],
    4: [
      "¿Cuál es tu fantasía conmigo que todavía no me contaste?",
      "¿Qué es lo que más te gusta que hagamos en la intimidad?",
      "¿Qué te gustaría probar que nunca probamos?",
      "¿Te gustaría que juguemos con los ojos vendados? ¿Quién los tendría?",
      "¿Qué parte de tu cuerpo es la más sensible a mis besos?",
      "¿Te gustaría que juguemos a algún personaje o rol? ¿Cuál?",
      "¿Qué te gusta más: mirar o que te miren?",
      "¿Qué es lo más picante que te animarías a hacer conmigo esta semana?",
      "¿Hay algún juguete o juego que te dé curiosidad probar juntos?",
      "¿Cuál fue nuestra mejor noche juntos y qué la hizo especial?",
      "¿Qué te gustaría que te diga mientras estamos solos en la cama?",
      "¿Preferís despacito y lento, o intenso y con ganas?",
    ],
    5: [
      "Contá con detalle (pero bajito) tu fantasía número uno conmigo.",
      "¿Qué es lo más atrevido que querés que te haga esta noche?",
      "¿Hay algún lugar arriesgado donde te gustaría que pasemos un momento a solas?",
      "¿Qué límite tuyo te gustaría que juguemos a acercarnos (siempre con cuidado)?",
      "¿Qué te gustaría que haga con mis manos ahora mismo?",
      "¿Cuál es el recuerdo nuestro más fuego que tenés?",
      "Si tuviéramos una noche entera sin interrupciones, ¿cómo sería paso a paso?",
      "¿Qué es lo que más te enciende de mí?",
      "¿Te gustaría que yo tome el control total esta noche, o tomarlo vos?",
      "¿Qué te da vergüenza pedirme pero te encantaría que pase?",
      "¿Qué juego de pareja te gustaría inventar para nosotros dos?",
      "Decí tres cosas que querés que hagamos antes de que termine el mes.",
    ],
  };

  const RETOS = {
    1: [
      "Mandale a tu pareja un mensaje coqueto como si recién se conocieran.",
      "Dale un beso en la mejilla y decile algo lindo al oído.",
      "Mirá a tu pareja a los ojos 30 segundos sin reírte.",
      "Hacé tu mejor cara seductora durante 10 segundos.",
      "Dale un abrazo largo de 20 segundos.",
      "Decile tres cosas que te gustan de su cuerpo.",
      "Dale un beso en la frente y otro en la nariz.",
      "Imitá cómo te gustaría que te salude cuando te ve.",
      "Hacele cosquillas durante 10 segundos.",
      "Contale al oído qué es lo que más te gusta de su sonrisa.",
      "Mandale una selfie con tu mejor cara de pícaro/a.",
      "Dale un beso de película (con inclinada incluida).",
    ],
    2: [
      "Dale un beso lento de 15 segundos.",
      "Hacele un masaje en los hombros durante 2 minutos.",
      "Besale el cuello despacito.",
      "Bailá una canción lenta pegaditos.",
      "Susurrale al oído lo que te gustaría hacer esta noche.",
      "Acariciale el pelo y la cara con los ojos cerrados durante un minuto.",
      "Dale besos en la mano subiendo hasta el hombro.",
      "Sentate en su falda durante la próxima carta.",
      "Mordele suavemente la oreja.",
      "Elegí una canción sensual y que suene de fondo el resto del juego.",
      "Decile la frase más romántica que se te ocurra, mirándole los labios.",
      "Dale un masaje en los pies durante 2 minutos.",
    ],
    3: [
      "Sacate una prenda (la que vos elijas).",
      "Dale un beso en un lugar que nunca le hayas besado.",
      "Hacele un masaje en la espalda sin remera durante 3 minutos.",
      "Besale desde el cuello hasta el hombro, despacio.",
      "Hacé un baile sensual de 30 segundos para tu pareja.",
      "Dejá que tu pareja te saque una prenda.",
      "Susurrale algo atrevido mientras le acariciás la espalda.",
      "Durante 1 minuto, solo se pueden tocar con los labios.",
      "Vendale los ojos y dale tres besos donde quieras: tiene que adivinar dónde.",
      "Sentate encima de tu pareja y no te podés mover hasta la próxima carta.",
      "Dale un beso con mucha pasión durante 30 segundos.",
      "Recorrele la espalda con un dedo, muy despacio, de arriba abajo.",
    ],
    4: [
      "Sacate dos prendas.",
      "Sacale la ropa a tu pareja hasta quedar en ropa interior.",
      "Masaje con aceite o crema de 5 minutos donde tu pareja elija.",
      "Besale todo el abdomen, muy despacio.",
      "Hacé un striptease de 1 minuto con música.",
      "Vendale los ojos y acariciale durante 2 minutos: no puede tocarte.",
      "Tu pareja te da una orden picante y la tenés que cumplir (se puede pasar).",
      "Usá un hielo para recorrerle el cuello y la espalda.",
      "Durante 2 minutos solo podés usar la boca para darle mimos.",
      "Contale tu fantasía al oído mientras le acariciás.",
      "Dejá que tu pareja elija dónde te besa durante 1 minuto.",
      "Quedense los dos en ropa interior el resto del juego.",
    ],
    5: [
      "Quedate sin nada de ropa hasta la próxima carta.",
      "Sacale toda la ropa a tu pareja, despacio y a besos.",
      "Tu pareja elige qué te hace durante 3 minutos y vos no podés tocar (se puede pasar).",
      "Cumplí una fantasía chiquita de tu pareja ahora mismo.",
      "Juego de control: durante 5 minutos tu pareja manda y vos obedecés (palabra de seguridad: \"panda\").",
      "Llevá a tu pareja a la cama y hacé lo que más le gusta.",
      "Ojos vendados para tu pareja: sorprendela durante 5 minutos.",
      "Elegí un lugar distinto de la casa para lo que sigue 🔥",
      "Besale cada centímetro que quieras durante 3 minutos.",
      "Mostrale con hechos (no con palabras) lo que contaste en tu última verdad.",
      "Ducha juntos ahora, y lo que pase, pasa.",
      "Hagan lo que tengan ganas y terminen el juego como más les guste 😏",
    ],
  };

  const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
  // Evita repetir las últimas cartas que salieron
  const ultimas = [];
  function carta(nivel, tipo) {
    nivel = Math.max(1, Math.min(5, nivel | 0));
    const t = tipo === "azar" ? (Math.random() < 0.5 ? "verdad" : "reto") : tipo;
    const lista = (t === "verdad" ? VERDADES : RETOS)[nivel];
    let c, i = 0;
    do { c = azar(lista); } while (ultimas.includes(c) && i++ < 20);
    ultimas.push(c); if (ultimas.length > 30) ultimas.shift();
    return { tipo: t, nivel, texto: c };
  }

  globalThis.Picante = { NIVELES, VERDADES, RETOS, carta };
})();
