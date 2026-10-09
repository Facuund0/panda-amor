// =============================================================
//  JUEGOS +18 🔥 (dentro de la sección Picante)
//  Basados en juegos para parejas recomendados en:
//   · lovense.com (sexting games) · badgirlsbible.com · mindbodygreen.com
//  Tipos:
//   · "cartas": muestra una consigna al azar de la lista (botón "Otra").
//   · "dados":  arma una combinación al azar (acción + zona + tiempo, etc.).
//   · "timer":  cuenta regresiva con consignas que van cambiando.
//   · "coincidencias": "¿Lo probaríamos?" — cada uno responde sin que el otro vea; solo se muestran los "sí" de los dos.
//   · "frasco": saca al azar una de las cartas que escribieron ustedes.
//   · "info":   explicación de cómo se juega.
//  Todo es local, sin Gemini. Sugerente, no explícito.
// =============================================================
(function () {
  const JUEGOS = [
    // ---------- en persona ----------
    { id: "dados", emoji: "🎲", nombre: "Dados picantes", tipo: "dados",
      como: "Tiren los dados: sale qué hacer, dónde y cuánto tiempo. Si no quieren cumplir, se saca una prenda.",
      dados: [
        ["Besá", "Lamé despacito", "Mordisqueá suave", "Acariciá", "Soplá", "Masajeá", "Recorré con un hielo", "Recorré con la lengua", "Rozá con los labios", "Hacé cosquillas con una pluma"],
        ["el cuello", "las orejas", "los labios", "el pecho", "la panza", "la espalda", "los muslos", "la parte de atrás de las rodillas", "la cintura", "donde tu pareja elija 😏", "donde vos quieras 😏", "las manos y los dedos"],
        ["30 segundos", "1 minuto", "2 minutos", "hasta que tu pareja diga basta", "con los ojos vendados", "sin usar las manos"],
      ] },
    { id: "strip", emoji: "👕", nombre: "Strip: el que pierde se saca algo", tipo: "cartas",
      como: "Jueguen una ronda de lo que sea (piedra papel o tijera, adivinanzas, cartas). El que pierde cumple la carta.",
      cartas: ["Sacate una prenda.", "Tu pareja te saca una prenda, como quiera.", "Sacate una prenda bailando.", "Sacate una prenda sin usar las manos.", "Elegí qué prenda se saca tu pareja.", "Sacate una prenda en cámara lenta, mirándole a los ojos.", "Te salvaste: elegís una prenda para que se saque tu pareja.", "Sacate dos prendas o hacé un baile de 30 segundos.", "Tu pareja elige: una prenda o un beso donde ella/él diga.", "Ronda doble: el próximo que pierda se saca dos."] },
    { id: "todavia_no", emoji: "⏳", nombre: "Todavía no", tipo: "timer", minutos: [10, 15, 20, 30],
      como: "Pongan el reloj. Hasta que suene se vale todo lo previo (besos, caricias, ropa afuera)… pero nada más. La espera es la gracia.",
      cartas: ["Solo besos en la boca.", "Besos en el cuello y las orejas.", "Caricias por encima de la ropa.", "Saquen una prenda cada uno.", "Masajes en la espalda.", "Besos de la cintura para arriba.", "Caricias con las yemas de los dedos, despacito.", "Susúrrense lo que van a hacer cuando suene el reloj.", "Uno quieto, el otro lo provoca un minuto.", "Cambio: ahora provoca el otro."] },
    { id: "beso_tantrico", emoji: "💋", nombre: "Beso tántrico", tipo: "timer", minutos: [5, 10],
      como: "Un juego de besos lentos con tiempo. Cada 30 segundos cambia la consigna. Respiren juntos y vayan lento.",
      cartas: ["Mírense a los ojos y respiren juntos.", "Beso lento, solo con los labios.", "Besos suaves en la cara.", "Bajen al cuello.", "Las manos solo acarician el pelo.", "Beso más profundo, sin apuro.", "Uno besa, el otro se queda quieto.", "Cambio de roles.", "Besos por los hombros y los brazos.", "Besos donde quieran, despacito.", "Pausa: frente con frente, respiren.", "Final: el beso más largo que puedan."] },
    { id: "misterio", emoji: "🙈", nombre: "Objeto misterioso", tipo: "cartas",
      como: "Uno con los ojos vendados. El otro le pasa algo por la piel y tiene que adivinar qué es. Si acierta, elige la próxima consigna.",
      cartas: ["Un hielo por el cuello.", "Una pluma o un pincel por la espalda.", "Una tela suave (seda, bufanda) por los brazos.", "Tu aliento tibio cerca de la oreja.", "Una fruta fría por los labios.", "El pelo rozando la panza.", "Un cubito por la panza, bajando despacio.", "Tus labios sin besar, solo rozando.", "Una gota de crema o aceite en los hombros.", "Algo tibio (taza caliente cerca, sin quemar) y después algo frío."] },
    { id: "miel", emoji: "🍯", nombre: "Encontrá la miel", tipo: "cartas",
      como: "Uno con los ojos vendados y sin manos. El otro se pone un poquito de miel (o chocolate, crema, almíbar) en algún lugar del cuerpo. Hay que encontrarlo solo con la boca.",
      cartas: ["Miel en algún lugar del cuello.", "Chocolate en algún lugar del pecho.", "Crema en la panza.", "Miel en el hombro… o un poco más abajo.", "Almíbar en los labios: besito largo.", "Dos lugares secretos: hay que encontrar los dos.", "Elegí el lugar más atrevido que te animes 😏", "Cambio: ahora le toca al otro esconder.", "Con hielo en la boca, para contrastar frío y dulce.", "Sin vendas: se miran mientras lo buscan."] },
    { id: "postit", emoji: "🗒️", nombre: "Juego de los post-it", tipo: "info",
      como: "Cada uno pega post-it en el cuerpo del otro: verde = 'besame acá', amarillo = 'acariciame acá', rosa = 'acá me vuelve loco/a'. Después, a recorrer los post-it uno por uno hasta que no quede ninguno. Si no tienen post-it, marquen con lápiz labial o con un dedo." },
    { id: "jenga", emoji: "🧱", nombre: "Jenga picante", tipo: "info",
      como: "Si tienen un Jenga: escriban retos en los bloques (o numérenlos y usen las cartas de la app). El que saca un bloque hace el reto. Si se cae la torre, el que la tiró cumple el reto que elija el otro." },
    { id: "twister", emoji: "🌀", nombre: "Strip Twister", tipo: "cartas",
      como: "Si tienen Twister, jueguen normal. El que se cae no pierde: se saca una prenda. Si no tienen, usen estas posturas.",
      cartas: ["Mano derecha en tu pareja, pie izquierdo en el piso.", "Los dos en cuatro patas, frente a frente: el primero que se ríe, prenda.", "Abrazados y en un pie: el que apoya, prenda.", "Tu cabeza en su hombro, sin tocar el piso con las manos.", "Espalda con espalda, bajando hasta sentarse.", "Mano izquierda en su cintura, mano derecha en su pierna.", "Recostados, piernas entrelazadas, 30 segundos sin moverse."] },
    { id: "control", emoji: "👑", nombre: "Hacé lo que digo", tipo: "timer", minutos: [5, 10, 15],
      como: "Durante el tiempo, uno manda y el otro obedece (dentro de lo que acordaron). Palabra de seguridad: \"panda\". Después cambian.",
      cartas: ["Ordená una prenda menos.", "Ordená un beso donde quieras.", "Ordená un masaje, y dónde.", "Ordená que se quede quieto/a mientras lo/la provocás.", "Ordená que te diga algo al oído.", "Ordená cómo tiene que besarte.", "Ordená que cierre los ojos.", "Ordená que te desvista despacio.", "Ordená la próxima posición para estar juntos.", "Ordená lo que más ganas tengas 😏"] },
    { id: "rol", emoji: "🎭", nombre: "Juego de roles", tipo: "cartas",
      como: "Saquen una escena, inventen nombres (su alter ego picante) y no salgan del personaje hasta que alguno diga \"panda\".",
      cartas: ["Dos desconocidos que se conocen en un bar.", "Masajista y cliente.", "Profe y alumno/a en clase particular.", "Jefe/a y empleado/a que se quedan hasta tarde.", "Vecinos que se cruzan en el ascensor.", "Delivery que llega a la puerta.", "Policía y sospechoso/a en un interrogatorio.", "Fotógrafo/a y modelo en una sesión.", "Primera cita que sale demasiado bien.", "Personajes de su peli o serie favorita.", "Reencuentro de ex que se siguen teniendo ganas.", "Doctor/a y paciente en una 'revisión completa'."] },
    { id: "lo_probariamos", emoji: "✅", nombre: "¿Lo probaríamos?", tipo: "coincidencias",
      como: "Cada uno responde a solas Sí / Tal vez / No. Al final solo se muestran las cosas que los dos quieren (o tal vez quieren). Nadie ve los 'no' del otro.",
      cartas: ["Ojos vendados.", "Atarse con algo suave (pañuelos, corbata).", "Juego de roles.", "Masajes con aceite completos.", "Hacerlo en otro lugar de la casa.", "Ducha o bañera juntos.", "Comida en el cuerpo (crema, chocolate, miel).", "Hielo y temperaturas.", "Que uno tenga el control toda la noche.", "Lencería o ropa especial.", "Mensajes picantes durante el día.", "Fotos picantes solo para nosotros.", "Juguetes para parejas.", "Hacerlo con música o con espejo.", "Contarnos una fantasía con detalle.", "Despertarte con mimos atrevidos.", "Una noche sin apuro, solo para jugar.", "Probar una posición nueva cada semana.", "Lugar arriesgado (siempre en privado).", "Dejar que el otro elija todo una noche."] },
    { id: "frasco", emoji: "🫙", nombre: "Frasco de deseos", tipo: "frasco",
      como: "Escriban en 'Nuestras cartas' sus deseos y fantasías. Una vez por semana sacan uno del frasco y lo cumplen juntos." },
    { id: "yo_nunca", emoji: "🙅", nombre: "Yo nunca nunca", tipo: "cartas",
      como: "Lean la frase. El que SÍ lo hizo toma un trago (o se saca una prenda) y cuenta la historia.",
      cartas: ["Yo nunca nunca pensé en vos en un momento poco apropiado.", "Yo nunca nunca te miré la cola sin que te dieras cuenta.", "Yo nunca nunca soñé algo picante con vos.", "Yo nunca nunca tuve ganas de vos en medio de la calle.", "Yo nunca nunca me puse algo pensando en provocarte.", "Yo nunca nunca te mandé un mensaje picante y me arrepentí.", "Yo nunca nunca fingí estar dormido/a para que me despiertes con mimos.", "Yo nunca nunca me imaginé un rol con vos.", "Yo nunca nunca quise probar algo y no me animé a decírtelo.", "Yo nunca nunca lo hice en un lugar arriesgado.", "Yo nunca nunca me reí en el peor momento.", "Yo nunca nunca te extrañé de forma muy picante."] },
    { id: "que_preferis", emoji: "🤔", nombre: "¿Qué preferís?", tipo: "cartas",
      como: "Respondan los dos y expliquen por qué. Si coinciden, lo hacen 😏",
      cartas: ["¿Besos lentos o con ganas?", "¿Luz prendida o apagada?", "¿Mandar o que te manden?", "¿Mañana o noche?", "¿Ducha juntos o masaje con aceite?", "¿Lencería o nada?", "¿Que te susurren o que te muerdan suave?", "¿Ojos vendados o mirándonos?", "¿Lento y largo o rápido e intenso?", "¿Cama o cualquier otro lugar de la casa?", "¿Que te despierten con mimos o dormirte después?", "¿Hielo o algo tibio?"] },
    { id: "dos_mentiras", emoji: "🤥", nombre: "Dos mentiras y una verdad", tipo: "info",
      como: "Uno dice tres cosas picantes sobre sí mismo (fantasías, cosas que hizo o que piensa). Dos son mentira. Si el otro adivina la verdad, elige un reto; si no, el que mintió elige." },
    { id: "tesoro", emoji: "🗺️", nombre: "Búsqueda del tesoro", tipo: "info",
      como: "Escondé pistas por la casa (o mandalas por mensaje). Cada pista tiene un reto: si lo cumple, recibe la siguiente. La última lleva al premio: vos 😏 (o lencería, un aceite, una sorpresa)." },
    // ---------- por mensaje / a distancia ----------
    { id: "completa", emoji: "✍️", nombre: "Completá la frase", tipo: "cartas", mandar: true,
      como: "Mandale la frase por mensaje y que la complete. Después te toca a vos.",
      cartas: ["Esta noche quiero que me…", "Lo que más me gusta de tu cuerpo es…", "Si estuvieras acá ahora, te…", "Mi fantasía con vos empieza en…", "Lo primero que te haría al verte es…", "Me volvés loco/a cuando…", "Un lugar donde me gustaría estar a solas con vos es…", "Si tuviera que elegir una sola cosa para hacerte, sería…", "Lo más atrevido que te diría ahora es…", "Me encanta cuando me…"] },
    { id: "emojis", emoji: "😏", nombre: "Mensaje en emojis", tipo: "cartas", mandar: true,
      como: "Mandale un plan picante usando SOLO emojis. Tiene que adivinar qué querés hacer.",
      cartas: ["🛁🫧🍷😏", "🎬🛋️🍿➡️🛏️🔥", "🙈🧣✋😈", "🍫💋👀", "🧊😮‍💨🔥", "👗➡️🚫😳", "💆‍♀️🫒✨😍", "🌙🛏️⏰🙃", "📸🤫❤️‍🔥", "🎭🍸💃😏"] },
    { id: "ropa", emoji: "👀", nombre: "Adiviná qué tengo puesto", tipo: "info", mandar: true,
      como: "Por mensaje: tu pareja tiene 5 intentos para adivinar qué tenés puesto (de arriba abajo). Por cada acierto, le contás un detalle más… o le das un premio cuando se vean." },
    { id: "historia", emoji: "📖", nombre: "Historia de a dos", tipo: "cartas", mandar: true,
      como: "Escriban una historia picante de a una oración cada uno, por mensaje. Empiecen con una de estas.",
      cartas: ["Esa noche se cortó la luz y…", "Llegaste a casa y me encontraste…", "En el ascensor nos quedamos solos y…", "Me desperté y vos ya estabas…", "En la fiesta te llevé de la mano hasta…", "Me escribiste 'vení ya' y cuando llegué…"] },
    { id: "veinte", emoji: "❓", nombre: "20 preguntas picantes", tipo: "info", mandar: true,
      como: "Uno piensa una fantasía o algo que quiere hacer. El otro tiene 20 preguntas de sí o no para adivinarla. Si adivina, se cumple." },
    { id: "un_dia", emoji: "📅", nombre: "Día de 'cualquier cosa'", tipo: "info", mandar: true,
      como: "Acuerden límites y un día. Durante ese día se pueden mandar retos o mensajes picantes en cualquier momento y hay que cumplirlos (o compensarlos a la noche)." },
  ];

  const azar = (l) => l[Math.floor(Math.random() * l.length)];
  globalThis.Juegos18 = { JUEGOS, azar };
})();
