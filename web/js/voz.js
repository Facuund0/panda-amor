// =============================================================
//  LA VOZ DEL PANDA
//  Tres motores:
//   · "piper"     → voz real de Daniela (Argentina), sin internet ni límites.
//                   La genera la app Android (sherpa-onnx). Tono de nene ajustable.
//   · "mascota"   → idioma de mascota: sonidos tiernos al ritmo del texto.
//   · "navegador" → voz del navegador con tono agudo (respaldo).
//  En la web (sin la app Android) se usa "mascota" por defecto.
// =============================================================
(function () {
  const A = () => window.AndroidPanda;
  const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function limpiar(t) {
    return String(t)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (_, d, m) => (MESES[+m] ? `${+d} de ${MESES[+m]}` : `${d}/${m}`))
      .replace(/(\d+)\s?%/g, "$1 por ciento")
      .replace(/\s+/g, " ")
      .trim();
  }

  const callbacks = new Map();
  let contador = 0;
  // La app Android llama a esta función cuando empieza/termina de hablar
  window.__vozEvento = (id, tipo, dato) => {
    const cb = callbacks.get(String(id));
    if (!cb) return;
    if (tipo === "inicio") cb.alInicio?.();
    else if (tipo === "nivel") cb.alNivel?.(+dato || 0);
    else if (tipo === "fin" || tipo === "error") { callbacks.delete(String(id)); cb.terminar(tipo); }
  };

  // ---------- idioma de mascota (WebAudio) ----------
  let ctx = null;
  function audio() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
    if (ctx?.state === "suspended") ctx.resume();
    return ctx;
  }
  const VOC = { a: [800, 1250], e: [450, 2000], i: [320, 2400], o: [500, 900], u: [330, 800] };
  function balbucear(texto, tono, { alInicio, alNivel } = {}) {
    const c = audio();
    if (!c) return Promise.resolve();
    const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const frases = t.split(/(?<=[.!?])\s*/).filter(Boolean);
    let cuando = c.currentTime + 0.05;
    const golpes = [];
    const salida = c.createGain(); salida.gain.value = 0.22; salida.connect(c.destination);
    for (const frase of frases) {
      const pregunta = frase.includes("?"), exclama = frase.includes("!");
      const silabas = frase.match(/[^aeiou\W\d]*[aeiou]+/g) || [];
      silabas.slice(0, 60).forEach((sy, i) => {
        const v = sy[sy.length - 1];
        const ultimo = i >= silabas.length - 2;
        const f0 = (430 + Math.random() * 110) * tono * (pregunta && ultimo ? 1.25 : exclama && i === 0 ? 1.15 : 1);
        const dur = 0.065 + Math.random() * 0.03;
        const o = c.createOscillator(); o.type = "triangle";
        o.frequency.setValueAtTime(f0, cuando);
        o.frequency.linearRampToValueAtTime(f0 * (pregunta && ultimo ? 1.18 : 0.94), cuando + dur);
        const [f1, f2] = VOC[v] || [600, 1500];
        const b1 = c.createBiquadFilter(); b1.type = "bandpass"; b1.frequency.value = f1 * 1.15; b1.Q.value = 3;
        const b2 = c.createBiquadFilter(); b2.type = "bandpass"; b2.frequency.value = f2 * 1.1; b2.Q.value = 4;
        const g = c.createGain();
        g.gain.setValueAtTime(0, cuando);
        g.gain.linearRampToValueAtTime(1, cuando + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, cuando + dur);
        o.connect(b1); o.connect(b2); o.connect(g); b1.connect(g); b2.connect(g); g.connect(salida);
        o.start(cuando); o.stop(cuando + dur + 0.02);
        golpes.push([cuando, cuando + dur]);
        cuando += dur + 0.02;
      });
      cuando += 0.25;
    }
    const fin = cuando;
    alInicio?.();
    return new Promise((ok) => {
      const tick = () => {
        const ahora = c.currentTime;
        const activo = golpes.some(([a, b]) => ahora >= a && ahora <= b);
        alNivel?.(activo ? 0.8 : 0);
        if (ahora < fin) requestAnimationFrame(tick); else { alNivel?.(0); ok(); }
      };
      tick();
    });
  }

  // ---------- voz del navegador ----------
  function vozNavegador(texto, tono, { alInicio, alNivel } = {}) {
    if (!("speechSynthesis" in window)) return balbucear(texto, tono, { alInicio, alNivel });
    return new Promise((ok) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      const voces = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("es"));
      u.voice = voces.find((v) => /natural|online/i.test(v.name) && /AR/.test(v.lang)) || voces.find((v) => /natural|online|google/i.test(v.name)) || voces[0] || null;
      u.lang = u.voice?.lang || "es-AR";
      u.pitch = Math.min(2, 1 + (tono - 1) * 2.2);
      u.rate = 1.05;
      let iv;
      u.onstart = () => { alInicio?.(); iv = setInterval(() => alNivel?.(0.3 + Math.random() * 0.7), 110); };
      u.onend = u.onerror = () => { clearInterval(iv); alNivel?.(0); ok(); };
      speechSynthesis.speak(u);
    });
  }

  const Voz = {
    get motor() { return leer("panda-voz-motor", A() ? "piper" : "mascota"); },
    set motor(v) { guardar("panda-voz-motor", v); },
    get tono() { return parseFloat(leer("panda-voz-tono", "1.35")) || 1.35; },
    set tono(v) { guardar("panda-voz-tono", String(v)); },
    get activa() { return leer("panda-voz-activa", "1") === "1"; },
    set activa(v) { guardar("panda-voz-activa", v ? "1" : "0"); },
    hayPiper: () => !!A(),

    // "lista" | "falta" | "descargando:45" | "no-disponible"
    estadoPiper() {
      try { return A() ? A().estadoVoz() : "no-disponible"; } catch { return "no-disponible"; }
    },
    descargarPiper() { try { A()?.descargarVoz(); } catch {} },

    detener() {
      try { A()?.callar(); } catch {}
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      callbacks.forEach((cb) => cb.terminar("fin"));
      callbacks.clear();
    },

    // Devuelve una promesa que se cumple cuando termina de hablar
    hablar(texto, cb = {}) {
      const limpio = limpiar(texto);
      if (!limpio || !this.activa) { cb.alInicio?.(); return Promise.resolve(); }
      audio(); // "despierta" el audio con el gesto del usuario
      const motor = this.motor, tono = this.tono;
      if (motor === "piper" && A() && this.estadoPiper() === "lista") {
        return new Promise((ok) => {
          const id = String(++contador);
          const seguro = setTimeout(() => window.__vozEvento(id, "error"), 30000);
          let boca; // la app no manda el volumen: la boca se mueve sola mientras habla
          callbacks.set(id, {
            ...cb,
            alInicio: () => { cb.alInicio?.(); boca = setInterval(() => cb.alNivel?.(0.25 + Math.random() * 0.75), 110); },
            terminar: (tipo) => {
              clearTimeout(seguro); clearInterval(boca);
              cb.alNivel?.(0);
              if (tipo === "error") balbucear(limpio, tono, cb).then(ok); else ok();
            },
          });
          try { A().hablar(limpio, tono, id); } catch { window.__vozEvento(id, "error"); }
        });
      }
      if (motor === "navegador") return vozNavegador(limpio, tono, cb);
      return balbucear(limpio, tono, cb);
    },
  };

  globalThis.Voz = Voz;
})();
