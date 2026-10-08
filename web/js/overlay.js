// =============================================================
//  PANDA FLOTANTE: camina por la pantalla del celular
//
//  En Android, esta página vive en una ventanita transparente.
//  La ventana la mueve la app nativa (AndroidPanda.moverA) y los
//  toques los detecta la app nativa y avisa con window.pandaToque().
//  En un navegador común se simula todo para poder probarlo.
// =============================================================
(function () {
  const R = Reglas, F = Frases, P = Puente;
  const A = window.AndroidPanda;
  const $ = (s) => document.querySelector(s);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  let D = null, E = null, panda = null;
  let ocupado = false;          // caminando, hablando o reaccionando
  let conGlobo = false;
  const MARGEN_ABAJO = 70;      // para no tapar la barra de navegación (dp)

  // ---------------------------------------------------------------
  //  VENTANA (nativa o simulada)
  // ---------------------------------------------------------------
  const pantalla = () => {
    if (A) { try { return JSON.parse(A.pantalla()); } catch {} }
    return { w: innerWidth, h: innerHeight };
  };
  const ventanaSim = { x: 0, y: 0, w: 110, h: 120 };
  let animSim = null;
  function aplicarSim(ms = 0) {
    const v = $("#ventana");
    cancelAnimationFrame(animSim);
    const fin = { x: ventanaSim.x, y: ventanaSim.y };
    const ini = { x: parseFloat(v.style.left) || fin.x, y: parseFloat(v.style.top) || fin.y };
    Object.assign(v.style, { width: ventanaSim.w + "px", height: ventanaSim.h + "px" });
    if (!ms) { Object.assign(v.style, { left: fin.x + "px", top: fin.y + "px" }); return; }
    const t0 = performance.now();
    const paso = (ts) => {
      const k = Math.min(1, (ts - t0) / ms);
      v.style.left = ini.x + (fin.x - ini.x) * k + "px";
      v.style.top = ini.y + (fin.y - ini.y) * k + "px";
      if (k < 1) animSim = requestAnimationFrame(paso);
    };
    animSim = requestAnimationFrame(paso);
  }
  const pos = () => { if (A) { try { return JSON.parse(A.posicion()); } catch {} } return { x: ventanaSim.x, y: ventanaSim.y }; };
  function moverA(x, y, ms) {
    const p = pantalla(), t = tam();
    x = Math.max(0, Math.min(p.w - t.w, x)); y = Math.max(0, Math.min(p.h - t.h, y));
    if (A) A.moverA(Math.round(x), Math.round(y), Math.round(ms));
    else { ventanaSim.x = x; ventanaSim.y = y; aplicarSim(ms); }
    return esperar(ms);
  }
  let tamActual = { w: 110, h: 120 };
  const tam = () => tamActual;
  // cambia el tamaño manteniendo al panda en el mismo lugar (anclado abajo al centro)
  function tamano(w, h) {
    const p = pos(), viejo = tamActual;
    tamActual = { w, h };
    const pan = pantalla();
    const x = Math.max(0, Math.min(pan.w - w, p.x + (viejo.w - w) / 2));
    const y = Math.max(0, Math.min(pan.h - h, p.y + (viejo.h - h)));
    if (A) A.tamano(Math.round(w), Math.round(h), Math.round(x), Math.round(y));
    else { Object.assign(ventanaSim, { x, y, w, h }); aplicarSim(0); }
  }
  function tamPanda() {
    const esc = R.etapaDe(E?.mascota?.amor || 0).escala;
    return { w: Math.round(140 * esc), h: Math.round(152 * esc) };
  }
  function ajustarPanda() {
    const t = tamPanda();
    Object.assign($("#o-panda").style, { width: t.w + "px", height: t.h + "px" });
    if (!conGlobo) tamano(t.w, t.h);
  }

  // ---------------------------------------------------------------
  //  GLOBO + VOZ
  // ---------------------------------------------------------------
  let tGlobo;
  async function decir(texto, { hablar = true, segundos } = {}) {
    if (!texto) return;
    const ms = (segundos || Math.max(4, texto.length * 0.075)) * 1000;
    conGlobo = true;
    clearTimeout(tGlobo);
    // App nueva: el globo lo dibuja Android en una ventanita aparte (la del panda no se agranda)
    if (P.globoNativo(texto, ms)) {
      tGlobo = setTimeout(() => { conGlobo = false; }, ms);
    } else {
      const t = tamPanda();
      tamano(Math.max(230, t.w + 40), t.h + 96);
      const g = $("#globo");
      g.textContent = texto; g.hidden = false;
      tGlobo = setTimeout(() => { g.hidden = true; conGlobo = false; tamano(t.w, t.h); }, ms);
    }
    // Si la app principal está abierta, habla ella: así no se pisan dos voces
    if (hablar && !P.appAbierta()) {
      panda.hablando(true);
      await Voz.hablar(texto, { alNivel: (n) => (panda.nivelVoz = n) });
      panda.hablando(false);
    }
  }

  // ---------------------------------------------------------------
  //  CAMINAR POR LA PANTALLA
  // ---------------------------------------------------------------
  async function pasear() {
    const an = R.animoVisible(E.mascota);
    if (ocupado || conGlobo || an.clave === "dormido" || E.mascota.se_fue || P.quieto()) return;
    ocupado = true;
    const p = pantalla(), t = tam(), actual = pos();
    let x, y;
    const r = Math.random();
    if (r < 0.7) { x = Math.random() * (p.w - t.w); y = p.h - t.h - MARGEN_ABAJO; }       // por abajo
    else if (r < 0.85) { x = Math.random() < 0.5 ? 0 : p.w - t.w; y = p.h * (0.3 + Math.random() * 0.4); } // en un borde
    else { x = actual.x; y = actual.y; }                                                   // se queda
    const dist = Math.hypot(x - actual.x, y - actual.y);
    if (dist > 20) {
      const ms = Math.max(1200, (dist / 65) * 1000);
      panda.caminando(true);
      await moverA(x, y, ms);
      panda.caminando(false);
    }
    // a veces hace algo tierno al llegar
    const d = Math.random();
    if (d < 0.2) panda.reaccion("saludo");
    else if (d < 0.3) panda.reaccion("sorpresa");
    ocupado = false;
  }

  function cicloPaseo() {
    pasear().catch(() => { ocupado = false; });
    setTimeout(cicloPaseo, 12000 + Math.random() * 23000);
  }

  // Cada tanto avisa si tiene hambre, está sucio, cansado o extraña mimos (sin gastar IA)
  function cicloNecesidades() {
    const m = E.mascota, an = R.animoVisible(m);
    if (!ocupado && !conGlobo && !m.se_fue) {
      if (m.aviso_abandono > 0) { panda.reaccion("triste"); decir(F.frase(`aviso_abandono_${Math.min(2, m.aviso_abandono)}`, nombres())); }
      else if (an.clave === "hambriento") { panda.reaccion("triste"); decir(F.frase("hambre", nombres())); }
      else if (an.clave === "triste") decir(F.frase("triste", nombres()));
      else if (an.clave === "sucio") decir(F.frase("sucio", nombres()));
      else if (an.clave === "cansado") { panda.reaccion("bostezo"); decir(F.frase("cansado", nombres())); }
      else if (an.clave === "sueno" && Math.random() < 0.5) { panda.reaccion("bostezo"); decir(F.frase("sueno", nombres())); }
    }
    setTimeout(cicloNecesidades, (8 + Math.random() * 7) * 60000);
  }

  const nombres = () => ({ yo: E?.yo?.nombre || "", otro: E?.otro?.nombre || "tu pareja", panda: E?.mascota?.nombre || "Pandi" });

  function refrescarAspecto() {
    const m = E.mascota, et = R.etapaDe(m.amor), antes = panda.etapa;
    panda.setEtapa(et.indice);
    panda.setAnimo(R.animoVisible(m).clave);
    panda.setAccesorios(m.puestos || []);
    panda.setLimpieza(R.limpieza(m));
    panda.setMochila(!!m.se_fue);
    ajustarPanda();
    if (et.indice > antes) decir(F.frase("crecer", { etapa: et.nombre }));
  }

  // ---------------------------------------------------------------
  //  TOQUES (los manda la app nativa, o el simulador)
  // ---------------------------------------------------------------
  window.pandaToque = async (tipo) => {
    if (!E?.pareja) return P.abrirApp("");
    if (tipo === "arrastre_inicio") { panda.colgando(true); return; }
    if (tipo === "arrastre_fin") { panda.colgando(false); return; }
    if (tipo === "doble") return P.abrirApp("");
    if (tipo === "sacudir") {
      // sacudirlo = "¡Llegué, amor!"
      if (!E.otro || E.mascota.se_fue) return decir("¡Uy, me mareé! 😵");
      panda.reaccion("sorpresa"); P.vibrar("caricia");
      try { await D.accion("llegue", null); decir(`¡Uy, me mareé! Ya le avisé a ${nombres().otro} que llegaste 💗`); }
      catch { decir("No pude avisarle, ¿hay internet?"); }
      return;
    }
    if (tipo === "triple") {
      // 3 toques: se queda fijo donde está (o vuelve a pasear)
      const q = !P.quieto();
      P.ponerQuieto(q);
      P.vibrar("caricia");
      panda.reaccion(q ? "sorpresa" : "saludo");
      return decir(q ? "¡Me quedo quietito acá! 📌 Tocame 3 veces para volver a pasear." : "¡Yupi, a pasear! 🐾", { segundos: 4 });
    }
    if (tipo === "tap") {
      if (E.mascota.se_fue) return decir("Me fui… 🎒 Abran la app para adoptar un panda nuevo.");
      panda.reaccion("caricia");
      P.vibrar("caricia");
      try {
        const r = await D.accion("caricia");
        if (r.mascota) { E.mascota = { ...E.mascota, ...r.mascota }; refrescarAspecto(); }
        if (r.nota === "racha") { panda.reaccion("amor"); decir(F.frase("racha", { ...nombres(), racha: r.racha })); }
        else if (E.mascota.durmiendo) { if (Math.random() < 0.3) decir(F.frase("durmiendo_toque", nombres())); }
        // cuando muestra el globo, siempre habla (antes a veces quedaba mudo)
        else if (r.nota === "tope_caricias" || Math.random() < 0.35) decir(F.frase(r.nota === "tope_caricias" ? "tope_caricias" : "caricia", nombres()));
      } catch {}
      return;
    }
    if (tipo === "largo") {
      if (!E.otro) return decir("Todavía falta que se una tu pareja.");
      panda.reaccion("necesita");
      try { await D.accion("necesito_amor"); decir(F.frase("necesito_amor_enviado", nombres())); }
      catch { decir("No pude avisarle, ¿hay internet?"); }
    }
  };

  // ---------------------------------------------------------------
  //  LO QUE LLEGA DE LA PAREJA
  // ---------------------------------------------------------------
  async function alRecibir({ tipo, fila }) {
    if (tipo === "mascota") { E.mascota = { ...E.mascota, ...fila }; return refrescarAspecto(); }
    if (tipo !== "evento" || fila.de === E.yo.id) return;
    const ev = fila;
    if (["compra", "desafio"].includes(ev.tipo)) return;
    if (!E.otro || ev.tipo === "sistema") {
      E = await D.estado(); refrescarAspecto();
      if (ev.tipo === "sistema") {
        // avisos de abandono: notificación aunque la app esté cerrada
        const t = ev.texto || "", np = E.mascota.nombre;
        if (t.startsWith("aviso_abandono|")) {
          const nivel = t.split("|")[1] === "2" ? 2 : 1;
          if (!P.pushActivo()) P.vibrar("aviso");
          if (!P.pushActivo()) P.notificar(nivel === 2 ? `🎒 ${np} está por irse` : `🥺 ${np} se siente solo`, nivel === 2 ? "Última oportunidad: cuídenlo hoy o se va." : "Hace días que nadie lo cuida.", "aviso");
          panda.reaccion("triste"); decir(F.frase(`aviso_abandono_${nivel}`, nombres()));
        } else if (t.startsWith("se_fue|")) {
          if (!P.pushActivo()) P.notificar(`🎒 ${t.split("|")[1]} se fue`, "Nadie lo cuidó por 7 días. Abran la app para adoptar uno nuevo.", "aviso");
          decir("Me voy… cuídense mucho. 🎒");
        }
        return;
      }
    }
    if (["banio", "dormir", "despertar", "comer", "juego"].includes(ev.tipo)) { try { E = await D.estado(); refrescarAspecto(); } catch {} }
    const n = { ...nombres(), texto: ev.texto || "", item: R.TIENDA[ev.texto]?.nombre.toLowerCase() || "" };
    let texto = F.deOtro(ev.tipo, n);
    const sent = ev.tipo === "sentir" ? F.SENTIMIENTOS.find((x) => String(ev.texto).startsWith(x.emoji)) : null;
    if (sent) texto = (F.RESPUESTA_SENTIR[sent.id] || texto).replace(/\{otro\}/g, n.otro);
    if (ev.tipo === "llegue") texto = `¡${n.otro} llegó ${ev.texto || "bien"}! Qué alivio.`;
    if (ev.tipo === "alerta") texto = F.deOtro(ev.texto === "hombre" ? "alerta_hombre" : "alerta_mujer", n);
    if (ev.tipo === "ubicacion" && ev.texto === "en_vivo") texto = F.deOtro("ubicacion_vivo", n);
    // si llegan las push, la notificación y la vibración las hace Firebase (no repetir)
    const conPush = P.pushActivo() && ["necesito_amor", "pedir_ubicacion", "mensaje", "frase", "ubicacion", "sentir", "foto", "pregunta", "alerta", "llegue"].includes(ev.tipo);
    if (!conPush) P.vibrar(ev.tipo);
    // notificación del sistema (la app nativa la omite si la app principal está abierta)
    const titulos = {
      necesito_amor: `💗 ${n.otro} necesita amor`, pedir_ubicacion: `📍 ${n.otro} quiere saber dónde estás`,
      mensaje: `💬 ${n.otro}`, frase: `💌 Frase de ${n.otro}`, caricia: `🤗 ${n.otro} le hizo mimos a ${n.panda}`,
      comida: `🎋 ${n.otro} le dio bambú a ${n.panda}`, ubicacion: `📍 ${n.otro} compartió su ubicación`,
      sentir: `💭 ${n.otro}: ${sent ? sent.texto : "cómo se siente"}`, foto: `📸 ${n.otro} te mandó una foto`,
      pregunta: `❓ ${n.otro} respondió la pregunta del día`, alerta: "🚨 ¡ALERTA! 🚨", llegue: `🏠 ${n.otro} llegó ${ev.texto || "bien"}`,
    };
    const cuerpo = { necesito_amor: "Tocá para mandarle mimos", pedir_ubicacion: "Tocá para compartir tu ubicación", mensaje: ev.texto, frase: ev.texto,
      sentir: String(ev.texto || "").split(" · ").slice(1).join(" · ") || "Tocá para responderle", foto: ev.texto && ev.texto !== "📸" ? ev.texto : "Tocá para verla", pregunta: "Respondé para ver qué puso",
      llegue: "¡Llegué, amor! 💗",
      alerta: `${n.otro} quiere saber: ¿estás con ${ev.texto === "hombre" ? "otro hombre" : "otra mujer"}? 🤨` };
    if (["necesito_amor", "pedir_ubicacion", "mensaje", "frase", "ubicacion", "sentir", "foto", "pregunta", "alerta", "llegue"].includes(ev.tipo) && !(ev.tipo === "pedir_ubicacion" && E.yo.compartir_auto)) {
      if (!conPush) P.notificar(titulos[ev.tipo], cuerpo[ev.tipo] || "", ev.tipo);
    }
    // reacción del panda
    const reac = { caricia: "caricia", comida: "comida", comer: "comida", frase: "amor", necesito_amor: "necesita", mensaje: "sorpresa",
      banio: "amor", juego: "amor", foto: "sorpresa", alerta: "necesita", llegue: "amor", despertar: "saludo", sentir: sent && F.TRISTES.includes(sent.id) ? "triste" : "amor" }[ev.tipo];
    if (reac) panda.reaccion(reac);
    if (ev.tipo === "pedir_ubicacion" && E.yo.compartir_auto) {
      try {
        const u = await P.obtenerUbicacion();
        await D.compartirUbicacion(u.lat, u.lng, u.prec);
        return decir(`Le conté a ${n.otro} dónde estás.`);
      } catch { /* si falla, queda la notificación normal */ P.notificar(titulos.pedir_ubicacion, cuerpo.pedir_ubicacion, "pedir_ubicacion"); }
    }
    if (texto) decir(texto);
  }

  // ---------------------------------------------------------------
  //  SIMULADOR (solo navegador)
  // ---------------------------------------------------------------
  function simulador() {
    document.body.classList.add("simulado");
    const v = $("#ventana");
    let abajo = null, movio = false, tLargo, toques = 0, tTap;
    let ultX = null, dirX = 0, giros = 0, desde = 0, sacudido = false;
    v.addEventListener("pointerdown", (e) => {
      abajo = { x: e.clientX, y: e.clientY, vx: ventanaSim.x, vy: ventanaSim.y }; movio = false;
      ultX = e.clientX; dirX = 0; giros = 0; sacudido = false;
      v.setPointerCapture(e.pointerId);
      tLargo = setTimeout(() => { if (!movio) { abajo = null; window.pandaToque("largo"); } }, 600);
    });
    v.addEventListener("pointermove", (e) => {
      if (!abajo) return;
      const dx = e.clientX - abajo.x, dy = e.clientY - abajo.y;
      if (!movio && Math.hypot(dx, dy) > 10) { movio = true; clearTimeout(tLargo); window.pandaToque("arrastre_inicio"); }
      if (movio) { ventanaSim.x = abajo.vx + dx; ventanaSim.y = abajo.vy + dy; aplicarSim(0); }
      // sacudir (izquierda-derecha rápido) = "¡Llegué!"
      if (ultX == null) ultX = e.clientX;
      const d = e.clientX - ultX;
      if (Math.abs(d) >= 14) {
        const nd = d > 0 ? 1 : -1, ahora = Date.now();
        if (dirX && nd !== dirX) {
          if (!giros || ahora - desde > 1600) { giros = 0; desde = ahora; }
          if (++giros >= 4 && !sacudido) { sacudido = true; window.pandaToque("sacudir"); }
        }
        dirX = nd; ultX = e.clientX;
      }
    });
    v.addEventListener("pointerup", () => {
      clearTimeout(tLargo);
      if (!abajo) return;
      if (movio) { window.pandaToque("arrastre_fin"); abajo = null; return; }
      abajo = null;
      // igual que en Android: 1 toque = mimos, 2 = abrir la app, 3 = quieto / pasear
      toques++;
      clearTimeout(tTap);
      tTap = setTimeout(() => { const n = toques; toques = 0; window.pandaToque(n >= 3 ? "triple" : n === 2 ? "doble" : "tap"); }, 320);
    });
    P.abrirApp = () => { location.href = "index.html"; };
  }

  // ---------------------------------------------------------------
  async function arrancar() {
    if (!A) simulador();
    // 60 cuadros por segundo: igual de fluido que siempre, pero en pantallas de 120 Hz gasta la mitad.
    // OJO: con menos (ej. 24) la boca se traba porque sus resortes son muy rápidos.
    panda = new Panda($("#o-panda"), { etapa: 0, fps: 60 });
    try {
      D = await crearDatos();
      E = await D.iniciar();
    } catch (e) {
      return decir("No me pude conectar 😢", { hablar: false, segundos: 8 });
    }
    if (!E.pareja) {
      ajustarPanda();
      return decir("¡Hola! Abrime para crear nuestro panda.", { hablar: false, segundos: 10 });
    }
    refrescarAspecto();
    const p = pantalla(), t = tamPanda();
    if (!A) { ventanaSim.x = p.w - t.w - 20; ventanaSim.y = p.h - t.h - MARGEN_ABAJO; aplicarSim(0); }
    D.suscribir((x) => alRecibir(x).catch(() => {}));
    if (!E.mascota.se_fue && !E.mascota.durmiendo) setTimeout(() => decir(F.saludo(nombres()), { hablar: false, segundos: 5 }), 800);
    setTimeout(cicloPaseo, 4000);
    setTimeout(cicloNecesidades, 90000);
    setInterval(async () => { try { E = await D.estado(); refrescarAspecto(); } catch {} }, 10 * 60000);
    // si se publicó una versión nueva de la web, el panda flotante se recarga solo
    if (D.modo === "supabase") {
      const version = async () => { try { const r = await fetch("/api/config?solo=version", { cache: "no-store" }); return r.ok ? (await r.json()).version : null; } catch { return null; } };
      const inicial = await version();
      setInterval(async () => { const v = await version(); if (inicial && v && v !== inicial && !conGlobo && !ocupado) location.reload(); }, 30 * 60000);
    }
  }

  window.__pandaFlotante = { pasear, decir }; // para pruebas
  arrancar();
})();
