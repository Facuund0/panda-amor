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
            <span class="chip">🎋 <span class="mini"><i id="c-hambre"></i></span></span>
            <span class="chip" id="c-otro"></span>
          </div>
        </header>
        <section class="vista" data-vista="panda">
          <div class="escena" id="escena">
            <span class="escena-deco" style="left:18px;top:40px">☁️</span>
            <span class="escena-deco" style="right:30px;top:70px;font-size:22px">☁️</span>
            <svg class="escena-bambu" viewBox="0 0 60 160" style="left:6px"><g fill="#7cc36b"><rect x="10" y="20" width="9" height="140" rx="4"/><rect x="30" y="50" width="8" height="110" rx="4"/><rect x="44" y="0" width="7" height="160" rx="3"/></g><g fill="#5ea54d"><rect x="10" y="60" width="9" height="3"/><rect x="10" y="105" width="9" height="3"/><rect x="30" y="90" width="8" height="3"/><rect x="44" y="45" width="7" height="3"/><rect x="44" y="100" width="7" height="3"/></g><g fill="#8fd47c"><path d="M19 58 q14-10 22-2 q-12 4-22 2z"/><path d="M38 88 q12-12 20-4 q-10 6-20 4z"/><path d="M10 102 q-10-10-4-16 q4 10 4 16z"/><path d="M51 42 q10-8 9 2 q-6 0-9-2z"/></g></svg>
            <svg class="escena-bambu" viewBox="0 0 60 160" style="right:4px;transform:scaleX(-1);height:120px"><g fill="#7cc36b"><rect x="14" y="30" width="9" height="130" rx="4"/><rect x="34" y="60" width="8" height="100" rx="4"/></g><g fill="#5ea54d"><rect x="14" y="80" width="9" height="3"/><rect x="34" y="105" width="8" height="3"/></g><g fill="#8fd47c"><path d="M23 78 q14-10 22-2 q-12 4-22 2z"/><path d="M34 102 q-12-10-18-2 q10 4 18 2z"/></g></svg>
            <div class="burbuja" id="burbuja" hidden></div>
            <div class="escena-panda" id="escena-panda" aria-label="Tocá al panda para hacerle mimos"></div>
            <span class="estado-animo" id="estado-animo"></span>
          </div>
          <div class="frase-dia" id="frase-dia" hidden></div>
          <div class="acciones">
            <button class="accion" data-accion="comida"><i>🎋</i>Bambú<small>+5 💗</small></button>
            <button class="accion" data-accion="caricia"><i>🤗</i>Mimos<small>+2 💗</small></button>
            <button class="accion amor" data-accion="frase"><i>💌</i>Frase<small>+8 💗</small></button>
            <button class="accion amor" data-accion="necesito_amor"><i>📳</i>Necesito amor<small>le vibra</small></button>
            <button class="accion" data-accion="ubicacion"><i>📍</i>¿Dónde estás?<small>ubicación</small></button>
            <button class="accion" data-accion="hablar"><i>💬</i>Hablar<small>con IA</small></button>
          </div>
        </section>
        <section class="vista" data-vista="mensajes" hidden>
          <h2 class="titulo-vista">Mensajes 💌</h2>
          <div class="chat" id="chat"></div>
        </section>
        <section class="vista" data-vista="recuerdos" hidden><div id="recuerdos"></div></section>
        <section class="vista" data-vista="ajustes" hidden><div id="ajustes"></div></section>
        <nav class="pestanas">
          <button class="pestana activa" data-pestana="panda"><i>🐼</i>Panda</button>
          <button class="pestana" data-pestana="mensajes"><i>💌</i>Mensajes<span class="punto" id="punto-msj" hidden></span></button>
          <button class="pestana" data-pestana="recuerdos"><i>🌸</i>Recuerdos</button>
          <button class="pestana" data-pestana="ajustes"><i>⚙️</i>Ajustes</button>
        </nav>
      </div>`;

    panda = new Panda($("#escena-panda"), { etapa: R.etapaDe(E.mascota.amor).indice });
    actualizarTodo(false);

    $$("[data-pestana]").forEach((b) => b.addEventListener("click", () => irA(b.dataset.pestana)));
    $$("[data-accion]").forEach((b) => b.addEventListener("click", () => tocarAccion(b.dataset.accion)));
    $("#escena-panda").addEventListener("click", () => hacer("caricia"));
    document.addEventListener("pointermove", (e) => panda?.mirarA(e.clientX, e.clientY), { passive: true });

    D.suscribir(alRecibir);
    try { eventos = await D.eventos({ limite: 80 }); } catch {}
    try { usoGemini = await D.usoGemini(); } catch {}

    // saludo (una vez por apertura)
    setTimeout(() => decir(E.mascota.amor === 0 && (E.mascota.comidas_total || 0) === 0 ? `¡Hola! Soy ${nombres().panda}. Recién nací y tengo hambre… ¿me das bambú?` : F.saludo(nombres())), 700);
    setTimeout(revisarFraseDelDia, 2500);
    procesarParametros();
    setInterval(() => actualizarTodo(false), 60000); // hambre y ánimo cambian con el tiempo
    if (D.modo === "supabase") document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") { E = await D.estado(); actualizarTodo(false); eventos = await D.eventos({ limite: 80 }); if (vista === "mensajes") pintarChat(); }
    });
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
    $("#c-hambre").style.width = ((1 - R.hambre(m)) * 100).toFixed(0) + "%";
    $("#c-otro").textContent = E.otro ? `💞 ${E.otro.nombre}` : "⏳ Esperando a tu pareja";
    $("#estado-animo").textContent = `${an.emoji} ${an.texto}`;
    $("#escena").classList.toggle("noche", an.clave === "dormido");
    if (panda) {
      const antes = panda.etapa;
      panda.setEtapa(et.indice);
      panda.setAnimo(an.clave);
      if (animarCrecimiento && et.indice > antes) setTimeout(() => decir(F.frase("crecer", { etapa: et.nombre })), 400);
    }
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
    if (a === "frase") return formularioFrase();
    if (a === "ubicacion") return menuUbicacion();
    if (a === "hablar") return abrirChatPanda();
    if (a === "necesito_amor") return confirmarNecesitoAmor();
    hacer(a);
  }

  async function hacer(tipo, texto = null) {
    if (!E.otro && ["necesito_amor", "pedir_ubicacion"].includes(tipo)) return aviso("Primero tu pareja se tiene que unir con el código");
    // reacción inmediata (no espera a internet)
    if (tipo === "comida") panda.reaccion("comida");
    if (tipo === "caricia") panda.reaccion("caricia");
    if (tipo === "frase") panda.reaccion("amor");
    let r;
    try {
      r = await D.accion(tipo, texto);
    } catch (e) { return aviso(e.message); }
    const n = { ...nombres(), racha: r.racha };
    let dicho = null;
    if (r.nota === "lleno") dicho = F.frase("lleno", n);
    else if (r.nota === "tope_caricias") dicho = F.frase("tope_caricias", n);
    else if (tipo === "comida") dicho = F.frase("comida", n);
    else if (tipo === "caricia") dicho = Math.random() < 0.6 ? F.frase("caricia", n) : null;
    else if (tipo === "frase") dicho = F.frase("frase", n);
    else if (tipo === "necesito_amor") { dicho = F.frase("necesito_amor_enviado", n); panda.reaccion("necesita"); }
    else if (tipo === "pedir_ubicacion") dicho = F.frase("pedir_ubicacion", n);
    if (r.nota === "racha") { panda.reaccion("amor"); dicho = F.frase("racha", n); }
    if (r.sumo + r.extra > 0) aviso(`+${r.sumo + r.extra} 💗${r.extra ? ` (racha +${r.extra})` : ""}`);
    if (dicho) decir(dicho);
    if (r.analizar) analizarAnimo();
  }

  function formularioFrase() {
    const ideas = ["Gracias por estar siempre 💗", "Sos mi lugar favorito", "Te elegiría mil veces más", "Me encanta tu risa", "Hoy te extraño un montón"];
    abrirHoja(`<h2>💌 Dedicale una frase a ${esc(nombres().otro)}</h2>
      <div class="campo"><textarea id="f-frase" maxlength="300" placeholder="Escribí algo lindo…"></textarea></div>
      <div class="chips" style="margin-bottom:14px">${ideas.map((i) => `<button class="chip" data-idea="${esc(i)}">${esc(i)}</button>`).join("")}</div>
      <p class="nota" style="margin-bottom:12px">Las frases suman +8 💗 y quedan guardadas en Recuerdos.</p>
      <button class="btn btn-ancho" id="f-ok">Enviar con ${esc(nombres().panda)} 🐼</button>`);
    $$("[data-idea]").forEach((b) => b.addEventListener("click", () => ($("#f-frase").value = b.dataset.idea)));
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
    let u = null;
    try { u = await D.ubicacionDe(E.otro.id); } catch {}
    abrirHoja(`<h2>📍 ¿Dónde está ${esc(nombres().otro)}?</h2>
      ${u ? `<p class="nota" style="margin-bottom:10px">Última ubicación que compartió: ${R.haceCuanto(u.actualizada)}</p>${mapa(u)}` : `<p class="nota" style="margin-bottom:12px">Todavía no compartió su ubicación.</p>`}
      <div style="display:grid;gap:10px;margin-top:14px">
        <button class="btn btn-ancho" id="u-pedir">Preguntarle dónde está</button>
        <button class="btn btn-sec btn-ancho" id="u-mia">Compartir la mía</button>
      </div>
      <p class="nota" style="margin-top:12px">${esc(nombres().otro)} decide si la comparte. Solo se guarda la última ubicación, no un historial.</p>`);
    $("#u-pedir").addEventListener("click", () => { cerrarHoja(); hacer("pedir_ubicacion"); });
    $("#u-mia").addEventListener("click", () => { cerrarHoja(); compartirMiUbicacion(); });
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
    if (ev.de === E.yo.id) return;
    if (ev.tipo === "sistema") { E = await D.estado(); return actualizarTodo(); }
    if (!E.otro) { E = await D.estado(); actualizarTodo(); }

    const n = { ...nombres(), texto: ev.texto || "" };
    const texto = F.deOtro(ev.tipo, n);
    // Si el panda flotante está activo, el aviso del sistema y la vibración los hace él
    if (!P.flotanteActivo()) P.vibrar(ev.tipo);
    if (["mensaje", "frase"].includes(ev.tipo) && vista !== "mensajes") { sinLeer++; $("#punto-msj").hidden = false; }
    if (ev.tipo === "caricia") panda.reaccion("caricia");
    if (ev.tipo === "comida") panda.reaccion("comida");
    if (ev.tipo === "frase") panda.reaccion("amor");
    if (ev.tipo === "necesito_amor") alertaNecesitaAmor();
    if (ev.tipo === "pedir_ubicacion") {
      if (E.yo.compartir_auto) compartirMiUbicacion(); else preguntaUbicacion();
    }
    if (ev.tipo === "ubicacion") aviso(`📍 ${n.otro} compartió dónde está · tocá "¿Dónde estás?"`);
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
    const sistema = { comida: "le dio bambú 🎋", caricia: "le hizo mimos 🤗", necesito_amor: "necesita amor 💗", pedir_ubicacion: "preguntó dónde estás 📍", ubicacion: "compartió su ubicación 📍" };
    // agrupar mimos seguidos para no llenar el chat
    const filas = [];
    for (const e of lista) {
      if (e.tipo === "mensaje" || e.tipo === "frase") {
        filas.push(`<div class="msj ${e.tipo === "frase" ? "frase" : ""} ${e.de === yoId ? "mio" : "suyo"}">${esc(e.texto)}<small>${R.fechaCorta(e.creado)}</small>
          <button class="fav" data-fav="${e.id}" title="Guardar en recuerdos">${e.favorito ? "💖" : "🤍"}</button></div>`);
      } else if (e.tipo === "sistema") {
        filas.push(`<div class="sistema">🐣 Nació ${esc(E.mascota.nombre)} · ${R.fechaCorta(e.creado)}</div>`);
      } else if (sistema[e.tipo]) {
        const txt = `${esc(nombreDe(e.de))} ${sistema[e.tipo]}`;
        const ult = filas[filas.length - 1];
        if (ult && ult.includes(`data-t="${txt}"`)) {
          filas[filas.length - 1] = ult.replace(/data-n="(\d+)"[^<]*/, (_, k) => `data-n="${+k + 1}" data-t="${txt}">${txt} ×${+k + 1}`);
        } else filas.push(`<div class="sistema" data-n="1" data-t="${txt}">${txt}</div>`);
      }
    }
    $("#chat").innerHTML = filas.join("") || `<div class="sistema">Todavía no hay mensajes. ¡Escribí el primero!</div>`;
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
    $("#recuerdos").innerHTML = `
      <h2 class="titulo-vista">Recuerdos 🌸</h2>
      <div class="tarjeta"><div class="stats">
        <div><b>${dias}</b><span>días juntos</span></div>
        <div><b>${m.mejor_racha}</b><span>mejor racha</span></div>
        <div><b>${m.amor}</b><span>amor total</span></div>
        <div><b>${m.comidas_total}</b><span>bambúes</span></div>
        <div><b>${m.caricias_total}</b><span>mimos</span></div>
        <div><b>${m.frases_total}</b><span>frases</span></div>
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
      </div></div>`;
  }

  // ---------------------------------------------------------------
  //  AJUSTES
  // ---------------------------------------------------------------
  async function pintarAjustes() {
    try { usoGemini = await D.usoGemini(); } catch {}
    const lim = D.limiteGemini || 60;
    const motor = Voz.motor;
    const clave = leer("panda-clave", "");
    const android = P.esAndroid();
    const perm = android ? P.permisos() : {};
    $("#ajustes").innerHTML = `
      <h2 class="titulo-vista">Ajustes ⚙️</h2>
      ${android ? `<div class="tarjeta"><h3>🐼 Panda en la pantalla</h3>
        <div class="fila"><div>Panda flotante<div class="desc">Camina por la pantalla aunque uses otras apps</div></div>
          <label class="interruptor"><input type="checkbox" id="a-flotante" ${P.flotanteActivo() ? "checked" : ""}><span></span></label></div>
        <div class="fila"><div>Permisos<div class="desc">${perm.flotante ? "✅" : "❌"} Mostrar sobre otras apps · ${perm.notificaciones ? "✅" : "❌"} Notificaciones · ${perm.ubicacion ? "✅" : "❌"} Ubicación · ${perm.bateria ? "✅" : "⚠️"} Sin límite de batería</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${perm.flotante ? "" : `<button class="btn btn-sec btn-chico" data-permiso="flotante">Permitir flotante</button>`}
          ${perm.notificaciones ? "" : `<button class="btn btn-sec btn-chico" data-permiso="notificaciones">Notificaciones</button>`}
          ${perm.ubicacion ? "" : `<button class="btn btn-sec btn-chico" data-permiso="ubicacion">Ubicación</button>`}
          ${perm.bateria ? "" : `<button class="btn btn-sec btn-chico" data-permiso="bateria">Batería</button>`}
        </div>
        <button class="btn btn-sec btn-ancho btn-chico" id="a-actualizar" style="margin-top:8px">🔄 Buscar actualización${P.versionApp() ? ` (tenés la 1.${P.versionApp()})` : ""}</button>
        </div>` : ""}

      <div class="tarjeta"><h3>🔊 Voz de ${esc(nombres().panda)}</h3>
        <div class="segmentos" id="a-motor">
          ${android ? `<button data-motor="piper" class="${motor === "piper" ? "activo" : ""}">Daniela</button>
          <button data-motor="celular" class="${motor === "celular" ? "activo" : ""}">Voz del celu</button>` : ""}
          <button data-motor="mascota" class="${motor === "mascota" ? "activo" : ""}">Idioma panda</button>
          ${android ? "" : `<button data-motor="navegador" class="${motor === "navegador" ? "activo" : ""}">Navegador</button>`}
        </div>
        ${android ? `<p class="nota" id="a-piper" style="margin-top:8px"></p>
          <p class="nota">Si Daniela no está o falla, habla con la voz del celu. <button class="btn btn-chico" id="a-tts">Cambiar voz del celu</button></p>` : `<p class="nota" style="margin-top:8px">La voz real (Daniela, sin internet) funciona en la app Android.</p>`}
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
        </div>
        <div class="campo" style="margin-top:12px"><label>Vista previa de crecimiento (amor)</label><input type="range" id="a-previa" min="0" max="11000" step="100" value="${E.mascota.amor}"></div>
      </div>` : ""}

      <div class="tarjeta">
        <button class="btn btn-sec btn-ancho btn-chico" id="a-salir" style="color:#d6336c">Salir de la pareja</button>
        <p class="nota" style="margin-top:8px">${D.modo === "demo" ? "Modo demo: los datos están solo en este navegador." : "Conectado a Supabase ✅"}</p>
      </div>`;

    $$("[data-permiso]").forEach((b) => b.addEventListener("click", () => P.pedirPermiso(b.dataset.permiso)));
    $("#a-flotante")?.addEventListener("change", (e) => {
      const r = P.activarFlotante(e.target.checked);
      if (r === "permiso") { aviso("Activá \"Mostrar sobre otras apps\" y volvé"); e.target.checked = false; }
    });
    $$("[data-motor]").forEach((b) => b.addEventListener("click", () => { Voz.motor = b.dataset.motor; pintarAjustes(); }));
    $("#a-tono").addEventListener("change", (e) => { Voz.tono = +e.target.value; decir("¡Hola! ¿Así te gusta mi voz?"); });
    $("#a-voz").addEventListener("change", (e) => { Voz.activa = e.target.checked; });
    $("#a-probar").addEventListener("click", () => decir(`Hola ${nombres().yo}, soy ${nombres().panda}. ¡Te quiero mucho!`));
    $("#a-auto").addEventListener("change", async (e) => { E = await D.ajustes({ auto: e.target.checked }); });
    $("#a-guardar").addEventListener("click", async () => {
      try { E = await D.ajustes({ nombre: $("#a-nombre").value.trim(), panda: $("#a-panda").value.trim() }); actualizarTodo(false); aviso("Guardado 💗"); } catch (er) { aviso(er.message); }
    });
    $$("[data-sim]").forEach((b) => b.addEventListener("click", () => { D.simular(b.dataset.sim); aviso("Simulado: " + b.textContent); }));
    $("#a-previa")?.addEventListener("input", (e) => { D.vistaPrevia(+e.target.value); });
    $("#a-salir").addEventListener("click", async () => {
      if (!confirm("¿Seguro? Si los dos salen, el panda se borra para siempre.")) return;
      await D.salir(); localStorage.removeItem("panda-clave"); location.reload();
    });
    if (android) {
      const pintarPiper = () => {
        const el = $("#a-piper"); if (!el || vista !== "ajustes") return;
        const s = Voz.estadoPiper();
        if (s === "lista") el.innerHTML = "✅ Voz de Daniela instalada (funciona sin internet)";
        else if (s.startsWith("descargando")) { el.textContent = `⬇️ Descargando la voz… ${s.split(":")[1] || 0}%`; setTimeout(pintarPiper, 1000); }
        else if (s.startsWith("error:")) { el.innerHTML = `⚠️ ${s.slice(6)} <button class="btn btn-chico" id="a-bajar">Volver a probar</button>`; $("#a-bajar").onclick = () => { Voz.descargarPiper(); setTimeout(pintarPiper, 500); }; }
        else { el.innerHTML = `La voz real pesa unos 115 MB y se descarga una sola vez. <button class="btn btn-chico" id="a-bajar">Descargar</button>`; $("#a-bajar").onclick = () => { Voz.descargarPiper(); setTimeout(pintarPiper, 500); }; }
      };
      pintarPiper();
      $("#a-tts")?.addEventListener("click", () => Voz.ajustesCelular());
      $("#a-actualizar")?.addEventListener("click", () => P.buscarActualizacion());
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
    }, 900);
  }
  // La app Android también puede pedirlo sin recargar
  // al volver de dar un permiso en Android, refrescar Ajustes
  window.addEventListener("android-volvio", () => { if (vista === "ajustes") pintarAjustes(); });
  window.__accionAndroid = (a) => { const u = new URL(location.href); u.searchParams.set("accion", a); history.replaceState(null, "", u); procesarParametros(); };

  // ---------------------------------------------------------------
  //  HOJA INFERIOR Y AVISOS
  // ---------------------------------------------------------------
  function abrirHoja(html) {
    $("#hoja-cuerpo").innerHTML = html;
    $("#hoja").hidden = false; $("#hoja-fondo").hidden = false;
  }
  function cerrarHoja() { $("#hoja").hidden = true; $("#hoja-fondo").hidden = true; }
  $("#hoja-fondo").addEventListener("click", cerrarHoja);

  let tAviso;
  function aviso(t) {
    const a = $("#aviso");
    a.textContent = t; a.classList.add("visible");
    clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove("visible"), 2600);
  }

  arrancar();
})();
