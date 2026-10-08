// =============================================================
//  LA VOZ DEL PANDA (una sola voz, para que no se mezclen)
//   · En la app Android: el motor de voz del celular (Google/Samsung) con tono de nene.
//   · En el navegador: la voz del navegador con tono agudo.
//  Si ninguna está disponible, el panda solo muestra el globo (no hace ruidos raros).
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
  window.__vozEvento = (id, tipo) => {
    const cb = callbacks.get(String(id));
    if (!cb) return;
    if (tipo === "inicio") cb.alInicio?.();
    else if (tipo === "fin" || tipo === "error") { callbacks.delete(String(id)); cb.terminar(tipo); }
  };

  // Mueve la boca mientras habla (las voces no avisan el volumen)
  const bocaMientras = (cb) => setInterval(() => cb.alNivel?.(0.25 + Math.random() * 0.75), 110);

  // ---------- voz del celular (app Android) ----------
  const hayVozCelular = () => {
    try { return !!A()?.hablarCelular && A().estadoVozCelular() !== "sin-voz"; } catch { return false; }
  };
  function vozCelular(texto, tono, cb) {
    return new Promise((ok) => {
      const id = String(++contador);
      const seguro = setTimeout(() => window.__vozEvento(id, "fin"), 30000);
      let boca;
      callbacks.set(id, {
        alInicio: () => { cb.alInicio?.(); boca = bocaMientras(cb); },
        terminar: () => { clearTimeout(seguro); clearInterval(boca); cb.alNivel?.(0); ok(); },
      });
      try { A().hablarCelular(texto, tono, id); } catch { window.__vozEvento(id, "error"); }
    });
  }

  // ---------- voz del navegador ----------
  const hayVozNavegador = () => "speechSynthesis" in window;
  function vozNavegador(texto, tono, cb) {
    return new Promise((ok) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      const voces = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("es"));
      u.voice = voces.find((v) => /natural|online/i.test(v.name) && /AR/.test(v.lang)) || voces.find((v) => /natural|online|google/i.test(v.name)) || voces[0] || null;
      u.lang = u.voice?.lang || "es-AR";
      u.pitch = Math.min(2, 1 + (tono - 1) * 2.2);
      u.rate = 1.05;
      let boca, listo = false;
      const fin = () => { if (listo) return; listo = true; clearInterval(boca); cb.alNivel?.(0); ok(); };
      u.onstart = () => { cb.alInicio?.(); boca = bocaMientras(cb); };
      u.onend = u.onerror = fin;
      setTimeout(fin, 30000); // por si el navegador nunca avisa que terminó
      speechSynthesis.speak(u);
    });
  }

  const Voz = {
    get tono() { return parseFloat(leer("panda-voz-tono", "1.35")) || 1.35; },
    set tono(v) { guardar("panda-voz-tono", String(v)); },
    get activa() { return leer("panda-voz-activa", "1") === "1"; },
    set activa(v) { guardar("panda-voz-activa", v ? "1" : "0"); },

    // ¿Hay alguna voz disponible en este dispositivo? (también "despierta" la del celular)
    disponible() { return hayVozCelular() || hayVozNavegador(); },
    // Abre los ajustes de voz de Android (para elegir Google o Samsung y la voz)
    ajustesCelular() { try { A()?.ajustesVozCelular(); } catch {} },

    detener() {
      try { A()?.callar(); } catch {}
      if (hayVozNavegador()) speechSynthesis.cancel();
      callbacks.forEach((cb) => cb.terminar("fin"));
      callbacks.clear();
    },

    // Devuelve una promesa que se cumple cuando termina de hablar
    hablar(texto, cb = {}) {
      const limpio = limpiar(texto);
      if (!limpio || !this.activa) { cb.alInicio?.(); return Promise.resolve(); }
      this.detener(); // nunca dos frases a la vez
      const tono = this.tono;
      if (A() && hayVozCelular()) return vozCelular(limpio, tono, cb);
      if (hayVozNavegador()) return vozNavegador(limpio, tono, cb);
      cb.alInicio?.();
      return Promise.resolve(); // sin voz: queda solo el globo
    },
  };

  globalThis.Voz = Voz;
})();
