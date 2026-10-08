// =============================================================
//  APP PRINCIPAL: pantallas, acciones y avisos entre los dos
// =============================================================
(function () {
  const R = Reglas, F = Frases, P = Puente;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  let D = null;         // datos (Supabase o demo)
  let E = null;         // estado: { pareja, yo, otro, mascota, hoy }
  let panda = null;
  let vista = "panda";
  let eventos = [];
  let tipoMensaje = "mensaje";
  let chatPanda = [];   // historial de la charla con el panda (Gemini)
  let usoGemini = 0;
  let sinLeer = 0;
  let modo = null;      // null | "banio" | "juego": modos especiales de la pantalla del panda
  const fotosCache = new Map();

  const nombres = () => ({ yo: E?.yo?.nombre || "vos", otro: E?.otro?.nombre || "tu pareja", panda: E?.mascota?.nombre || "Pandi" });

  // ---------------------------------------------------------------
  //  ARRANQUE
  // ---------------------------------------------------------------
  async function arrancar() {
    const pc = new Panda($("#panda-carga"), { etapa: 0 });
    pc.setAnimo("dormido");
    try {
      D = await crearDatos();
      E = await D.iniciar();
    } catch (e) {
      $("#app").innerHTML = `<div class="inicio"><h1>Uy 😢</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
      return;
    }
    if (!E.pareja) mostrarInicio();
    else await mostrarPrincipal();
  }

  // ---------------------------------------------------------------
  //  INICIO: crear o unirse a una pareja
  // ---------------------------------------------------------------
  function mostrarInicio() {
    $("#app").innerHTML = `
      <div class="inicio">
        ${D.modo === "demo" ? `<span class="chip-demo">Modo demo · sin conexión</span>` : ""}
        <h1>Nuestro <span>panda</span></h1>
        <p>Un panda que crece con el amor que se dan. Aliméntenlo, denle mimos y dedíquense frases para que crezca feliz.</p>
        <div class="inicio-panda" id="panda-inicio"></div>
        <div class="botones">
          <button class="btn btn-ancho" data-ir="crear">🥚 Crear nuestro panda</button>
          ${D.modo === "demo" ? "" : `<button class="btn btn-sec btn-ancho" data-ir="unirse">💌 Tengo un código</button>
          <button class="btn-chico" data-ir="recuperar" style="color:var(--suave);font-weight:800">Cambié de celular / recuperar mi lugar</button>`}
        </div>
      </div>`;
    const p = new Panda($("#panda-inicio"), { etapa: 0 });
    p.setAnimo("feliz");
    setTimeout(() => p.reaccion("saludo"), 600);
    $$("[data-ir]").forEach((b) => b.addEventListener("click", () => formularioInicio(b.dataset.ir)));
  }

  function formularioInicio(tipo) {
    const formularios = {
      crear: `<h2>🥚 Crear nuestro panda</h2>
        <div class="campo"><label>Tu nombre</label><input id="f-nombre" maxlength="30" autocomplete="given-name" placeholder="Ej: Facu"></div>
        <div class="campo"><label>Nombre del panda</label><input id="f-panda" maxlength="20" value="Pandi"></div>
        ${D.modo === "demo" ? `<div class="campo"><label>Nombre de tu pareja (simulada)</label><input id="f-otro" maxlength="30" value="Sofi"></div>` : ""}
        <button class="btn btn-ancho" id="f-ok">Crear</button>`,
      unirse: `<h2>💌 Unirme a nuestro panda</h2>
        <p class="nota" style="margin-bottom:12px">Pedile a tu pareja el código de 6 letras que le apareció al crear el panda.</p>
        <div class="campo"><label>Código</label><input id="f-codigo" maxlength="6" style="text-transform:uppercase;letter-spacing:4px;font-size:1.3rem" autocapitalize="characters"></div>
        <div class="campo"><label>Tu nombre</label><input id="f-nombre" maxlength="30" autocomplete="given-name"></div>
        <button class="btn btn-ancho" id="f-ok">Unirme</button>`,
      recuperar: `<h2>🔑 Recuperar mi lugar</h2>
        <p class="nota" style="margin-bottom:12px">Usá el código de la pareja y tu clave personal de recuperación (la que te mostró la app al empezar).</p>
        <div class="campo"><label>Código de la pareja</label><input id="f-codigo" maxlength="6" style="text-transform:uppercase"></div>
        <div class="campo"><label>Tu clave de recuperación</label><input id="f-clave" maxlength="8" style="text-transform:uppercase"></div>
        <button class="btn btn-ancho" id="f-ok">Recuperar</button>`,
    };
    abrirHoja(formularios[tipo]);
    $("#f-ok").addEventListener("click", async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try {
        let r;
        if (tipo === "crear") {
          const nombre = $("#f-nombre").value.trim();
          if (!nombre) throw new Error("Escribí tu nombre");
          r = await D.crearPareja(nombre, $("#f-panda").value.trim() || "Pandi", $("#f-otro")?.value.trim() || "Sofi");
        } else if (tipo === "unirse") {
          const nombre = $("#f-nombre").value.trim();
          if (!nombre) throw new Error("Escribí tu nombre");
          r = await D.unirse($("#f-codigo").value, nombre);
        } else {
          r = await D.recuperar($("#f-codigo").value, $("#f-clave").value);
        }
        if (r?.clave) guardar("panda-clave", r.clave);
        if (r?.codigo) guardar("panda-codigo", r.codigo);
        E = await D.estado();
        cerrarHoja();
        await mostrarPrincipal();
        if (r?.clave) mostrarClaves(r.codigo, r.clave, tipo === "crear");
      } catch (e) {
        aviso(e.message); b.disabled = false;
      }
    });
  }

  function mostrarClaves(codigo, clave, esCreador) {
    abrirHoja(`<h2>${esCreador ? "¡Nació su panda! 🐣" : "¡Ya están juntos! 💗"}</h2>
      ${esCreador && D.modo !== "demo" ? `<p class="nota">Pasale este código a tu pareja para que se una:</p><div class="codigo" style="margin:10px 0 16px">${esc(codigo)}</div>` : ""}
      <p class="nota">Tu <b>clave de recuperación</b> (guardala, por ejemplo con una captura). Sirve si cambiás de celular o se borran los datos:</p>
      <div class="codigo" style="margin:10px 0 18px;font-size:1.4rem;letter-spacing:4px">${esc(clave)}</div>
      <button class="btn btn-ancho" onclick="document.getElementById('hoja-fondo').click()">¡Listo!</button>`);
  }

  // ---------------------------------------------------------------
  //  PRINCIPAL
  // ---------------------------------------------------------------
  async function mostrarPrincipal() {
    $("#app").innerHTML = `
      <div class="principal">
        <header class="cabecera">
          <div class="cab-fila">
            <div><div class="cab-nombre" id="c-nombre"></div><div class="cab-etapa" id="c-etapa"></div></div>
            <div class="cab-nivel" id="c-nivel"></div>
          </div>
          <div class="barra-amor" title="Amor"><span id="c-barra"></span></div>
          <div class="cab-faltan" id="c-faltan"></div>
          <div class="chips">
            <span class="chip chip-racha" id="c-racha"></span>
            <button class="chip chip-monedas" id="c-monedas" title="Monedas"></button>
            <span class="chip" id="c-otro"></span>
          </div>
          <div class="medidores">
            <div class="med" title="Panza llena"><i>🎋</i><span><b id="m-hambre"></b></span></div>
            <div class="med" title="Limpieza"><i>🛁</i><span><b id="m-limpieza"></b></span></div>
            <div class="med" title="Energía"><i>⚡</i><span><b id="m-energia"></b></span></div>
            <div class="med" title="Cariño"><i>💗</i><span><b id="m-carino"></b></span></div>
          </div>
        </header>
        <section class="vista" data-vista="panda">
          <div class="escena" id="escena">
            <span class="escena-deco" style="left:18px;top:40px">☁️</span>
            <span class="escena-deco" style="right:30px;top:70px;font-size:22px">☁️</span>
            <svg class="escena-bambu" viewBox="0 0 60 160" style="left:6px"><g fill="#7cc36b"><rect x="10" y="20" width="9" height="140" rx="4"/><rect x="30" y="50" width="8" height="110" rx="4"/><rect x="44" y="0" width="7" height="160" rx="3"/></g><g fill="#5ea54d"><rect x="10" y="60" width="9" height="3"/><rect x="10" y="105" width="9" height="3"/><rect x="30" y="90" width="8" height="3"/><rect x="44" y="45" width="7" height="3"/><rect x="44" y="100" width="7" height="3"/></g><g fill="#8fd47c"><path d="M19 58 q14-10 22-2 q-12 4-22 2z"/><path d="M38 88 q12-12 20-4 q-10 6-20 4z"/><path d="M10 102 q-10-10-4-16 q4 10 4 16z"/><path d="M51 42 q10-8 9 2 q-6 0-9-2z"/></g></svg>
            <svg class="escena-bambu" viewBox="0 0 60 160" style="right:4px;transform:scaleX(-1);height:120px"><g fill="#7cc36b"><rect x="14" y="30" width="9" height="130" rx="4"/><rect x="34" y="60" width="8" height="100" rx="4"/></g><g fill="#5ea54d"><rect x="14" y="80" width="9" height="3"/><rect x="34" y="105" width="8" height="3"/></g><g fill="#8fd47c"><path d="M23 78 q14-10 22-2 q-12 4-22 2z"/><path d="M34 102 q-12-10-18-2 q10 4 18 2z"/></g></svg>
            <div class="tina" aria-hidden="true"></div>
            <div class="burbuja" id="burbuja" hidden></div>
            <div class="escena-panda" id="escena-panda" aria-label="Tocá al panda para hacerle mimos"></div>
            <span class="estado-animo" id="estado-animo"></span>
            <div class="cartel" id="cartel" hidden></div>
            <div class="banio-panel" id="banio-panel" hidden>
              <p id="banio-txt">Frotá a tu panda con el dedo 🧼</p>
              <div class="medidor"><i id="banio-barra" style="width:0%"></i></div>
              <div class="banio-botones"><button class="btn btn-sec btn-chico" id="banio-salir">✕ Salir</button><button class="btn btn-chico" id="banio-ducha" hidden>🚿 Enjuagar</button></div>
            </div>
          </div>
          <div class="despedida" id="despedida" hidden></div>
          <div class="frase-dia" id="frase-dia" hidden></div>
          <div id="zona-acciones">
            <h3 class="sub-acciones">🐼 Cuidarlo</h3>
            <div class="acciones">
              <button class="accion" data-accion="comida"><i>🎋</i>Bambú<small>+5 💗</small></button>
              <button class="accion" data-accion="heladera"><i>🍎</i>Heladera<small id="a-heladera">comida</small></button>
              <button class="accion" data-accion="banio"><i>🛁</i>Bañar<small>+4 💗</small></button>
              <button class="accion" data-accion="dormir" id="b-dormir"><i>😴</i>Dormir<small>apagar luz</small></button>
              <button class="accion" data-accion="caricia"><i>🤗</i>Mimos<small>+2 💗</small></button>
              <button class="accion" data-accion="jugar"><i>🎮</i>Jugar<small>gana 🪙</small></button>
            </div>
            <h3 class="sub-acciones">💞 Entre nosotros</h3>
            <div class="acciones">
              <button class="accion amor" data-accion="frase"><i>💌</i>Frase<small>+8 💗</small></button>
              <button class="accion amor" data-accion="sentir"><i>💭</i>¿Cómo estás?<small>contale</small></button>
              <button class="accion amor" data-accion="foto"><i>📸</i>Foto<small>+5 💗</small></button>
              <button class="accion amor" data-accion="necesito_amor"><i>📳</i>Necesito amor<small>le vibra</small></button>
              <button class="accion" data-accion="ubicacion"><i>📍</i>¿Dónde estás?<small>ubicación</small></button>
              <button class="accion" data-accion="hablar"><i>💬</i>Hablar<small>con IA</small></button>
            </div>
          </div>
          <div class="tarjeta tarjeta-ubic" id="tarjeta-ubic" hidden></div>
          <div class="tarjeta pregunta-dia" id="pregunta-dia"></div>
        </section>
        <section class="vista" data-vista="mensajes" hidden>
          <h2 class="titulo-vista">Mensajes 💌</h2>
          <div class="chat" id="chat"></div>
        </section>
        <section class="vista" data-vista="tienda" hidden><div id="tienda"></div></section>
        <section class="vista" data-vista="recuerdos" hidden><div id="recuerdos"></div></section>
        <section class="vista" data-vista="ajustes" hidden><div id="ajustes"></div></section>
        <input type="file" id="f-foto" accept="image/*" hidden>
        <nav class="pestanas">
          <button class="pestana activa" data-pestana="panda"><i>🐼</i>Panda</button>
          <button class="pestana" data-pestana="mensajes"><i>💌</i>Mensajes<span class="punto" id="punto-msj" hidden></span></button>
          <button class="pestana" data-pestana="tienda"><i>🛍️</i>Tienda<span class="punto" id="punto-tienda" hidden></span></button>
          <button class="pestana" data-pestana="recuerdos"><i>🌸</i>Recuerdos</button>
          <button class="pestana" data-pestana="ajustes"><i>⚙️</i>Ajustes</button>
        </nav>
      </div>`;

    panda = new Panda($("#escena-panda"), { etapa: R.etapaDe(E.mascota.amor).indice });
    actualizarTodo(false);

    $$("[data-pestana]").forEach((b) => b.addEventListener("click", () => irA(b.dataset.pestana)));
    $$("[data-accion]").forEach((b) => b.addEventListener("click", () => tocarAccion(b.dataset.accion)));
    $("#escena-panda").addEventListener("click", tocarPanda);
    $("#c-monedas").addEventListener("click", () => irA("tienda"));
    $("#f-foto").addEventListener("change", fotoElegida);
    prepararBanio();
    document.addEventListener("pointermove", (e) => panda?.mirarA(e.clientX, e.clientY), { passive: true });

    D.suscribir(alRecibir);
    activarPush();
    try { eventos = await D.eventos({ limite: 80 }); } catch {}
    try { usoGemini = await D.usoGemini(); } catch {}
    pintarPregunta();
    pintarTarjetaUbicacion();
    revisarDesafiosPendientes();

    // saludo (una vez por apertura)
    const m0 = E.mascota;
    const saludoInicial = m0.se_fue ? null
      : m0.amor === 0 && (m0.comidas_total || 0) === 0 ? `¡Hola! Soy ${nombres().panda}. Recién nací y tengo hambre… ¿me das bambú?`
      : m0.aviso_abandono > 0 ? F.frase(`aviso_abandono_${Math.min(2, m0.aviso_abandono)}`, nombres())
      : m0.durmiendo ? null
      : F.saludo(nombres());
    if (saludoInicial) setTimeout(() => decir(saludoInicial), 700);
    setTimeout(revisarFraseDelDia, 2500);
    procesarParametros();
    setInterval(() => actualizarTodo(false), 60000); // hambre y ánimo cambian con el tiempo
    vigilarVersion();
    if (D.modo === "supabase") document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") { E = await D.revisar(); actualizarTodo(false); eventos = await D.eventos({ limite: 80 }); if (vista === "mensajes") pintarChat(); pintarPregunta(); pintarTarjetaUbicacion(); }
    });
  }

  // Notificaciones push: sube el token de este celular a Supabase (para que lleguen con la app cerrada).
  // Si todo está listo (Vercel con Firebase + base actualizada), el panda flotante deja de repetirlas.
  async function activarPush() {
    if (D.modo !== "supabase" || !P.esAndroid()) return;
    let token = "";
    for (let i = 0; i < 6 && !token; i++) { token = P.tokenPush(); if (!token) await esperar(2500); }
    if (!token) return;
    let servidor = false;
    try { const r = await fetch("/api/config?solo=version", { cache: "no-store" }); servidor = r.ok && !!(await r.json()).push; } catch {}
    try { await D.guardarTokenPush(token); P.pushListo(servidor); }
    catch { P.pushListo(false); } // base sin actualizar: sigue avisando el panda flotante
  }

  // Si en Vercel hay una versión nueva de la web, se recarga sola al volver a la app
  // (así nunca queda una versión vieja guardada en el celular)
  let versionWeb = null;
  async function versionPublicada() {
    try {
      const r = await fetch("/api/config?solo=version", { cache: "no-store" });
      if (r.ok) return (await r.json()).version || null;
    } catch {}
    return null;
  }
  async function vigilarVersion() {
    if (D.modo !== "supabase") return;
    versionWeb = await versionPublicada();
    const revisar = async () => {
      const v = await versionPublicada();
      // no recarga si está escribiendo o con una ventana abierta
      const ocupada = !$("#hoja").hidden || modo || document.activeElement?.matches?.("input, textarea");
      if (v && versionWeb && v !== versionWeb && !ocupada) location.reload();
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisar(); });
    setInterval(revisar, 30 * 60000);
  }

  function actualizarTodo(animarCrecimiento = true) {
    const m = E.mascota, et = R.etapaDe(m.amor), an = R.animoVisible(m);
    $("#c-nombre").textContent = m.nombre;
    $("#c-etapa").textContent = `${et.emoji} ${et.nombre}`;
    $("#c-nivel").textContent = `Nivel ${R.nivelDe(m.amor)}`;
    $("#c-barra").style.width = (et.progreso * 100).toFixed(1) + "%";
    $("#c-faltan").textContent = et.siguiente ? `💗 ${m.amor} de amor · faltan ${et.faltan} para ${et.siguiente.nombre}` : `💗 ${m.amor} de amor · ¡llegó a la última etapa!`;
    $("#c-racha").textContent = `🔥 ${m.racha} ${m.racha === 1 ? "día" : "días"}`;
    $("#c-racha").title = `Racha: días seguidos en que los dos lo cuidaron. Mejor racha: ${m.mejor_racha}`;
    $("#c-monedas").textContent = `🪙 ${m.monedas ?? 0}`;
    $("#c-otro").textContent = E.otro ? `💞 ${E.otro.nombre}` : "⏳ Esperando a tu pareja";
    medidor("#m-hambre", 1 - R.hambre(m));
    medidor("#m-limpieza", R.limpieza(m));
    medidor("#m-energia", R.energia(m) / 100);
    medidor("#m-carino", R.carino(m));
    $("#estado-animo").textContent = `${an.emoji} ${an.texto}`;
    $("#escena").classList.toggle("noche", !!m.durmiendo || (an.clave === "sueno"));
    $("#escena").classList.toggle("luz-apagada", !!m.durmiendo);
    const bd = $("#b-dormir");
    bd.innerHTML = m.durmiendo ? `<i>☀️</i>Despertar<small>prender luz</small>` : `<i>😴</i>Dormir<small>apagar luz</small>`;
    const cant = Object.values(m.inventario || {}).reduce((a, b) => a + b, 0);
    $("#a-heladera").textContent = `${cant} ${cant === 1 ? "comida" : "comidas"}`;
    // aviso de abandono
    const dias = R.diasSinCuidado(m), cartel = $("#cartel");
    if (!m.se_fue && (m.aviso_abandono > 0 || dias >= 2)) {
      const faltan = R.diasParaIrse(m);
      cartel.hidden = false;
      cartel.innerHTML = `🥺 <b>${esc(m.nombre)} se siente solo.</b> ${faltan <= 1 ? "¡Si hoy nadie lo cuida, se va!" : `Si nadie lo cuida en ${faltan} días, agarra su mochila y se va.`}`;
    } else cartel.hidden = true;
    if (panda) {
      const antes = panda.etapa;
      panda.setEtapa(et.indice);
      panda.setAnimo(an.clave);
      panda.setAccesorios(m.puestos || []);
      if (modo !== "banio") panda.setLimpieza(R.limpieza(m));
      if (animarCrecimiento && et.indice > antes) setTimeout(() => decir(F.frase("crecer", { etapa: et.nombre })), 400);
    }
    pintarDespedida();
    const fd = $("#frase-dia");
    if (m.frase_dia && m.frase_fecha === E.hoy) { fd.hidden = false; fd.innerHTML = `<b>Frase del día de ${esc(m.nombre)}</b>${esc(m.frase_dia)}`; }
    else fd.hidden = true;
  }

  function irA(v) {
    vista = v;
    $$(".vista").forEach((s) => (s.hidden = s.dataset.vista !== v));
    $$("[data-pestana]").forEach((b) => b.classList.toggle("activa", b.dataset.pestana === v));
    $(".escribir")?.remove();
    if (v === "mensajes") { sinLeer = 0; $("#punto-msj").hidden = true; pintarChat(); }
    if (v === "recuerdos") pintarRecuerdos();
    if (v === "tienda") pintarTienda();
    if (v !== "panda" && modo === "banio") salirBanio();
    if (v === "ajustes") pintarAjustes();
    window.scrollTo({ top: 0 });
  }

  // ---------------------------------------------------------------
  //  HABLAR (globo + voz + boca)
  // ---------------------------------------------------------------
  let tGlobo;
  async function decir(texto, { mostrar = true } = {}) {
    if (!texto) return;
    const g = $("#burbuja");
    if (g && mostrar) {
      g.textContent = texto; g.hidden = false;
      clearTimeout(tGlobo);
      tGlobo = setTimeout(() => (g.hidden = true), Math.max(4000, texto.length * 75));
    }
    if (!panda) return;
    panda.hablando(true);
    await Voz.hablar(texto, {
      alInicio: () => panda.hablando(true),
      alNivel: (n) => (panda.nivelVoz = n),
    });
    panda.hablando(false);
  }

  // ---------------------------------------------------------------
  //  ACCIONES
  // ---------------------------------------------------------------
  function tocarAccion(a) {
    if (E.mascota.se_fue && ["comida", "heladera", "banio", "dormir", "caricia", "jugar"].includes(a)) return aviso("Su panda se fue 🎒");
    if (a === "heladera") return abrirHeladera();
    if (a === "banio") return entrarBanio();
    if (a === "dormir") return hacer(E.mascota.durmiendo ? "despertar" : "dormir");
    if (a === "jugar") return abrirJuego();
    if (a === "sentir") return formularioSentir();
    if (a === "foto") return elegirFoto();
    if (a === "frase") return formularioFrase();
    if (a === "ubicacion") return menuUbicacion();
    if (a === "hablar") return abrirChatPanda();
    if (a === "necesito_amor") return confirmarNecesitoAmor();
    hacer(a);
  }

  async function hacer(tipo, texto = null) {
    if (!E.otro && ["necesito_amor", "pedir_ubicacion"].includes(tipo)) return aviso("Primero tu pareja se tiene que unir con el código");
    // reacción inmediata (no espera a internet)
    const dormido = E.mascota.durmiendo;
    if (dormido && ["comida", "comer"].includes(tipo)) return decir("Shh… está durmiendo. Despertalo primero ☀️");
    if (tipo === "comida" || tipo === "comer") panda.reaccion("comida");
    if (tipo === "caricia") panda.reaccion("caricia");
    if (tipo === "frase") panda.reaccion("amor");
    let r;
    try {
      r = await D.accion(tipo, texto);
    } catch (e) { return aviso(msjError(e)); }
    aplicarMascota(r.mascota);
    const n = { ...nombres(), racha: r.racha, item: texto && R.TIENDA[texto] ? R.TIENDA[texto].nombre.toLowerCase() : "" };
    let dicho = null;
    if (r.nota === "lleno") dicho = F.frase("lleno", n);
    else if (r.nota === "limpio") dicho = F.frase("limpio", n);
    else if (tipo === "banio") { dicho = F.frase("banio_listo", n); panda.reaccion("amor"); }
    // de noche siempre tiene sueño (aunque la barra de energía esté alta): no decir "no tengo sueño"
    else if (tipo === "dormir") dicho = F.frase(r.nota === "sin_sueno" && !R.esDeNoche() ? "sin_sueno" : "a_dormir", n);
    else if (tipo === "despertar") { dicho = F.frase(r.nota === "sueno" ? "sueno_despertar" : "despertar", n); panda.reaccion(r.nota === "sueno" ? "bostezo" : "saludo"); }
    else if (tipo === "comer") dicho = F.frase("comer_item", n);
    else if (tipo === "sentir") dicho = F.frase("sentir_enviado", n);
    else if (tipo === "caricia" && dormido) dicho = Math.random() < 0.5 ? F.frase("durmiendo_toque", n) : null;
    else if (r.nota === "tope_caricias") dicho = F.frase("tope_caricias", n);
    else if (tipo === "comida") dicho = F.frase("comida", n);
    else if (tipo === "caricia") dicho = Math.random() < 0.6 ? F.frase("caricia", n) : null;
    else if (tipo === "frase") dicho = F.frase("frase", n);
    else if (tipo === "necesito_amor") { dicho = F.frase("necesito_amor_enviado", n); panda.reaccion("necesita"); }
    else if (tipo === "pedir_ubicacion") dicho = F.frase("pedir_ubicacion", n);
    if (r.nota === "racha") { panda.reaccion("amor"); dicho = F.frase("racha", n); }
    const ganadas = r.monedas_ganadas || 0;
    if (r.sumo + r.extra > 0 || ganadas) aviso([r.sumo + r.extra > 0 ? `+${r.sumo + r.extra} 💗${r.extra ? ` (racha +${r.extra})` : ""}` : "", ganadas ? `+${ganadas} 🪙` : ""].filter(Boolean).join(" · "));
    if (dicho) decir(dicho);
    if (r.analizar) analizarAnimo();
    revisarDesafiosPendientes();
    return r;
  }

  // Actualiza el panda con lo que devolvió el servidor (sin esperar al tiempo real)
  function aplicarMascota(fila) {
    if (!fila) return;
    const antes = R.etapaDe(E.mascota.amor).indice;
    E.mascota = { ...E.mascota, ...fila };
    actualizarTodo(R.etapaDe(E.mascota.amor).indice > antes);
  }

  // Mensaje de error entendible (por ej. si falta actualizar la base de datos)
  function msjError(e) {
    const t = String(e?.message || e || "");
    if (/Could not find the function|schema cache|does not exist|violates check constraint/i.test(t)) return "Falta actualizar la base: ejecutá de nuevo schema.sql en Supabase";
    if (/Failed to fetch|NetworkError|network/i.test(t)) return "Sin internet 😢";
    return t;
  }

  function formularioFrase() {
    const temas = Object.keys(F.IDEAS_FRASES);
    abrirHoja(`<h2>💌 Dedicale una frase a ${esc(nombres().otro)}</h2>
      <div class="campo"><textarea id="f-frase" maxlength="300" placeholder="Escribí lo que sientas: lindo, triste, lo que sea…"></textarea></div>
      <div class="segmentos temas" id="f-temas">${temas.map((t, i) => `<button data-tema="${esc(t)}" class="${i === 0 ? "activo" : ""}">${esc(t)}</button>`).join("")}</div>
      <div class="chips" id="f-ideas" style="margin:10px 0 14px"></div>
      <p class="nota" style="margin-bottom:12px">Las frases suman +8 💗 y quedan guardadas en Recuerdos.</p>
      <button class="btn btn-ancho" id="f-ok">Enviar con ${esc(nombres().panda)} 🐼</button>`);
    const ideas = (tema) => {
      $("#f-ideas").innerHTML = F.IDEAS_FRASES[tema].map((i) => `<button class="chip" data-idea="${esc(i)}">${esc(i)}</button>`).join("");
      $$("[data-idea]").forEach((b) => b.addEventListener("click", () => ($("#f-frase").value = b.dataset.idea)));
      $$("[data-tema]").forEach((b) => b.classList.toggle("activo", b.dataset.tema === tema));
    };
    $$("[data-tema]").forEach((b) => b.addEventListener("click", () => ideas(b.dataset.tema)));
    ideas(temas[0]);
    $("#f-ok").addEventListener("click", () => {
      const t = $("#f-frase").value.trim();
      if (!t) return aviso("Escribí la frase");
      cerrarHoja(); hacer("frase", t);
    });
  }

  function confirmarNecesitoAmor() {
    abrirHoja(`<div class="alerta-amor"><div class="grande">📳</div><h2>¿Necesitás amor?</h2>
      <p class="nota" style="margin-bottom:16px">A ${esc(nombres().otro)} le va a vibrar el celular y le va a aparecer un aviso de ${esc(nombres().panda)}.</p>
      <button class="btn btn-ancho" id="f-ok">Sí, necesito mimos 🥺</button></div>`);
    $("#f-ok").addEventListener("click", () => { cerrarHoja(); hacer("necesito_amor"); });
  }

  // ---------------------------------------------------------------
  //  UBICACIÓN (siempre con permiso de la otra persona)
  // ---------------------------------------------------------------
  async function menuUbicacion() {
    if (!E.otro) return aviso("Primero tu pareja se tiene que unir con el código");
    let u = null, mia = null;
    try { u = await D.ubicacionDe(E.otro.id); } catch {}
    try { mia = await D.ubicacionDe(E.yo.id); } catch {}
    abrirHoja(`<h2>📍 ¿Dónde está ${esc(nombres().otro)}?</h2>
      ${u ? `<p class="nota" style="margin-bottom:10px">Compartió su ubicación <b>${R.haceCuanto(u.actualizada)}</b>${u.precision_m ? ` · precisión ${Math.round(u.precision_m)} m` : ""}</p>${mapa(u)}`
          : `<p class="nota" style="margin-bottom:12px">Todavía no compartió su ubicación. Tocá "Preguntarle dónde está" y cuando acepte la vas a ver acá en el mapa.</p>`}
      <div style="display:grid;gap:10px;margin-top:14px">
        <button class="btn btn-ancho" id="u-pedir">${u ? "Pedirle una más nueva" : "Preguntarle dónde está"}</button>
        <button class="btn btn-sec btn-ancho" id="u-mia">Compartir la mía</button>
      </div>
      ${mia ? `<p class="nota" style="margin-top:12px">Tu última ubicación compartida: ${R.haceCuanto(mia.actualizada)}. <button class="btn btn-chico" id="u-ver-mia">Ver</button></p>` : ""}
      <p class="nota" style="margin-top:12px">${esc(nombres().otro)} decide si la comparte. Solo se guarda la última ubicación, no un historial.</p>`);
    $("#u-pedir").addEventListener("click", () => { cerrarHoja(); hacer("pedir_ubicacion"); });
    $("#u-mia").addEventListener("click", () => { cerrarHoja(); compartirMiUbicacion(); });
    $("#u-ver-mia")?.addEventListener("click", () => verUbicacion(mia, "Tu ubicación compartida"));
  }

  // Muestra un mapa en una ventana (al recibir la ubicación, o desde Mensajes)
  function verUbicacion(u, titulo) {
    if (!u) return menuUbicacion();
    abrirHoja(`<h2>📍 ${esc(titulo)}</h2>
      <p class="nota" style="margin-bottom:10px">Compartida ${R.haceCuanto(u.actualizada)}${u.precision_m ? ` · precisión ${Math.round(u.precision_m)} m` : ""}</p>
      ${mapa(u)}`);
  }
  async function verUbicacionDelOtro() {
    let u = null;
    try { u = await D.ubicacionDe(E.otro?.id); } catch {}
    if (!u) return menuUbicacion();
    verUbicacion(u, `Acá está ${nombres().otro}`);
  }

  // Tarjeta en la pantalla del panda con la última ubicación de la pareja
  async function pintarTarjetaUbicacion() {
    const t = $("#tarjeta-ubic");
    if (!t || !E.otro) return;
    let u = null;
    try { u = await D.ubicacionDe(E.otro.id); } catch {}
    if (!u) { t.hidden = true; return; }
    t.hidden = false;
    t.innerHTML = `<div class="fila" style="margin:0"><div>📍 <b>${esc(nombres().otro)}</b> compartió dónde está<div class="desc">${R.haceCuanto(u.actualizada)}</div></div>
      <button class="btn btn-chico" id="t-ver-ubic">Ver mapa</button></div>`;
    $("#t-ver-ubic").addEventListener("click", () => verUbicacion(u, `Acá está ${nombres().otro}`));
  }

  function mapa(u) {
    const d = 0.006, bbox = [u.lng - d, u.lat - d, u.lng + d, u.lat + d].join(",");
    return `<iframe class="mapa" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${u.lat},${u.lng}"></iframe>
      <a class="btn btn-sec btn-ancho btn-chico" style="margin-top:10px" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${u.lat},${u.lng}">Abrir en Google Maps</a>`;
  }

  async function compartirMiUbicacion() {
    aviso("Buscando tu ubicación…");
    try {
      const u = await P.obtenerUbicacion();
      await D.compartirUbicacion(u.lat, u.lng, u.prec);
      aviso("📍 Ubicación compartida con " + nombres().otro);
    } catch (e) { aviso(e.message); }
  }

  function preguntaUbicacion() {
    abrirHoja(`<div class="alerta-amor"><div class="grande">📍</div><h2>${esc(nombres().otro)} quiere saber dónde estás</h2>
      <div style="display:grid;gap:10px;margin-top:14px">
        <button class="btn btn-ancho" id="u-si">Compartir mi ubicación</button>
        <button class="btn btn-sec btn-ancho" id="u-no">Ahora no</button>
      </div></div>`);
    $("#u-si").addEventListener("click", () => { cerrarHoja(); compartirMiUbicacion(); });
    $("#u-no").addEventListener("click", cerrarHoja);
  }

  // ---------------------------------------------------------------
  //  LO QUE LLEGA DE LA OTRA PERSONA (tiempo real)
  // ---------------------------------------------------------------
  async function alRecibir({ tipo, fila }) {
    if (tipo === "mascota") {
      const antes = R.etapaDe(E.mascota.amor).indice;
      E.mascota = { ...E.mascota, ...fila };
      actualizarTodo(R.etapaDe(E.mascota.amor).indice > antes);
      return;
    }
    if (tipo === "conexion") return;
    const ev = fila;
    if (!eventos.some((x) => x.id === ev.id)) eventos.unshift(ev);
    if (vista === "mensajes") pintarChat();
    if (vista === "panda" && ev.tipo === "pregunta") pintarPregunta();
    if (ev.de === E.yo.id) return;
    if (ev.tipo === "sistema") {
      E = await D.estado(); actualizarTodo();
      const t = ev.texto || "";
      if (t.startsWith("aviso_abandono|")) { P.vibrar("aviso"); panda.reaccion("triste"); decir(F.frase(`aviso_abandono_${t.split("|")[1] === "2" ? 2 : 1}`, nombres())); }
      if (t === "nacio" && ev.de !== E.yo.id) decir(F.frase("adoptado", nombres()));
      return;
    }
    if (["compra", "desafio"].includes(ev.tipo)) return; // no hace falta avisar
    if (!E.otro) { E = await D.estado(); actualizarTodo(); }

    const n = { ...nombres(), texto: ev.texto || "", item: R.TIENDA[ev.texto]?.nombre.toLowerCase() || "" };
    let texto = F.deOtro(ev.tipo, n);
    // Si el panda flotante está activo, el aviso del sistema y la vibración los hace él
    if (!P.flotanteActivo()) P.vibrar(ev.tipo);
    if (["mensaje", "frase", "sentir", "foto"].includes(ev.tipo) && vista !== "mensajes") { sinLeer++; $("#punto-msj").hidden = false; }
    if (ev.tipo === "sentir") {
      const s = sentimientoDe(ev.texto);
      texto = (F.RESPUESTA_SENTIR[s?.id] || F.deOtro("sentir", n)).replace(/\{otro\}/g, n.otro);
      if (s && F.TRISTES.includes(s.id)) { panda.reaccion("triste"); alertaSentir(ev, s); }
      else panda.reaccion("amor");
    }
    if (ev.tipo === "foto") { panda.reaccion("sorpresa"); aviso(`📸 ${n.otro} te mandó una foto · mirala en Mensajes`); }
    if (["banio", "despertar", "dormir", "comer", "juego"].includes(ev.tipo)) { E = await D.estado(); actualizarTodo(false); }
    if (ev.tipo === "banio" || ev.tipo === "juego") panda.reaccion("amor");
    if (ev.tipo === "comer") panda.reaccion("comida");
    if (ev.tipo === "caricia") panda.reaccion("caricia");
    if (ev.tipo === "comida") panda.reaccion("comida");
    if (ev.tipo === "frase") panda.reaccion("amor");
    if (ev.tipo === "necesito_amor") alertaNecesitaAmor();
    if (ev.tipo === "pedir_ubicacion") {
      if (E.yo.compartir_auto) compartirMiUbicacion(); else preguntaUbicacion();
    }
    if (ev.tipo === "ubicacion") {
      pintarTarjetaUbicacion();
      if ($("#hoja").hidden) verUbicacionDelOtro(); else aviso(`📍 ${n.otro} compartió dónde está · mirala en el mapa de "¿Dónde estás?"`);
    }
    if (texto && !["necesito_amor", "pedir_ubicacion"].includes(ev.tipo)) decir(texto);
    else if (texto) decir(texto, { mostrar: false });
  }

  function alertaNecesitaAmor() {
    const n = nombres();
    panda.reaccion("necesita");
    abrirHoja(`<div class="alerta-amor"><div class="grande">💗</div><h2>¡${esc(n.otro)} necesita amor!</h2>
        <p class="nota" style="margin-bottom:16px">Mandale mimos o una frase linda.</p>
        <div style="display:grid;gap:10px"><button class="btn btn-ancho" id="a-mimo">🤗 Mandar mimos</button><button class="btn btn-sec btn-ancho" id="a-frase">💌 Mandar una frase</button></div></div>`);
      $("#a-mimo").addEventListener("click", () => { cerrarHoja(); hacer("caricia"); });
    $("#a-frase").addEventListener("click", formularioFrase);
  }

  // ---------------------------------------------------------------
  //  MENSAJES
  // ---------------------------------------------------------------
  function pintarChat() {
    const lista = eventos.slice().reverse();
    const yoId = E.yo.id;
    const nombreDe = (id) => (id === yoId ? E.yo.nombre : E.otro?.nombre || "");
    const sistema = {
      comida: "le dio bambú 🎋", caricia: "le hizo mimos 🤗", necesito_amor: "necesita amor 💗", pedir_ubicacion: "preguntó dónde estás 📍", ubicacion: "compartió su ubicación 📍",
      banio: `bañó a ${esc(E.mascota.nombre)} 🛁`, dormir: `acostó a ${esc(E.mascota.nombre)} 😴`, despertar: `despertó a ${esc(E.mascota.nombre)} ☀️`,
      comer: "le dio de comer", juego: `jugó con ${esc(E.mascota.nombre)} 🎮`, pregunta: "respondió la pregunta del día ❓",
    };
    // agrupar mimos seguidos para no llenar el chat
    const filas = [];
    for (const e of lista) {
      if (e.tipo === "mensaje" || e.tipo === "frase" || e.tipo === "sentir") {
        filas.push(`<div class="msj ${e.tipo === "mensaje" ? "" : e.tipo} ${e.de === yoId ? "mio" : "suyo"}">${esc(e.texto)}<small>${R.fechaCorta(e.creado)}</small>
          <button class="fav" data-fav="${e.id}" title="Guardar en recuerdos">${e.favorito ? "💖" : "🤍"}</button></div>`);
      } else if (e.tipo === "foto") {
        filas.push(`<div class="msj foto ${e.de === yoId ? "mio" : "suyo"}"><button class="foto-btn" data-ver-foto="${e.ref}"><img data-foto="${e.ref}" alt="Foto"></button>${e.texto && e.texto !== "📸" ? esc(e.texto) : ""}<small>${R.fechaCorta(e.creado)}</small>
          <button class="fav" data-fav="${e.id}" title="Guardar en recuerdos">${e.favorito ? "💖" : "🤍"}</button></div>`);
      } else if (e.tipo === "sistema") {
        const [clave, nom, , diasVivo] = String(e.texto || "").split("|");
        if (clave === "se_fue") filas.push(`<div class="sistema">🎒 ${esc(nom)} se fue después de ${diasVivo} días · ${R.fechaCorta(e.creado)}</div>`);
        else if (clave === "aviso_abandono") filas.push(`<div class="sistema">🥺 ${esc(E.mascota.nombre)} se siente solo · ${R.fechaCorta(e.creado)}</div>`);
        else filas.push(`<div class="sistema">🐣 Nació ${esc(E.mascota.nombre)} · ${R.fechaCorta(e.creado)}</div>`);
      } else if (e.tipo === "ubicacion") {
        const quien = esc(nombreDe(e.de));
        filas.push(`<button class="sistema sistema-ubic" data-ver-ubic="${e.de}">📍 ${quien} compartió su ubicación · ${R.fechaCorta(e.creado)} · <u>ver mapa</u></button>`);
      } else if (sistema[e.tipo]) {
        const extraTxt = e.tipo === "comer" ? ` ${R.TIENDA[e.texto]?.emoji || ""}` : e.tipo === "juego" ? ` (${esc(e.texto)} pts)` : "";
        const txt = `${esc(nombreDe(e.de))} ${sistema[e.tipo]}${extraTxt}`;
        const ult = filas[filas.length - 1];
        if (ult && ult.includes(`data-t="${txt}"`)) {
          filas[filas.length - 1] = ult.replace(/data-n="(\d+)"[^<]*/, (_, k) => `data-n="${+k + 1}" data-t="${txt}">${txt} ×${+k + 1}`);
        } else filas.push(`<div class="sistema" data-n="1" data-t="${txt}">${txt}</div>`);
      }
    }
    $("#chat").innerHTML = filas.join("") || `<div class="sistema">Todavía no hay mensajes. ¡Escribí el primero!</div>`;
    cargarFotos($("#chat"));
    $$("[data-ver-foto]").forEach((b) => b.addEventListener("click", () => verFoto(b.dataset.verFoto)));
    $$("[data-ver-ubic]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.verUbic, esMia = id === E.yo.id;
      let u = null; try { u = await D.ubicacionDe(id); } catch {}
      if (!u) return aviso("Ya no está guardada");
      verUbicacion(u, esMia ? "Tu ubicación compartida" : `Acá está ${nombres().otro}`);
    }));
    $$("[data-fav]").forEach((b) => b.addEventListener("click", async () => {
      const id = +b.dataset.fav, e = eventos.find((x) => x.id === id);
      e.favorito = !e.favorito; b.textContent = e.favorito ? "💖" : "🤍";
      try { await D.favorito(id, e.favorito); } catch (er) { aviso(er.message); }
    }));
    if (!$(".escribir")) {
      const f = document.createElement("form");
      f.className = "escribir";
      f.innerHTML = `<button type="button" class="tipo" id="m-tipo">💬 Mensaje</button><input id="m-texto" maxlength="300" placeholder="Escribile a ${esc(nombres().otro)}…" autocomplete="off"><button class="enviar" aria-label="Enviar">➤</button>`;
      document.body.appendChild(f);
      $("#m-tipo").addEventListener("click", () => {
        tipoMensaje = tipoMensaje === "mensaje" ? "frase" : "mensaje";
        $("#m-tipo").textContent = tipoMensaje === "frase" ? "💌 Frase" : "💬 Mensaje";
        $("#m-tipo").classList.toggle("frase", tipoMensaje === "frase");
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const t = $("#m-texto").value.trim();
        if (!t) return;
        $("#m-texto").value = "";
        try {
          const r = await D.accion(tipoMensaje, t);
          if (r.sumo + r.extra > 0) aviso(`+${r.sumo + r.extra} 💗`);
          if (r.analizar) analizarAnimo();
        } catch (er) { aviso(er.message); }
      });
    }
    window.scrollTo({ top: document.body.scrollHeight });
  }

  // ---------------------------------------------------------------
  //  RECUERDOS
  // ---------------------------------------------------------------
  async function pintarRecuerdos() {
    const m = E.mascota, et = R.etapaDe(m.amor);
    const dias = Math.max(1, Math.ceil((Date.now() - new Date(m.nacio)) / 86400e3));
    let favs = [];
    try { favs = await D.eventos({ limite: 50, favoritos: true }); } catch {}
    const frases = eventos.filter((e) => e.tipo === "frase").slice(0, 10);
    let anteriores = [];
    try { anteriores = (await D.eventos({ limite: 30, tipos: ["sistema"] })).filter((e) => String(e.texto).startsWith("se_fue|")); } catch {}
    $("#recuerdos").innerHTML = `
      <h2 class="titulo-vista">Recuerdos 🌸</h2>
      <div class="tarjeta"><div class="stats">
        <div><b>${dias}</b><span>días juntos</span></div>
        <div><b>${m.mejor_racha}</b><span>mejor racha</span></div>
        <div><b>${m.amor}</b><span>amor total</span></div>
        <div><b>${m.comidas_total}</b><span>bambúes</span></div>
        <div><b>${m.caricias_total}</b><span>mimos</span></div>
        <div><b>${m.frases_total}</b><span>frases</span></div>
        <div><b>${m.banios_total || 0}</b><span>baños</span></div>
        <div><b>${m.juegos_total || 0}</b><span>juegos</span></div>
        <div><b>${(m.accesorios || []).length}</b><span>accesorios</span></div>
      </div></div>
      <div class="tarjeta"><h3>Cómo va creciendo</h3><div class="etapas">
        ${R.ETAPAS.map((e, i) => `<div class="etapa-mini ${i > et.indice ? "bloqueada" : ""} ${i === et.indice ? "actual" : ""}">
          <div class="dibujo">${svgPanda(i)}</div>${i > et.indice ? `🔒 ${e.desde} 💗` : `${e.emoji} ${e.nombre}`}</div>`).join("")}
      </div></div>
      <div class="tarjeta"><h3>💖 Guardados</h3><div class="lista-favs">
        ${favs.length ? favs.map((f) => `<div class="fav-item">${esc(f.texto)}<small>${f.de === E.yo.id ? E.yo.nombre : E.otro?.nombre} · ${R.fechaCorta(f.creado)}</small></div>`).join("") : `<p class="nota">Tocá el 🤍 de un mensaje para guardarlo acá para siempre.</p>`}
      </div></div>
      <div class="tarjeta"><h3>💌 Últimas frases</h3><div class="lista-favs">
        ${frases.length ? frases.map((f) => `<div class="fav-item">${esc(f.texto)}<small>${f.de === E.yo.id ? E.yo.nombre : E.otro?.nombre} · ${R.fechaCorta(f.creado)}</small></div>`).join("") : `<p class="nota">Todavía no se dedicaron frases.</p>`}
      </div></div>
      ${anteriores.length ? `<div class="tarjeta"><h3>🎒 Pandas que se fueron</h3><div class="lista-favs">
        ${anteriores.map((a) => { const [, nom, amor, dias] = a.texto.split("|"); return `<div class="fav-item">${esc(nom)} · ${R.etapaDe(+amor).emoji} ${R.etapaDe(+amor).nombre}<small>Estuvo ${dias} días con ustedes · se fue el ${R.fechaCorta(a.creado)}</small></div>`; }).join("")}
      </div></div>` : ""}`;
  }

  // ---------------------------------------------------------------
  //  AJUSTES
  // ---------------------------------------------------------------
  async function pintarAjustes() {
    try { usoGemini = await D.usoGemini(); } catch {}
    const lim = D.limiteGemini || 60;
    const clave = leer("panda-clave", "");
    const android = P.esAndroid();
    const perm = android ? P.permisos() : {};
    $("#ajustes").innerHTML = `
      <h2 class="titulo-vista">Ajustes ⚙️</h2>
      ${android ? `<div class="tarjeta"><h3>🐼 Panda en la pantalla</h3>
        <div class="fila"><div>Panda flotante<div class="desc">Camina por la pantalla aunque uses otras apps</div></div>
          <label class="interruptor"><input type="checkbox" id="a-flotante" ${P.flotanteActivo() ? "checked" : ""}><span></span></label></div>
        <div class="fila"><div>Que se quede quieto 📌<div class="desc">No camina solo (para que no se meta cuando escribís). También: tocalo 3 veces rápido</div></div>
          <label class="interruptor"><input type="checkbox" id="a-quieto" ${P.quieto() ? "checked" : ""}><span></span></label></div>
        <div class="fila"><div>Permisos<div class="desc">${perm.flotante ? "✅" : "❌"} Mostrar sobre otras apps · ${perm.notificaciones ? "✅" : "❌"} Notificaciones · ${perm.ubicacion ? "✅" : "❌"} Ubicación · ${perm.bateria ? "✅" : "⚠️"} Sin límite de batería</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${perm.flotante ? "" : `<button class="btn btn-sec btn-chico" data-permiso="flotante">Permitir flotante</button>`}
          ${perm.notificaciones ? "" : `<button class="btn btn-sec btn-chico" data-permiso="notificaciones">Notificaciones</button>`}
          ${perm.ubicacion ? "" : `<button class="btn btn-sec btn-chico" data-permiso="ubicacion">Ubicación</button>`}
          ${perm.bateria ? "" : `<button class="btn btn-sec btn-chico" data-permiso="bateria">Batería</button>`}
        </div>
        <button class="btn btn-sec btn-ancho btn-chico" id="a-probar-push" style="margin-top:8px">🔔 Probar notificación</button>
        <button class="btn btn-sec btn-ancho btn-chico" id="a-actualizar" style="margin-top:8px">🔄 Buscar actualización${P.versionApp() ? ` (tenés la 1.${P.versionApp()})` : ""}</button>
        </div>` : ""}

      <div class="tarjeta"><h3>🔊 Voz de ${esc(nombres().panda)}</h3>
        <p class="nota" style="margin-bottom:6px">${android ? "Usa la voz del celular con tono de nene." : "Usa la voz del navegador con tono de nene."}${Voz.disponible() ? "" : " ⚠️ Este dispositivo no tiene voz en castellano: el panda va a hablar solo con globitos."}</p>
        ${android ? `<button class="btn btn-sec btn-chico" id="a-tts" style="margin-bottom:6px">Elegir otra voz del celu</button>` : ""}
        <div class="fila"><div style="flex:1">Tono de nene<div class="desc">Más a la derecha = más agudo y tierno</div>
          <input type="range" id="a-tono" min="1" max="1.7" step="0.05" value="${Voz.tono}"></div></div>
        <div class="fila"><div>Voz activada</div><label class="interruptor"><input type="checkbox" id="a-voz" ${Voz.activa ? "checked" : ""}><span></span></label></div>
        <button class="btn btn-sec btn-ancho btn-chico" id="a-probar">▶️ Probar voz</button>
      </div>

      <div class="tarjeta"><h3>🧠 Inteligencia artificial (Gemini)</h3>
        <p class="nota">Hoy usaste <b>${usoGemini}</b> de <b>${lim}</b> consultas.</p>
        <div class="medidor"><i style="width:${Math.min(100, (usoGemini / lim) * 100)}%"></i></div>
        <p class="nota">Se usa solo para: charlar con ${esc(nombres().panda)}, la frase del día (1 por día) y entender el ánimo cada 8 mensajes. Comer, mimos, vibrar, ubicación y la voz <b>no gastan</b>. Si se llega al límite, el panda responde sin IA hasta mañana.</p>
      </div>

      <div class="tarjeta"><h3>📍 Ubicación</h3>
        <div class="fila"><div>Compartir sin preguntarme<div class="desc">Cuando ${esc(nombres().otro)} pregunte, se comparte sola</div></div>
          <label class="interruptor"><input type="checkbox" id="a-auto" ${E.yo.compartir_auto ? "checked" : ""}><span></span></label></div>
      </div>

      <div class="tarjeta"><h3>💞 Nosotros</h3>
        <div class="campo"><label>Tu nombre</label><input id="a-nombre" value="${esc(E.yo.nombre)}" maxlength="30"></div>
        <div class="campo"><label>Nombre del panda</label><input id="a-panda" value="${esc(E.mascota.nombre)}" maxlength="20"></div>
        <button class="btn btn-sec btn-ancho btn-chico" id="a-guardar">Guardar nombres</button>
        <div class="fila" style="margin-top:8px"><div>Código de la pareja<div class="desc">Para que se una tu pareja</div></div><b style="letter-spacing:2px">${esc(E.pareja.codigo)}</b></div>
        ${clave ? `<div class="fila"><div>Tu clave de recuperación<div class="desc">Guardala: sirve si cambiás de celular</div></div><b style="letter-spacing:2px">${esc(clave)}</b></div>` : ""}
      </div>

      ${D.modo === "demo" ? `<div class="tarjeta"><h3>🧪 Modo demo</h3>
        <p class="nota" style="margin-bottom:10px">Simulá lo que haría ${esc(nombres().otro)}:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-sec btn-chico" data-sim="necesito_amor">📳 Necesita amor</button>
          <button class="btn btn-sec btn-chico" data-sim="caricia">🤗 Mimos</button>
          <button class="btn btn-sec btn-chico" data-sim="mensaje">💬 Mensaje</button>
          <button class="btn btn-sec btn-chico" data-sim="pedir_ubicacion">📍 Pide ubicación</button>
          <button class="btn btn-sec btn-chico" data-sim="sentir">😢 Está triste</button>
          <button class="btn btn-sec btn-chico" data-sim="foto">📸 Manda foto</button>
          <button class="btn btn-sec btn-chico" data-abandono="3.2">🥺 3 días sin cuidarlo</button>
          <button class="btn btn-sec btn-chico" data-abandono="7.5">🎒 7 días (se va)</button>
          <button class="btn btn-sec btn-chico" data-monedas="200">🪙 +200 monedas</button>
        </div>
        <div class="campo" style="margin-top:12px"><label>Vista previa de crecimiento (amor)</label><input type="range" id="a-previa" min="0" max="11000" step="100" value="${E.mascota.amor}"></div>
      </div>` : ""}

      <div class="tarjeta">
        <button class="btn btn-sec btn-ancho btn-chico" id="a-salir" style="color:#d6336c">Salir de la pareja</button>
        <p class="nota" style="margin-top:8px">${D.modo === "demo" ? "Modo demo: los datos están solo en este navegador." : "Conectado a Supabase ✅"}</p>
      </div>`;

    $$("[data-permiso]").forEach((b) => b.addEventListener("click", () => P.pedirPermiso(b.dataset.permiso)));
    $("#a-quieto")?.addEventListener("change", (e) => { P.ponerQuieto(e.target.checked); aviso(e.target.checked ? "📌 Se queda quieto donde está" : "🐾 Vuelve a pasear"); });
    $("#a-flotante")?.addEventListener("change", (e) => {
      const r = P.activarFlotante(e.target.checked);
      if (r === "permiso") { aviso("Activá \"Mostrar sobre otras apps\" y volvé"); e.target.checked = false; }
    });
    $("#a-tono").addEventListener("change", (e) => { Voz.tono = +e.target.value; decir("¡Hola! ¿Así te gusta mi voz?"); });
    $("#a-voz").addEventListener("change", (e) => { Voz.activa = e.target.checked; });
    $("#a-probar").addEventListener("click", () => decir(`Hola ${nombres().yo}, soy ${nombres().panda}. ¡Te quiero mucho!`));
    $("#a-auto").addEventListener("change", async (e) => { E = await D.ajustes({ auto: e.target.checked }); });
    $("#a-guardar").addEventListener("click", async () => {
      try { E = await D.ajustes({ nombre: $("#a-nombre").value.trim(), panda: $("#a-panda").value.trim() }); actualizarTodo(false); aviso("Guardado 💗"); } catch (er) { aviso(er.message); }
    });
    $$("[data-sim]").forEach((b) => b.addEventListener("click", () => { D.simular(b.dataset.sim); aviso("Simulado: " + b.textContent); }));
    $("#a-previa")?.addEventListener("input", (e) => { D.vistaPrevia(+e.target.value); });
    $$("[data-abandono]").forEach((b) => b.addEventListener("click", async () => { E = await D.simularAbandono(+b.dataset.abandono); actualizarTodo(false); irA("panda"); }));
    $$("[data-monedas]").forEach((b) => b.addEventListener("click", () => { D.db.mascota.monedas += +b.dataset.monedas; D.guardar(); E.mascota.monedas = D.db.mascota.monedas; actualizarTodo(false); aviso("+200 🪙"); }));
    $("#a-salir").addEventListener("click", async () => {
      if (!confirm("¿Seguro? Si los dos salen, el panda se borra para siempre.")) return;
      await D.salir(); localStorage.removeItem("panda-clave"); location.reload();
    });
    if (android) {
      $("#a-tts")?.addEventListener("click", () => Voz.ajustesCelular());
      $("#a-actualizar")?.addEventListener("click", () => P.buscarActualizacion());
      $("#a-probar-push")?.addEventListener("click", async () => {
        try {
          await activarPush();
          const ok = await D.probarPush();
          aviso(ok ? "Listo: cerrá la app, en 10 segundos te llega 🔔" : "Este celu todavía no se registró: permití las notificaciones y abrí la app de nuevo");
        } catch (e) { aviso(msjError(e)); }
      });
    }
  }

  // ---------------------------------------------------------------
  //  IA: charla, ánimo y frase del día
  // ---------------------------------------------------------------
  function abrirChatPanda() {
    abrirHoja(`<h2>💬 Hablar con ${esc(nombres().panda)}</h2>
      <div class="chat-panda" id="cp-lista">${chatPanda.map((m) => `<div class="msj ${m.rol === "user" ? "mio" : "suyo"}">${esc(m.texto)}</div>`).join("") || `<div class="sistema">Preguntale lo que quieras 🐼</div>`}</div>
      <form class="campo" id="cp-form" style="display:flex;gap:8px;margin:0"><input id="cp-texto" maxlength="400" placeholder="Escribile al panda…" autocomplete="off"><button class="btn" style="padding:12px 16px">➤</button></form>
      <p class="nota" style="margin-top:8px">Usa IA: ${usoGemini}/${D.limiteGemini || 60} consultas hoy.</p>`);
    const lista = $("#cp-lista");
    lista.scrollTop = lista.scrollHeight;
    $("#cp-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const t = $("#cp-texto").value.trim();
      if (!t) return;
      $("#cp-texto").value = "";
      chatPanda.push({ rol: "user", texto: t });
      lista.insertAdjacentHTML("beforeend", `<div class="msj mio">${esc(t)}</div><div class="msj suyo" id="cp-pensando">…</div>`);
      lista.scrollTop = lista.scrollHeight;
      panda.pensando(true);
      let r;
      try { r = await D.panda("chat", { mensaje: t, historial: chatPanda.slice(-8, -1) }); }
      catch { r = { respuesta: F.frase("error_ia") }; }
      panda.pensando(false);
      if (r.usadas != null) usoGemini = r.usadas;
      const resp = r.limite ? F.frase("limite") : r.respuesta;
      chatPanda.push({ rol: "model", texto: resp });
      $("#cp-pensando").outerHTML = `<div class="msj suyo">${esc(resp)}</div>`;
      lista.scrollTop = lista.scrollHeight;
      const reac = { enamorado: "amor", feliz: "caricia", triste: "triste", sorprendido: "sorpresa", hambriento: "necesita" }[r.emocion];
      if (reac) panda.reaccion(reac);
      decir(resp);
    });
    setTimeout(() => $("#cp-texto")?.focus(), 300);
  }

  async function analizarAnimo() {
    try {
      const r = await D.panda("animo");
      if (r.usadas != null) usoGemini = r.usadas;
      if (r.animo) { E.mascota.animo = r.animo; E.mascota.animo_nota = r.nota; actualizarTodo(false); }
    } catch {}
  }

  async function revisarFraseDelDia() {
    const m = E.mascota, h = new Date().getHours();
    if (!E.otro || m.frase_fecha === E.hoy || h < 7) return;
    if (leer("panda-frase-intento", "") === E.hoy) return; // un intento por día por celular
    guardar("panda-frase-intento", E.hoy);
    try {
      const r = await D.panda("frase_dia");
      if (r.frase) { E.mascota.frase_dia = r.frase; E.mascota.frase_fecha = E.hoy; actualizarTodo(false); }
    } catch {}
  }

  // ---------------------------------------------------------------
  //  Parámetros que manda la app Android (al tocar una notificación)
  // ---------------------------------------------------------------
  function procesarParametros() {
    const q = new URLSearchParams(location.search);
    const a = q.get("accion");
    if (!a) return;
    history.replaceState(null, "", location.pathname + (q.has("android") ? "?android=1" : ""));
    setTimeout(() => {
      if (a === "compartir_ubicacion") compartirMiUbicacion();
      else if (a === "pregunta_ubicacion") preguntaUbicacion();
      else if (a === "mensajes") irA("mensajes");
      else if (a === "mimos") hacer("caricia");
      else if (a === "necesito_amor") alertaNecesitaAmor();
      else if (a === "sentir") irA("mensajes");
      else if (a === "ver_ubicacion") verUbicacionDelOtro();
    }, 900);
  }
  // La app Android también puede pedirlo sin recargar
  // al volver de dar un permiso en Android, refrescar Ajustes
  window.addEventListener("android-volvio", () => { if (vista === "ajustes") pintarAjustes(); });
  window.__accionAndroid = (a) => { const u = new URL(location.href); u.searchParams.set("accion", a); history.replaceState(null, "", u); procesarParametros(); };

  // ---------------------------------------------------------------
  //  v2: ESTILO POU (barras, baño, heladera, dormir, minijuego, tienda…)
  // ---------------------------------------------------------------
  function medidor(sel, k) {
    const b = $(sel);
    b.style.width = Math.round(Math.max(0, Math.min(1, k)) * 100) + "%";
    b.classList.toggle("bajo", k < 0.3);
  }

  function tocarPanda() {
    if (modo === "banio") return;
    if (E.mascota.se_fue) return;
    hacer("caricia");
  }

  // ---------- despedida: si no lo cuidaron 7 días, se fue ----------
  let pandaDespedida = null;
  function pintarDespedida() {
    const m = E.mascota, cont = $("#despedida");
    const seFue = !!m.se_fue;
    $("#escena").hidden = seFue;
    $("#zona-acciones").hidden = seFue;
    if (!seFue) { cont.hidden = true; pandaDespedida?.destruir(); pandaDespedida = null; return; }
    if (!cont.hidden && pandaDespedida) return;
    const dias = Math.max(1, Math.ceil((new Date(m.se_fue) - new Date(m.nacio)) / 86400e3));
    cont.hidden = false;
    cont.innerHTML = `<div class="despedida-escena"><div class="despedida-panda" id="despedida-panda"></div></div>
      <h2>${esc(m.nombre)} agarró sus cosas y se fue 🎒</h2>
      <p class="nota">Nadie lo cuidó durante ${R.ABANDONO.seVa} días. Estuvo ${dias} ${dias === 1 ? "día" : "días"} con ustedes y llegó a ${R.etapaDe(m.amor).emoji} ${R.etapaDe(m.amor).nombre}.<br>Sus mensajes y recuerdos quedan guardados.</p>
      <button class="btn btn-ancho" id="d-adoptar">🐣 Adoptar un panda nuevo</button>`;
    pandaDespedida = new Panda($("#despedida-panda"), { etapa: R.etapaDe(m.amor).indice });
    pandaDespedida.setMochila(true);
    pandaDespedida.setAccesorios(m.puestos || []);
    pandaDespedida.setAnimo("triste");
    pandaDespedida.caminando(true);
    $("#d-adoptar").addEventListener("click", () => {
      abrirHoja(`<h2>🐣 Un panda nuevo</h2>
        <p class="nota" style="margin-bottom:12px">Empieza de cero: bebé, sin monedas extra ni accesorios. Esta vez, ¡cuídenlo entre los dos!</p>
        <div class="campo"><label>¿Cómo se va a llamar?</label><input id="f-nuevo" maxlength="20" value="Pandi"></div>
        <button class="btn btn-ancho" id="f-ok">Adoptar</button>`);
      $("#f-ok").addEventListener("click", async () => {
        try {
          E = await D.adoptar($("#f-nuevo").value.trim() || "Pandi");
          cerrarHoja();
          panda.setEtapa(0, true);
          actualizarTodo(false);
          setTimeout(() => { panda.reaccion("crecer"); decir(F.frase("adoptado", nombres())); }, 400);
        } catch (e) { aviso(msjError(e)); }
      });
    });
  }

  // ---------- heladera ----------
  function abrirHeladera() {
    const m = E.mascota, inv = m.inventario || {};
    const comidas = Object.entries(R.TIENDA).filter(([, i]) => i.tipo === "comida");
    const tiene = comidas.filter(([k]) => (inv[k] || 0) > 0);
    abrirHoja(`<h2>🍎 Heladera de ${esc(m.nombre)}</h2>
      <p class="nota" style="margin-bottom:10px">Panza: ${Math.round((1 - R.hambre(m)) * 100)}% llena · Energía: ${R.energia(m)}%</p>
      <div class="lista-comida">
        <button class="item-comida" data-comer="bambu"><span class="emo">🎋</span><b>Bambú</b><small>gratis · +5 💗 cada 2 h</small></button>
        ${tiene.map(([k, i]) => `<button class="item-comida" data-comer="${k}"><span class="emo">${i.emoji}</span><b>${i.nombre} ×${inv[k]}</b><small>+${i.horas} h de panza${i.energia ? ` · +${i.energia} ⚡` : ""}${i.carino ? " · 💗 lo pone feliz" : ""}</small></button>`).join("")}
      </div>
      ${tiene.length ? "" : `<p class="nota" style="margin:10px 0">La heladera está vacía. Compren comida con monedas 🪙</p>`}
      <button class="btn btn-sec btn-ancho" id="h-tienda" style="margin-top:12px">🛍️ Comprar más comida</button>`);
    $$("[data-comer]").forEach((b) => b.addEventListener("click", () => {
      cerrarHoja();
      if (b.dataset.comer === "bambu") hacer("comida"); else hacer("comer", b.dataset.comer);
    }));
    $("#h-tienda").addEventListener("click", () => { cerrarHoja(); irA("tienda"); });
  }

  // ---------- baño: frotar con el dedo hasta llenarlo de espuma y enjuagar ----------
  let espuma = 0, ultimoFrote = null, tBurbuja = 0;
  function prepararBanio() {
    const zona = $("#escena-panda");
    zona.addEventListener("pointermove", (e) => {
      if (modo !== "banio" || espuma >= 1) return;
      if (e.pointerType === "mouse" && !e.buttons) return;
      if (ultimoFrote) {
        const d = Math.hypot(e.clientX - ultimoFrote.x, e.clientY - ultimoFrote.y);
        espuma = Math.min(1, espuma + d / 2600);
        panda.setEspuma(espuma);
        $("#banio-barra").style.width = Math.round(espuma * 100) + "%";
        if (Date.now() - tBurbuja > 350) { tBurbuja = Date.now(); panda.reaccion("burbujas"); }
        if (espuma >= 1) {
          $("#banio-txt").textContent = "¡Lleno de espuma! Ahora enjuagalo 🚿";
          $("#banio-ducha").hidden = false;
          decir("¡Jiji, cuántas burbujas!");
        }
      }
      ultimoFrote = { x: e.clientX, y: e.clientY };
    });
    zona.addEventListener("pointerdown", (e) => { if (modo === "banio") { ultimoFrote = { x: e.clientX, y: e.clientY }; zona.setPointerCapture?.(e.pointerId); } });
    zona.addEventListener("pointerup", () => { ultimoFrote = null; });
    $("#banio-salir").addEventListener("click", salirBanio);
    $("#banio-ducha").addEventListener("click", async () => {
      $("#banio-ducha").hidden = true;
      $("#escena").classList.add("ducha");
      const t0 = performance.now();
      await new Promise((ok) => {
        const paso = (ts) => {
          const k = Math.min(1, (ts - t0) / 1600);
          panda.setEspuma(1 - k);
          if (Math.random() < 0.3) panda.corazones(1, ["💧", "💦"]);
          if (k < 1) requestAnimationFrame(paso); else ok();
        };
        requestAnimationFrame(paso);
      });
      $("#escena").classList.remove("ducha");
      salirBanio();
      panda.setLimpieza(1);
      hacer("banio");
    });
  }
  function entrarBanio() {
    const m = E.mascota;
    if (m.durmiendo) return decir("Shh… está durmiendo. Despertalo primero ☀️");
    if (R.horasDesde(m.ultimo_banio) < R.TOPES.horas_entre_banios) return decir(F.frase("limpio", nombres()));
    irA("panda");
    modo = "banio"; espuma = 0; ultimoFrote = null;
    panda.setEspuma(0);
    $("#escena").classList.add("banio");
    $("#banio-panel").hidden = false;
    $("#banio-ducha").hidden = true;
    $("#banio-barra").style.width = "0%";
    $("#banio-txt").textContent = `Frotá a ${E.mascota.nombre} con el dedo 🧼`;
    $("#escena").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function salirBanio() {
    modo = null;
    panda.setEspuma(0);
    $("#escena").classList.remove("banio", "ducha");
    $("#banio-panel").hidden = true;
    panda.setLimpieza(R.limpieza(E.mascota));
  }

  // ---------- minijuego: "Atrapá el bambú" ----------
  function abrirJuego() {
    const m = E.mascota;
    if (m.durmiendo) return decir("Shh… está durmiendo. Despertalo primero ☀️");
    if (R.energia(m) < 10) return decir(F.frase("juego_cansado", nombres()));
    modo = "juego";
    const caja = document.createElement("div");
    caja.className = "juego";
    caja.innerHTML = `<div class="juego-barra"><span id="j-puntos">0 pts</span><span id="j-vidas">❤️❤️❤️</span><span id="j-tiempo">45 s</span><button class="juego-cerrar" id="j-cerrar" aria-label="Cerrar">✕</button></div>
      <div class="juego-area" id="j-area"><div class="juego-panda" id="j-panda"></div>
        <div class="juego-inicio" id="j-inicio"><h2>🎋 Atrapá el bambú</h2>
          <p>Mové a ${esc(m.nombre)} con el dedo. 🎋 1 punto · 🍎 2 · 💗 3. ¡Esquivá las piedras 🪨!</p>
          <p class="nota">Ganás 1 🪙 cada 3 puntos (hasta 20 por partida, 5 partidas con premio por día). Cansa un poquito (−10 ⚡).</p>
          <button class="btn" id="j-empezar">¡Jugar!</button></div></div>`;
    document.body.appendChild(caja);
    const area = $("#j-area"), pj = $("#j-panda");
    const p = new Panda(pj, { etapa: R.etapaDe(m.amor).indice });
    p.setAccesorios(m.puestos || []);
    let x = 0.5, objetivo = 0.5, puntos = 0, vidas = 3, tiempo = 45, items = [], vivo = false, ultimo = 0, proximo = 0;
    const cerrar = () => { vivo = false; p.destruir(); caja.remove(); modo = null; };
    caja.cerrar = cerrar;
    $("#j-cerrar").addEventListener("click", cerrar);
    const mover = (e) => { const r = area.getBoundingClientRect(); objetivo = Math.max(0.08, Math.min(0.92, (e.clientX - r.left) / r.width)); };
    area.addEventListener("pointerdown", mover);
    area.addEventListener("pointermove", mover);
    const TIPOS = [["🎋", 1, 0.58], ["🍎", 2, 0.2], ["💗", 3, 0.08], ["🪨", -1, 0.14]];
    const nuevo = () => {
      let r = Math.random(), t = TIPOS[0];
      for (const tt of TIPOS) { if (r < tt[2]) { t = tt; break; } r -= tt[2]; }
      const el = document.createElement("span");
      el.className = "juego-item"; el.textContent = t[0];
      area.appendChild(el);
      items.push({ el, x: 0.06 + Math.random() * 0.88, y: -0.08, v: 0.32 + Math.random() * 0.2 + (45 - tiempo) * 0.012, val: t[1] });
    };
    const fin = async () => {
      vivo = false;
      items.forEach((i) => i.el.remove()); items = [];
      const caja2 = document.createElement("div");
      caja2.className = "juego-inicio";
      caja2.innerHTML = `<h2>¡${puntos} puntos!</h2><p>Guardando…</p>`;
      area.appendChild(caja2);
      p.reaccion("amor");
      try {
        const r = await hacer("juego", String(puntos));
        const g = r?.monedas_ganadas || 0;
        caja2.innerHTML = `<h2>¡${puntos} puntos!</h2><p>${r?.nota === "tope_juegos" ? "Hoy ya jugaron 5 partidas con premio. ¡Igual fue divertido!" : `Ganaste <b>${g} 🪙</b>`}</p>
          <div style="display:grid;gap:10px;margin-top:12px"><button class="btn" id="j-otra">Jugar otra vez</button><button class="btn btn-sec" id="j-salir">Salir</button></div>`;
        $("#j-salir").addEventListener("click", cerrar);
        $("#j-otra").addEventListener("click", () => { cerrar(); setTimeout(abrirJuego, 50); });
        decir(F.frase("juego_fin", { ...nombres(), puntos }));
      } catch (e) { caja2.innerHTML = `<h2>Uy</h2><p>${esc(msjError(e))}</p><button class="btn" id="j-salir">Salir</button>`; $("#j-salir").addEventListener("click", cerrar); }
    };
    const cuadro = (ts) => {
      if (!vivo) return;
      const dt = Math.min(0.05, (ts - (ultimo || ts)) / 1000); ultimo = ts;
      tiempo -= dt;
      proximo -= dt;
      if (proximo <= 0) { nuevo(); proximo = Math.max(0.35, 0.85 - (45 - tiempo) * 0.012); }
      const antes = x;
      x += (objetivo - x) * Math.min(1, dt * 9);
      p.caminando(Math.abs(x - antes) > 0.002);
      const W = area.clientWidth, H = area.clientHeight;
      pj.style.transform = `translateX(${x * W - pj.clientWidth / 2}px)`;
      items = items.filter((i) => {
        i.y += i.v * dt;
        i.el.style.transform = `translate(${i.x * W - 18}px, ${i.y * H}px)`;
        const cerca = i.y > 0.74 && i.y < 0.92 && Math.abs(i.x - x) < 0.11;
        if (cerca) {
          i.el.remove();
          if (i.val < 0) { vidas--; p.reaccion("triste"); P.vibrar("caricia"); $("#j-vidas").textContent = "❤️".repeat(Math.max(0, vidas)) + "🤍".repeat(3 - Math.max(0, vidas)); }
          else { puntos += i.val; p.reaccion(i.val >= 3 ? "amor" : "caricia"); $("#j-puntos").textContent = `${puntos} pts`; }
          return false;
        }
        if (i.y > 1.05) { i.el.remove(); return false; }
        return true;
      });
      $("#j-tiempo").textContent = `${Math.max(0, Math.ceil(tiempo))} s`;
      if (tiempo <= 0 || vidas <= 0) return fin();
      requestAnimationFrame(cuadro);
    };
    pj.style.transform = `translateX(${area.clientWidth / 2 - 50}px)`;
    $("#j-empezar").addEventListener("click", () => { $("#j-inicio").remove(); vivo = true; ultimo = 0; requestAnimationFrame(cuadro); });
  }

  // ---------- fotos ----------
  function elegirFoto() {
    if (!E.otro) return aviso("Primero tu pareja se tiene que unir con el código");
    $("#f-foto").value = "";
    $("#f-foto").click();
  }
  // Achica la foto en el celular (máx. ~900 px, JPEG) para que pese ~100 KB
  function comprimir(archivo) {
    return new Promise((ok, mal) => {
      const img = new Image(), url = URL.createObjectURL(archivo);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let lado = 900, calidad = 0.72, datos = "";
        for (let i = 0; i < 6; i++) {
          const k = Math.min(1, lado / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          datos = c.toDataURL("image/jpeg", calidad);
          if (datos.length < 400000) return ok(datos);
          lado *= 0.8; calidad = Math.max(0.5, calidad - 0.06);
        }
        mal(new Error("La foto es muy pesada"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No pude abrir la foto")); };
      img.src = url;
    });
  }
  async function fotoElegida(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    let datos;
    try { datos = await comprimir(archivo); } catch (er) { return aviso(er.message); }
    abrirHoja(`<h2>📸 Foto para ${esc(nombres().otro)}</h2>
      <img class="foto-previa" src="${datos}" alt="Foto elegida">
      <div class="campo" style="margin-top:12px"><input id="f-pie" maxlength="200" placeholder="Escribí algo (opcional)"></div>
      <button class="btn btn-ancho" id="f-ok">Mandar con ${esc(nombres().panda)} 🐼</button>`);
    $("#f-ok").addEventListener("click", async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        const r = await D.enviarFoto(datos, $("#f-pie").value.trim());
        cerrarHoja();
        aplicarMascota(r.mascota);
        panda.reaccion("amor");
        aviso([r.sumo + r.extra > 0 ? `+${r.sumo + r.extra} 💗` : "", r.monedas_ganadas ? `+${r.monedas_ganadas} 🪙` : ""].filter(Boolean).join(" · ") || "📸 Enviada");
        decir(F.frase("foto_enviada", nombres()));
        revisarDesafiosPendientes();
      } catch (er) { aviso(msjError(er)); ev.currentTarget.disabled = false; }
    });
  }
  async function datosFoto(id) {
    if (!id || id === "null") return null;
    if (!fotosCache.has(id)) fotosCache.set(id, D.foto(id).catch(() => null));
    return fotosCache.get(id);
  }
  function cargarFotos(cont) {
    $$("img[data-foto]", cont).forEach(async (img) => {
      const d = await datosFoto(img.dataset.foto);
      if (d) img.src = d; else img.replaceWith(Object.assign(document.createElement("span"), { className: "foto-vencida", textContent: "📸 (foto vieja, ya no está guardada)" }));
    });
  }
  async function verFoto(id) {
    const d = await datosFoto(id);
    if (!d) return;
    const v = document.createElement("div");
    v.className = "visor";
    v.innerHTML = `<img src="${d}" alt="Foto"><button class="juego-cerrar" aria-label="Cerrar">✕</button>`;
    v.addEventListener("click", () => v.remove());
    document.body.appendChild(v);
  }

  // ---------- "¿Cómo estás?" (también cosas tristes) ----------
  function sentimientoDe(texto) { return F.SENTIMIENTOS.find((s) => String(texto || "").startsWith(s.emoji)); }
  function formularioSentir() {
    if (!E.otro) return aviso("Primero tu pareja se tiene que unir con el código");
    let elegido = null;
    abrirHoja(`<h2>💭 ¿Cómo estás?</h2>
      <p class="nota" style="margin-bottom:10px">Contale a ${esc(nombres().otro)} cómo te sentís. Le llega un aviso y le vibra el celu.</p>
      <div class="sentimientos">${F.SENTIMIENTOS.map((s) => `<button class="sentimiento" data-sentir="${s.id}"><span>${s.emoji}</span>${esc(s.texto)}</button>`).join("")}</div>
      <div class="campo" style="margin-top:12px"><input id="f-sentir" maxlength="200" placeholder="¿Querés contarle algo más? (opcional)"></div>
      <button class="btn btn-ancho" id="f-ok" disabled>Contarle</button>`);
    $$("[data-sentir]").forEach((b) => b.addEventListener("click", () => {
      elegido = F.SENTIMIENTOS.find((s) => s.id === b.dataset.sentir);
      $$("[data-sentir]").forEach((x) => x.classList.toggle("activo", x === b));
      $("#f-ok").disabled = false;
    }));
    $("#f-ok").addEventListener("click", () => {
      if (!elegido) return;
      const extra = $("#f-sentir").value.trim();
      cerrarHoja();
      if (F.TRISTES.includes(elegido.id)) panda.reaccion("triste"); else panda.reaccion("amor");
      hacer("sentir", `${elegido.emoji} ${elegido.texto}${extra ? " · " + extra : ""}`);
    });
  }
  function alertaSentir(ev, s) {
    const n = nombres();
    abrirHoja(`<div class="alerta-amor"><div class="grande">${s.emoji}</div><h2>${esc(n.otro)}: “${esc(s.texto)}”</h2>
      ${ev.texto.includes(" · ") ? `<p class="nota" style="margin-bottom:10px">${esc(ev.texto.split(" · ").slice(1).join(" · "))}</p>` : ""}
      <p class="nota" style="margin-bottom:16px">${esc((F.RESPUESTA_SENTIR[s.id] || "").replace(/\{otro\}/g, n.otro))}</p>
      <div style="display:grid;gap:10px"><button class="btn btn-ancho" id="s-mimo">🤗 Mandarle mimos</button>
        <button class="btn btn-sec btn-ancho" id="s-frase">💌 Mandarle una frase</button>
        <button class="btn btn-sec btn-ancho" id="s-msj">💬 Escribirle</button></div></div>`);
    $("#s-mimo").addEventListener("click", () => { cerrarHoja(); hacer("caricia"); });
    $("#s-frase").addEventListener("click", formularioFrase);
    $("#s-msj").addEventListener("click", () => { cerrarHoja(); irA("mensajes"); setTimeout(() => $("#m-texto")?.focus(), 200); });
  }

  // ---------- pregunta del día ----------
  async function pintarPregunta() {
    const caja = $("#pregunta-dia");
    if (!caja) return;
    const pregunta = F.preguntaDelDia(R.numeroDia());
    let resp = [];
    try { resp = (await D.eventos({ limite: 8, tipos: ["pregunta"] })).filter((e) => R.esHoy(e.creado)); } catch {}
    const mia = resp.find((e) => e.de === E.yo.id), suya = resp.find((e) => e.de !== E.yo.id);
    const n = nombres();
    caja.innerHTML = `<h3>❓ Pregunta del día</h3><p class="pregunta-txt">${esc(pregunta)}</p>
      ${mia ? `<div class="respuesta mia"><b>${esc(n.yo)}</b>${esc(mia.texto)}</div>
               ${suya ? `<div class="respuesta suya"><b>${esc(n.otro)}</b>${esc(suya.texto)}</div>` : `<p class="nota">Esperando la respuesta de ${esc(n.otro)}… 👀</p>`}`
             : `${suya ? `<p class="nota" style="margin-bottom:8px">👀 ${esc(n.otro)} ya respondió. ¡Respondé para ver qué puso!</p>` : ""}
               <form class="campo" id="p-form" style="display:flex;gap:8px;margin:0"><input id="p-texto" maxlength="300" placeholder="Tu respuesta…" autocomplete="off"><button class="btn" style="padding:12px 16px">➤</button></form>
               <p class="nota" style="margin-top:6px">+5 💗 · Las respuestas se ven cuando responden los dos.</p>`}`;
    $("#p-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const t = $("#p-texto").value.trim();
      if (!t) return;
      const r = await hacer("pregunta", t);
      if (r) { eventos.unshift({ id: r.evento, de: E.yo.id, tipo: "pregunta", texto: t, creado: new Date().toISOString() }); pintarPregunta(); }
    });
  }

  // ---------- tienda: monedas, desafíos, minijuego, comida y accesorios ----------
  let desafiosCache = null;
  async function revisarDesafiosPendientes() {
    try {
      desafiosCache = await D.desafios();
      const pend = !desafiosCache.regalo_cobrado || desafiosCache.desafios.some((d) => !d.cobrado && d.progreso >= d.meta);
      $("#punto-tienda").hidden = !pend;
      if (vista === "tienda") pintarTienda(false);
    } catch { $("#punto-tienda").hidden = true; }
  }
  async function pintarTienda(recargar = true) {
    const m = E.mascota, n = nombres();
    if (recargar) { try { desafiosCache = await D.desafios(); } catch (e) { desafiosCache = { error: msjError(e) }; } }
    const ds = desafiosCache || {};
    const inv = m.inventario || {}, tiene = m.accesorios || [], puestos = m.puestos || [];
    const textoDesafio = (k) => (R.DESAFIOS[k]?.texto || k).replace("{otro}", n.otro).replace("{panda}", n.panda);
    $("#tienda").innerHTML = `
      <h2 class="titulo-vista">Tienda 🛍️</h2>
      <div class="tarjeta saldo"><div><b>🪙 ${m.monedas ?? 0}</b><span>monedas de los dos</span></div>
        <div class="tienda-panda" id="t-panda">${svgPanda(R.etapaDe(m.amor).indice, { accesorios: puestos })}</div></div>

      <div class="tarjeta"><h3>🎯 Ganá monedas</h3>
        ${ds.error ? `<p class="nota">${esc(ds.error)}</p>` : `
        <div class="desafio ${ds.regalo_cobrado ? "hecho" : "listo"}"><span class="emo">🎁</span><div><b>Regalo de hoy</b><small>Por abrir la app</small></div>
          ${ds.regalo_cobrado ? `<span class="ok">✓</span>` : `<button class="btn btn-chico" data-cobrar="diario">+${R.REGALO_DIARIO} 🪙</button>`}</div>
        ${(ds.desafios || []).map((d) => {
          const info = R.DESAFIOS[d.clave] || {}, listo = d.progreso >= d.meta;
          return `<div class="desafio ${d.cobrado ? "hecho" : listo ? "listo" : ""}"><span class="emo">${info.emoji || "🎯"}</span>
            <div><b>${esc(textoDesafio(d.clave))}</b><small>${Math.min(d.progreso, d.meta)}/${d.meta} · premio ${d.premio} 🪙</small>
              <div class="medidor"><i style="width:${Math.min(100, (d.progreso / d.meta) * 100)}%"></i></div></div>
            ${d.cobrado ? `<span class="ok">✓</span>` : listo ? `<button class="btn btn-chico" data-cobrar="${d.clave}">+${d.premio} 🪙</button>` : `<button class="btn btn-sec btn-chico" data-ir-desafio="${d.clave}">Ir</button>`}</div>`;
        }).join("")}`}
        <div class="desafio"><span class="emo">🎮</span><div><b>Atrapá el bambú</b><small>Hasta 20 🪙 por partida · 5 por día</small></div><button class="btn btn-chico" id="t-jugar">Jugar</button></div>
        <p class="nota">También ganan 5 🪙 cada día de racha 🔥</p>
      </div>

      <div class="tarjeta"><h3>🍎 Comida <small class="nota">(va a la heladera)</small></h3><div class="grilla-tienda">
        ${Object.entries(R.TIENDA).filter(([, i]) => i.tipo === "comida").map(([k, i]) => `<div class="item-tienda">
          <span class="emo">${i.emoji}</span><b>${i.nombre}</b><small>+${i.horas} h panza${i.energia ? ` · +${i.energia}⚡` : ""}${i.carino ? " · 💗" : ""}</small>
          ${inv[k] ? `<small class="tenes">Tienen ${inv[k]}</small>` : ""}
          <button class="btn btn-chico" data-comprar="${k}" ${m.monedas < i.precio ? "disabled" : ""}>${i.precio} 🪙</button></div>`).join("")}
      </div></div>

      <div class="tarjeta"><h3>🎀 Accesorios</h3><div class="grilla-tienda">
        ${Object.entries(R.TIENDA).filter(([, i]) => i.tipo === "accesorio").map(([k, i]) => `<div class="item-tienda ${puestos.includes(k) ? "puesto" : ""}">
          <span class="emo">${i.emoji}</span><b>${i.nombre}</b><small>${{ cabeza: "en la cabeza", cara: "en la cara", cuello: "en el cuello" }[i.lugar]}</small>
          ${tiene.includes(k) ? `<button class="btn ${puestos.includes(k) ? "btn-sec" : ""} btn-chico" data-poner="${k}" data-on="${puestos.includes(k) ? 0 : 1}">${puestos.includes(k) ? "Sacárselo" : "Ponérselo"}</button>`
            : `<button class="btn btn-chico" data-comprar="${k}" ${m.monedas < i.precio ? "disabled" : ""}>${i.precio} 🪙</button>`}</div>`).join("")}
      </div></div>`;

    $$("[data-cobrar]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        const r = await D.reclamarDesafio(b.dataset.cobrar);
        aplicarMascota(r.mascota);
        aviso(`+${r.premio} 🪙`); P.vibrar("caricia");
        panda.reaccion("amor");
        await revisarDesafiosPendientes();
        pintarTienda(false);
      } catch (e) { aviso(msjError(e)); b.disabled = false; }
    }));
    $$("[data-ir-desafio]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.irDesafio;
      const ir = { foto: elegirFoto, frase: formularioFrase, sentir: formularioSentir, jugar: abrirJuego,
        mensajes: () => irA("mensajes"), pregunta: () => { irA("panda"); setTimeout(() => $("#pregunta-dia").scrollIntoView({ behavior: "smooth" }), 100); },
        banio: () => { irA("panda"); entrarBanio(); }, comer: () => { irA("panda"); abrirHeladera(); },
        mimos: () => { irA("panda"); decir("¡Tocame para hacerme mimos!"); }, dormir: () => { irA("panda"); decir("Apretá 😴 Dormir para apagarme la luz"); } }[k];
      ir?.();
    }));
    $("#t-jugar").addEventListener("click", abrirJuego);
    $$("[data-comprar]").forEach((b) => b.addEventListener("click", async () => {
      const k = b.dataset.comprar, i = R.TIENDA[k];
      b.disabled = true;
      try {
        const fila = await D.comprar(k);
        aplicarMascota(fila);
        aviso(`${i.emoji} ${i.nombre} comprado · −${i.precio} 🪙`);
        if (i.tipo === "accesorio") { aplicarMascota(await D.ponerAccesorio(k, true)); decir(F.frase("accesorio", nombres())); }
        pintarTienda(false);
      } catch (e) { aviso(msjError(e)); b.disabled = false; }
    }));
    $$("[data-poner]").forEach((b) => b.addEventListener("click", async () => {
      try {
        aplicarMascota(await D.ponerAccesorio(b.dataset.poner, b.dataset.on === "1"));
        if (b.dataset.on === "1") decir(F.frase("accesorio", nombres()));
        pintarTienda(false);
      } catch (e) { aviso(msjError(e)); }
    }));
  }

  // ---------------------------------------------------------------
  //  BOTÓN "ATRÁS" (el gesto o la flechita del celular)
  //  Lo llama la app Android. Devuelve true si cerró algo.
  // ---------------------------------------------------------------
  window.__atras = () => {
    const visor = $(".visor"); if (visor) { visor.remove(); return true; }
    const juego = $(".juego"); if (juego) { juego.cerrar?.(); return true; }
    if (!$("#hoja").hidden) { cerrarHoja(); return true; }
    if (modo === "banio") { salirBanio(); return true; }
    if (vista !== "panda" && $(".principal")) { irA("panda"); return true; }
    return false;
  };

  // ---------------------------------------------------------------
  //  HOJA INFERIOR Y AVISOS
  // ---------------------------------------------------------------
  function abrirHoja(html) {
    $("#hoja-cuerpo").innerHTML = html;
    $("#hoja").style.transform = "";
    $("#hoja").hidden = false; $("#hoja-fondo").hidden = false;
    $("#hoja").scrollTop = 0;
  }
  function cerrarHoja() { $("#hoja").hidden = true; $("#hoja-fondo").hidden = true; $("#hoja").style.transform = ""; }
  $("#hoja-fondo").addEventListener("click", cerrarHoja);
  $("#hoja-cerrar").addEventListener("click", cerrarHoja);
  // Arrastrar la barrita gris para abajo cierra la hoja (o tocarla)
  (() => {
    const asa = $("#hoja-asa"), hoja = $("#hoja");
    let y0 = null, dy = 0;
    asa.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; asa.setPointerCapture(e.pointerId); hoja.style.transition = "none"; });
    asa.addEventListener("pointermove", (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      hoja.style.transform = `translate(-50%, ${dy}px)`;
    });
    const soltar = () => {
      if (y0 == null) return;
      y0 = null; hoja.style.transition = "";
      if (dy > 70 || dy < 6) cerrarHoja(); // arrastró lejos, o fue un toque
      else hoja.style.transform = "";
    };
    asa.addEventListener("pointerup", soltar);
    asa.addEventListener("pointercancel", soltar);
  })();

  let tAviso;
  function aviso(t) {
    const a = $("#aviso");
    a.textContent = t; a.classList.add("visible");
    clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove("visible"), 2600);
  }

  arrancar();
})();
