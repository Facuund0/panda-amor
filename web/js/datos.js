// =============================================================
//  DATOS: todo lo que se guarda y se comparte entre los dos celulares
//
//  Dos modos con la MISMA interfaz:
//   · Supabase (real): cuando /api/config devuelve las claves.
//   · Demo (local): si no hay configuración. Guarda en el navegador y
//     simula a tu pareja, para probar la app sin configurar nada.
// =============================================================
(function () {
  const R = globalThis.Reglas;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const API = (ruta) => new URL(`api/${ruta}`, location.href.replace(/[^/]*$/, "")).href;

  // ---------------------------------------------------------------
  //  SUPABASE
  // ---------------------------------------------------------------
  class DatosSupabase {
    constructor(cfg) {
      this.modo = "supabase";
      this.cfg = cfg;
      this.sb = globalThis.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "panda-sesion" },
        realtime: { params: { eventsPerSecond: 5 } },
      });
      this.oyentes = [];
    }

    async iniciar() {
      let { data } = await this.sb.auth.getSession();
      if (!data.session) {
        const r = await this.sb.auth.signInAnonymously();
        if (r.error) throw new Error("No se pudo iniciar sesión: " + r.error.message + ". ¿Activaste los usuarios anónimos en Supabase?");
      }
      return this.estado();
    }

    async rpc(nombre, args = {}) {
      const { data, error } = await this.sb.rpc(nombre, args);
      if (error) throw new Error(error.message);
      return data;
    }

    async estado() { this._estado = await this.rpc("mi_estado"); return this._estado; }
    crearPareja(nombre, panda) { return this.rpc("crear_pareja", { mi_nombre: nombre, nombre_panda: panda }); }
    unirse(codigo, nombre) { return this.rpc("unirse_pareja", { codigo_pareja: codigo, mi_nombre: nombre }); }
    recuperar(codigo, clave) { return this.rpc("recuperar_lugar", { codigo_pareja: codigo, clave }); }
    accion(tipo, texto = null) { return this.rpc("registrar_accion", { tipo_accion: tipo, texto_accion: texto }); }
    ajustes({ nombre = null, panda = null, auto = null }) { return this.rpc("ajustes", { mi_nombre: nombre, nombre_panda: panda, auto_ubicacion: auto }); }
    favorito(id, valor) { return this.rpc("marcar_favorito", { evento_id: id, valor }); }
    salir() { return this.rpc("salir_de_pareja"); }
    usoGemini() { return this.rpc("mi_uso_gemini"); }
    compartirUbicacion(lat, lng, prec) { return this.rpc("compartir_ubicacion", { la: lat, ln: lng, prec: Math.round(prec || 0) }); }

    async ubicacionDe(userId) {
      const { data, error } = await this.sb.from("ubicaciones").select("lat,lng,precision_m,actualizada").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }

    async eventos({ limite = 60, tipos = null, favoritos = false } = {}) {
      let q = this.sb.from("eventos").select("id,de,tipo,texto,favorito,creado").order("creado", { ascending: false }).limit(limite);
      if (tipos) q = q.in("tipo", tipos);
      if (favoritos) q = q.eq("favorito", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    }

    // cb({ tipo: "evento"|"mascota", fila })
    suscribir(cb) {
      const p = this._estado?.pareja?.id;
      if (!p) return;
      this.canal?.unsubscribe();
      this.canal = this.sb.channel("pareja-" + p)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos", filter: `pareja_id=eq.${p}` }, (x) => cb({ tipo: "evento", fila: x.new }))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mascotas", filter: `pareja_id=eq.${p}` }, (x) => cb({ tipo: "mascota", fila: x.new }))
        .subscribe((estado) => cb({ tipo: "conexion", fila: estado }));
    }

    async token() { const { data } = await this.sb.auth.getSession(); return data.session?.access_token; }

    // Pide algo al panda con IA (Gemini) a través de Vercel
    async panda(accion, datos = {}) {
      const r = await fetch(API("panda"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await this.token()) },
        body: JSON.stringify({ accion, ...datos }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && !d.limite) throw new Error(d.error || "HTTP " + r.status);
      return d;
    }
  }

  // ---------------------------------------------------------------
  //  DEMO (sin internet): simula a tu pareja
  // ---------------------------------------------------------------
  const CLAVE_DEMO = "panda-demo-v1";
  const YO = "demo-yo", OTRO = "demo-otro";
  const RESPUESTAS_OTRO = [
    "Te extraño mucho 🥺", "Sos lo más lindo que me pasó 💗", "¿Ya comiste? Cuidate mucho", "Jajaja te amo",
    "Hoy pensé en vos todo el día", "Quiero abrazarte ya", "Pandi está enorme 😍", "Buenas noches mi amor 🌙",
  ];

  class DatosDemo {
    constructor() {
      this.modo = "demo";
      this.oyentes = [];
      try { this.db = JSON.parse(localStorage.getItem(CLAVE_DEMO)); } catch {}
      this.limiteGemini = 60;
    }
    guardar() { try { localStorage.setItem(CLAVE_DEMO, JSON.stringify(this.db)); } catch {} }
    hoy() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
    async iniciar() { return this.estado(); }
    async estado() {
      const db = this.db;
      if (!db) return { pareja: null };
      return {
        pareja: { id: "demo", codigo: db.codigo },
        yo: { id: YO, nombre: db.yo.nombre, lugar: 1, compartir_auto: db.yo.compartir_auto },
        otro: { id: OTRO, nombre: db.otro.nombre, lugar: 2 },
        mascota: { ...db.mascota },
        hoy: this.hoy(),
      };
    }
    async crearPareja(nombre, panda, nombreOtro = "Sofi") {
      const ahora = new Date().toISOString();
      this.db = {
        codigo: "DEMO42",
        yo: { nombre, compartir_auto: false, ultimo_dia: null, caricias_hoy: 0, mensajes_hoy: 0, dia: null },
        otro: { nombre: nombreOtro, ultimo_dia: null },
        mascota: {
          pareja_id: "demo", nombre: panda || "Pandi", amor: 0, racha: 0, mejor_racha: 0, racha_dia: null,
          ultima_comida: new Date(Date.now() - 6 * 3600e3).toISOString(), ultima_caricia: ahora,
          comidas_total: 0, caricias_total: 0, frases_total: 0, animo: "feliz", animo_nota: null,
          mensajes_sin_analizar: 0, frase_dia: null, frase_fecha: null, nacio: ahora, actualizada: ahora,
        },
        eventos: [], ubicaciones: {}, uso: {}, seq: 1,
      };
      this.agregarEvento(YO, "sistema", "nacio", false);
      this.guardar();
      return { codigo: "DEMO42", clave: "DEMOCLAV" };
    }
    async unirse() { throw new Error("En el modo demo solo se puede crear un panda."); }
    async recuperar() { throw new Error("En el modo demo no hace falta recuperar."); }

    agregarEvento(de, tipo, texto, avisar = true) {
      const ev = { id: this.db.seq++, de, tipo, texto: texto || null, favorito: false, creado: new Date().toISOString() };
      this.db.eventos.unshift(ev);
      this.db.eventos = this.db.eventos.slice(0, 500);
      this.guardar();
      if (avisar) setTimeout(() => this.emitir({ tipo: "evento", fila: { ...ev, pareja_id: "demo" } }), 30);
      return ev;
    }
    emitir(x) { this.oyentes.forEach((cb) => cb(x)); }
    suscribir(cb) { this.oyentes = [cb]; setTimeout(() => cb({ tipo: "conexion", fila: "SUBSCRIBED" }), 50); }

    // Mismas reglas que registrar_accion en schema.sql
    async accion(tipo, texto = null, quien = YO) {
      const db = this.db, m = db.mascota, d = this.hoy();
      const yo = quien === YO ? db.yo : db.otro;
      if (["frase", "mensaje"].includes(tipo) && !String(texto || "").trim()) throw new Error("Falta el texto");
      if (yo.dia !== d) { yo.caricias_hoy = 0; yo.mensajes_hoy = 0; yo.dia = d; }
      let suma = 0, extra = 0, nota = null;
      if (tipo === "comida") {
        if (Date.now() - new Date(m.ultima_comida) < 2 * 3600e3) nota = "lleno"; else suma = 5;
        m.ultima_comida = new Date().toISOString(); m.comidas_total++;
      } else if (tipo === "caricia") {
        yo.caricias_hoy = (yo.caricias_hoy || 0) + 1;
        if (yo.caricias_hoy <= 15) suma = 2; else nota = "tope_caricias";
        m.ultima_caricia = new Date().toISOString(); m.caricias_total++;
      } else if (tipo === "frase") { suma = 8; m.frases_total++; m.mensajes_sin_analizar++; }
      else if (tipo === "mensaje") { yo.mensajes_hoy = (yo.mensajes_hoy || 0) + 1; if (yo.mensajes_hoy <= 15) suma = 3; m.mensajes_sin_analizar++; }
      if (["comida", "caricia", "frase", "mensaje"].includes(tipo)) {
        yo.ultimo_dia = d;
        const otro = quien === YO ? db.otro : db.yo;
        if (m.racha_dia !== d && otro.ultimo_dia === d) {
          const ayer = new Date(Date.now() - 86400e3); const ay = new Date(ayer.getTime() - ayer.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          m.racha = m.racha_dia === ay ? m.racha + 1 : 1;
          m.racha_dia = d; m.mejor_racha = Math.max(m.mejor_racha, m.racha);
          extra = Math.min(40, 10 + 2 * m.racha); nota = nota || "racha";
        }
      }
      m.amor += suma + extra;
      m.actualizada = new Date().toISOString();
      const ev = this.agregarEvento(quien, tipo, texto);
      setTimeout(() => this.emitir({ tipo: "mascota", fila: { ...m } }), 40);
      if (quien === YO) this.simularPareja(tipo);
      return { evento: ev.id, sumo: suma, extra, nota, analizar: m.mensajes_sin_analizar >= 8, amor: m.amor, racha: m.racha };
    }

    // Tu pareja "de mentira" responde a lo que hacés
    simularPareja(tipo) {
      const otro = (t, x) => setTimeout(() => this.accion(t, x, OTRO).catch(() => {}), 2500 + Math.random() * 2500);
      if (tipo === "mensaje" || tipo === "frase") otro("mensaje", RESPUESTAS_OTRO[Math.floor(Math.random() * RESPUESTAS_OTRO.length)]);
      else if (tipo === "necesito_amor") otro("caricia");
      else if (tipo === "pedir_ubicacion") setTimeout(() => {
        this.db.ubicaciones[OTRO] = { lat: -30.9447 + (Math.random() - 0.5) * 0.01, lng: -61.5617 + (Math.random() - 0.5) * 0.01, precision_m: 15, actualizada: new Date().toISOString() };
        this.agregarEvento(OTRO, "ubicacion", null);
      }, 3000);
      else if (tipo === "comida" && Math.random() < 0.4) otro("caricia");
    }

    // Botones de prueba en Ajustes (modo demo)
    simular(tipo) {
      if (tipo === "necesito_amor" || tipo === "pedir_ubicacion") this.agregarEvento(OTRO, tipo, null);
      else this.accion(tipo, tipo === "mensaje" ? RESPUESTAS_OTRO[Math.floor(Math.random() * RESPUESTAS_OTRO.length)] : tipo === "frase" ? "Gracias por existir, te amo con todo mi corazón 💗" : null, OTRO);
    }
    vistaPrevia(amor) { this.db.mascota.amor = amor; this.guardar(); this.emitir({ tipo: "mascota", fila: { ...this.db.mascota } }); }

    async ajustes({ nombre, panda, auto }) {
      if (nombre) this.db.yo.nombre = nombre;
      if (panda) this.db.mascota.nombre = panda;
      if (auto != null) this.db.yo.compartir_auto = auto;
      this.guardar(); return this.estado();
    }
    async favorito(id, valor) { const e = this.db.eventos.find((x) => x.id === id); if (e) e.favorito = valor; this.guardar(); }
    async salir() { this.db = null; localStorage.removeItem(CLAVE_DEMO); }
    async usoGemini() { return this.db?.uso?.[this.hoy()] || 0; }
    async compartirUbicacion(lat, lng, prec) {
      this.db.ubicaciones[YO] = { lat, lng, precision_m: prec, actualizada: new Date().toISOString() };
      this.agregarEvento(YO, "ubicacion", null, true); return { ok: true };
    }
    async ubicacionDe(id) { return this.db.ubicaciones[id] || null; }
    async eventos({ limite = 60, tipos = null, favoritos = false } = {}) {
      return this.db.eventos.filter((e) => (!tipos || tipos.includes(e.tipo)) && (!favoritos || e.favorito)).slice(0, limite);
    }

    // Sin Gemini: respuestas tiernas locales
    async panda(accion, datos = {}) {
      await esperar(700);
      const d = this.hoy();
      this.db.uso[d] = (this.db.uso[d] || 0) + 1; this.guardar();
      const usadas = this.db.uso[d];
      if (usadas > this.limiteGemini) return { limite: true, usadas: usadas - 1, limiteDiario: this.limiteGemini };
      const m = this.db.mascota, yo = this.db.yo.nombre, otro = this.db.otro.nombre;
      if (accion === "frase_dia") {
        const f = `${yo} y ${otro}: cada mimito que me dan me hace crecer un poquito. ¡Hoy quiero muchos abrazos! 🐼💗`;
        m.frase_dia = f; m.frase_fecha = d; this.guardar();
        return { frase: f, usadas, limiteDiario: this.limiteGemini };
      }
      if (accion === "animo") { m.animo = "enamorado"; m.animo_nota = "Se dicen cosas muy lindas"; m.mensajes_sin_analizar = 0; this.guardar(); return { animo: "enamorado", nota: m.animo_nota, usadas, limiteDiario: this.limiteGemini }; }
      const t = String(datos.mensaje || "").toLowerCase();
      let respuesta = `¡Hola ${yo}! Soy ${m.nombre}. En el modo demo no tengo IA, pero cuando me conecten a Gemini voy a poder charlar de todo con vos. 🐼`;
      let emocion = "feliz";
      if (/hambre|comer|comida|bamb/.test(t)) { respuesta = "¡Me encanta el bambú! Dame un poquito, porfa 🎋"; emocion = "hambriento"; }
      else if (/te (quiero|amo)|lindo|hermoso/.test(t)) { respuesta = `¡Yo también te quiero mucho! Y ${otro} te quiere un montón 💗`; emocion = "enamorado"; }
      else if (/triste|mal|llor/.test(t)) { respuesta = "Vení que te doy un abrazo de panda. Todo va a estar bien 🤍"; emocion = "triste"; }
      return { respuesta, emocion, usadas, limiteDiario: this.limiteGemini };
    }
  }

  // ---------------------------------------------------------------
  async function crearDatos() {
    let cfg = globalThis.PANDA_CONFIG || null;
    if (!cfg?.supabaseUrl && location.protocol.startsWith("http")) {
      try {
        const r = await fetch(API("config"), { cache: "no-store" });
        if (r.ok) cfg = await r.json();
      } catch {}
    }
    if (cfg?.supabaseUrl && cfg?.supabaseAnonKey && globalThis.supabase && !/[?&]demo/.test(location.search)) {
      const d = new DatosSupabase(cfg);
      d.limiteGemini = cfg.limiteGemini || 60;
      return d;
    }
    return new DatosDemo();
  }

  globalThis.crearDatos = crearDatos;
  globalThis.DATOS_IDS = { YO, OTRO };
})();
