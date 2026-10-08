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
      return this.revisar();
    }

    async rpc(nombre, args = {}) {
      const { data, error } = await this.sb.rpc(nombre, args);
      if (error) throw new Error(error.message);
      return data;
    }

    async estado() { this._estado = await this.rpc("mi_estado"); return this._estado; }
    // Al abrir: revisa si el panda está abandonado (avisa o se va) y devuelve el estado
    async revisar() {
      try { this._estado = await this.rpc("revisar_panda"); return this._estado; }
      catch { return this.estado(); } // base de datos sin actualizar: sigue andando como antes
    }
    crearPareja(nombre, panda) { return this.rpc("crear_pareja", { mi_nombre: nombre, nombre_panda: panda }); }
    unirse(codigo, nombre) { return this.rpc("unirse_pareja", { codigo_pareja: codigo, mi_nombre: nombre }); }
    recuperar(codigo, clave) { return this.rpc("recuperar_lugar", { codigo_pareja: codigo, clave }); }
    accion(tipo, texto = null) { return this.rpc("registrar_accion", { tipo_accion: tipo, texto_accion: texto }); }
    ajustes({ nombre = null, panda = null, auto = null }) { return this.rpc("ajustes", { mi_nombre: nombre, nombre_panda: panda, auto_ubicacion: auto }); }
    favorito(id, valor) { return this.rpc("marcar_favorito", { evento_id: id, valor }); }
    salir() { return this.rpc("salir_de_pareja"); }
    usoGemini() { return this.rpc("mi_uso_gemini"); }
    // ---------- v3: calendario y ubicación en vivo ----------
    guardarFechas(inicio, fechas) { return this.rpc("guardar_fechas", { inicio: inicio || null, especiales: fechas || [] }); }
    iniciarVivo() { return this.rpc("iniciar_vivo"); }
    detenerVivo() { return this.rpc("detener_vivo", { clave: null }); }
    guardarTokenPush(token) { return this.rpc("guardar_token_push", { token_push: token }); }
    probarPush() { return this.rpc("probar_push"); }
    compartirUbicacion(lat, lng, prec) { return this.rpc("compartir_ubicacion", { la: lat, ln: lng, prec: Math.round(prec || 0) }); }
    // ---------- v2 (estilo Pou) ----------
    comprar(item) { return this.rpc("comprar", { item }); }
    ponerAccesorio(item, poner) { return this.rpc("poner_accesorio", { item, poner }); }
    desafios() { return this.rpc("mis_desafios"); }
    reclamarDesafio(clave) { return this.rpc("reclamar_desafio", { clave_desafio: clave }); }
    enviarFoto(datos, texto) { return this.rpc("enviar_foto", { datos, texto }); }
    adoptar(nombre) { return this.rpc("adoptar_panda", { nombre_panda: nombre }); }
    async foto(id) {
      const { data, error } = await this.sb.from("fotos").select("datos").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.datos || null;
    }

    async ubicacionDe(userId) {
      // "*": incluye en_vivo (ubicación en vivo) si la base está actualizada
      const { data, error } = await this.sb.from("ubicaciones").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }

    async eventos({ limite = 60, tipos = null, favoritos = false } = {}) {
      let q = this.sb.from("eventos").select("*").order("creado", { ascending: false }).limit(limite);
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
  const CLAVE_FOTOS = "panda-demo-fotos";
  const NADIE = "00000000-0000-0000-0000-000000000000";
  // Campos nuevos (v2) con su valor inicial: sirve para pandas nuevos y para los guardados antes
  const CAMPOS_V2 = () => ({
    monedas: R.MONEDAS_INICIALES, ultimo_banio: new Date().toISOString(), durmiendo: false, energia_base: 100,
    energia_desde: new Date().toISOString(), inventario: { manzana: 2 }, accesorios: [], puestos: [],
    ultimo_cuidado: new Date().toISOString(), aviso_abandono: 0, se_fue: null, generacion: 1, banios_total: 0, juegos_total: 0,
  });
  const hashTexto = (t) => { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
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
      if (this.db) this.db.mascota = { ...CAMPOS_V2(), ...this.db.mascota }; // panda guardado antes de v2
      this.limiteGemini = 60;
    }
    guardar() { try { localStorage.setItem(CLAVE_DEMO, JSON.stringify(this.db)); } catch {} }
    hoy() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
    async iniciar() { return this.revisar(); }
    async estado() {
      const db = this.db;
      if (!db) return { pareja: null };
      return {
        pareja: { id: "demo", codigo: db.codigo, fecha_inicio: db.fecha_inicio || null, fechas: db.fechas || [] },
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
          ...CAMPOS_V2(),
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
      const ev = { id: this.db.seq++, de, tipo, texto: texto || null, favorito: false, creado: new Date().toISOString(), ref: this._ref ?? null };
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
      const ahora = Date.now(), iso = () => new Date().toISOString();
      const permitidas = ["comida", "caricia", "frase", "mensaje", "necesito_amor", "pedir_ubicacion",
        "banio", "dormir", "despertar", "comer", "juego", "sentir", "pregunta", "foto", "alerta"];
      if (!permitidas.includes(tipo)) throw new Error("Acción desconocida: " + tipo);
      texto = texto == null ? null : String(texto).trim() || null;
      if (["frase", "mensaje", "sentir", "pregunta", "comer", "juego"].includes(tipo) && !texto) throw new Error("Falta el texto");
      if (tipo === "alerta" && !["mujer", "hombre"].includes(texto)) throw new Error("Alerta inválida");
      if (m.se_fue && !["mensaje", "frase", "sentir", "necesito_amor", "pedir_ubicacion", "foto", "pregunta", "alerta"].includes(tipo)) throw new Error("Tu panda se fue 🎒 Adopten uno nuevo");
      const en = R.energia(m);
      if (m.durmiendo && ["comida", "comer", "banio", "juego"].includes(tipo)) throw new Error("Shh… está durmiendo 😴 Despertalo primero");
      if (yo.dia !== d) { yo.caricias_hoy = 0; yo.mensajes_hoy = 0; yo.juegos_hoy = 0; yo.sentir_hoy = 0; yo.dia = d; }
      const desdeHoy = (t) => db.eventos.filter((e) => e.de === quien && e.tipo === t && R.esHoy(e.creado)).length;
      let suma = 0, extra = 0, ganadas = 0, nota = null;
      if (tipo === "comida") {
        if (ahora - new Date(m.ultima_comida) < 2 * 3600e3) nota = "lleno"; else suma = 5;
        m.ultima_comida = iso(); m.comidas_total++;
      } else if (tipo === "caricia") {
        yo.caricias_hoy = (yo.caricias_hoy || 0) + 1;
        if (yo.caricias_hoy <= 15) suma = 2; else nota = "tope_caricias";
        m.ultima_caricia = iso(); m.caricias_total++;
      } else if (tipo === "frase") { suma = 8; m.frases_total++; m.mensajes_sin_analizar++; }
      else if (tipo === "mensaje") { yo.mensajes_hoy = (yo.mensajes_hoy || 0) + 1; if (yo.mensajes_hoy <= 15) suma = 3; m.mensajes_sin_analizar++; }
      // ---------- v2 ----------
      else if (tipo === "banio") {
        if (ahora - new Date(m.ultimo_banio) < 3 * 3600e3) nota = "limpio";
        else { suma = 4; m.ultimo_banio = iso(); m.banios_total++; }
      } else if (tipo === "dormir") {
        if (m.durmiendo) nota = "ya_duerme";
        else { if (en < 70) suma = 2; else nota = "sin_sueno"; m.energia_base = en; m.energia_desde = iso(); m.durmiendo = true; }
      } else if (tipo === "despertar") {
        if (!m.durmiendo) nota = "ya_despierto";
        else { if (en < 50) nota = "sueno"; m.energia_base = en; m.energia_desde = iso(); m.durmiendo = false; }
      } else if (tipo === "comer") {
        const info = R.TIENDA[texto];
        if (!info || info.tipo !== "comida") throw new Error("Esa comida no existe");
        const cant = m.inventario[texto] || 0;
        if (cant < 1) throw new Error("No queda en la heladera. Comprá en la tienda 🛍️");
        if (ahora - new Date(m.ultima_comida) < 2 * 3600e3) nota = "lleno";
        else {
          m.inventario = { ...m.inventario, [texto]: cant - 1 };
          const base = Math.max(new Date(m.ultima_comida).getTime(), ahora - 24 * 3600e3);
          m.ultima_comida = new Date(Math.min(ahora, base + info.horas * 3600e3)).toISOString();
          suma = info.amor;
          if (info.energia > 0) { m.energia_base = Math.min(100, en + info.energia); m.energia_desde = iso(); }
          if (info.carino) m.ultima_caricia = iso();
          m.comidas_total++;
        }
      } else if (tipo === "juego") {
        if (!/^\d{1,4}$/.test(texto)) throw new Error("Puntaje inválido");
        const puntaje = Math.min(300, +texto);
        if (en < 10) throw new Error("Está muy cansado para jugar 😴 Acostalo a dormir");
        yo.juegos_hoy = (yo.juegos_hoy || 0) + 1;
        if (yo.juegos_hoy <= 5) { suma = 3; ganadas = R.MONEDAS_JUEGO(puntaje); } else nota = "tope_juegos";
        m.energia_base = en - 10; m.energia_desde = iso(); m.juegos_total++;
        texto = String(puntaje);
      } else if (tipo === "sentir") {
        yo.sentir_hoy = (yo.sentir_hoy || 0) + 1;
        if (yo.sentir_hoy <= 5) suma = 3;
        m.mensajes_sin_analizar++;
      } else if (tipo === "pregunta") {
        if (desdeHoy("pregunta") > 0) throw new Error("Ya respondiste la pregunta de hoy");
        suma = 5;
      } else if (tipo === "foto") {
        if (desdeHoy("foto") < 3) suma = 5; // la que se está mandando todavía no está guardada
      }
      if (["comida", "caricia", "frase", "mensaje", "banio", "dormir", "comer", "juego", "sentir", "pregunta", "foto"].includes(tipo)) {
        yo.ultimo_dia = d;
        const otro = quien === YO ? db.otro : db.yo;
        if (m.racha_dia !== d && otro.ultimo_dia === d) {
          const ayer = new Date(Date.now() - 86400e3); const ay = new Date(ayer.getTime() - ayer.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          m.racha = m.racha_dia === ay ? m.racha + 1 : 1;
          m.racha_dia = d; m.mejor_racha = Math.max(m.mejor_racha, m.racha);
          extra = Math.min(40, 10 + 2 * m.racha); ganadas += 5; nota = nota || "racha";
        }
        if (!m.se_fue) { m.ultimo_cuidado = iso(); m.aviso_abandono = 0; }
      }
      m.amor += suma + extra;
      m.monedas += ganadas;
      m.actualizada = iso();
      const ev = this.agregarEvento(quien, tipo, texto);
      setTimeout(() => this.emitir({ tipo: "mascota", fila: { ...m } }), 40);
      if (quien === YO) this.simularPareja(tipo);
      return { evento: ev.id, sumo: suma, extra, nota, analizar: m.mensajes_sin_analizar >= 8, amor: m.amor, racha: m.racha, monedas_ganadas: ganadas, mascota: { ...m } };
    }

    // ---------- v2: tienda, desafíos, fotos, abandono (mismas reglas que schema.sql) ----------
    async comprar(item) {
      const m = this.db.mascota, info = R.TIENDA[item];
      if (!info) throw new Error("Eso no está en la tienda");
      if (m.se_fue) throw new Error("Tu panda se fue 🎒 Adopten uno nuevo");
      if (info.tipo === "accesorio" && m.accesorios.includes(item)) throw new Error("Ya lo tienen");
      if (m.monedas < info.precio) throw new Error(`Les faltan ${info.precio - m.monedas} monedas 🪙`);
      m.monedas -= info.precio;
      if (info.tipo === "comida") m.inventario = { ...m.inventario, [item]: (m.inventario[item] || 0) + 1 };
      else m.accesorios = [...m.accesorios, item];
      this.agregarEvento(YO, "compra", item);
      this.emitir({ tipo: "mascota", fila: { ...m } });
      return { ...m };
    }
    async ponerAccesorio(item, poner) {
      const m = this.db.mascota, lugar = R.TIENDA[item]?.lugar;
      if (poner && !m.accesorios.includes(item)) throw new Error("Primero hay que comprarlo");
      m.puestos = m.puestos.filter((x) => x !== item && (!poner || R.TIENDA[x]?.lugar !== lugar));
      if (poner) m.puestos.push(item);
      this.guardar(); this.emitir({ tipo: "mascota", fila: { ...m } });
      return { ...m };
    }
    desafiosHoy(lugar = 1) {
      const orden = (lista) => lista.sort((a, b) => hashTexto(this.hoy() + lugar + a) - hashTexto(this.hoy() + lugar + b));
      const pareja = orden(Object.keys(R.DESAFIOS).filter((k) => R.DESAFIOS[k].pareja)).slice(0, 1);
      const cuidado = orden(Object.keys(R.DESAFIOS).filter((k) => !R.DESAFIOS[k].pareja)).slice(0, 2);
      return [...pareja, ...cuidado];
    }
    async desafios() {
      const hoy = (e) => e.de === YO && R.esHoy(e.creado);
      const cobrado = (c) => this.db.eventos.some((e) => hoy(e) && e.tipo === "desafio" && e.texto === c);
      return {
        regalo_cobrado: cobrado("diario"),
        desafios: this.desafiosHoy().map((clave) => {
          const d = R.DESAFIOS[clave];
          return { clave, meta: d.meta, premio: d.premio, progreso: this.db.eventos.filter((e) => hoy(e) && d.tipos.includes(e.tipo)).length, cobrado: cobrado(clave) };
        }),
      };
    }
    async reclamarDesafio(clave) {
      const est = await this.desafios();
      let premio;
      if (clave === "diario") { if (est.regalo_cobrado) throw new Error("Ya lo cobraste hoy"); premio = R.REGALO_DIARIO; }
      else {
        const d = est.desafios.find((x) => x.clave === clave);
        if (!d) throw new Error("Ese desafío no es de hoy");
        if (d.cobrado) throw new Error("Ya lo cobraste hoy");
        if (d.progreso < d.meta) throw new Error("Todavía no está cumplido");
        premio = d.premio;
      }
      this.db.mascota.monedas += premio;
      this.agregarEvento(YO, "desafio", clave, false);
      this.emitir({ tipo: "mascota", fila: { ...this.db.mascota } });
      return { premio, mascota: { ...this.db.mascota } };
    }
    leerFotos() { try { return JSON.parse(localStorage.getItem(CLAVE_FOTOS)) || {}; } catch { return {}; } }
    async enviarFoto(datos, texto, quien = YO) {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(datos)) throw new Error("Eso no es una foto");
      if (datos.length > 450000) throw new Error("La foto es muy pesada");
      if (this.db.eventos.filter((e) => e.de === quien && e.tipo === "foto" && R.esHoy(e.creado)).length >= R.TOPES.fotos_dia) throw new Error("Ya mandaste 10 fotos hoy 📸 Mañana más");
      const fotos = this.leerFotos(), id = Date.now();
      fotos[id] = datos;
      const ids = Object.keys(fotos).sort((a, b) => b - a); // el navegador guarda poco: solo las últimas 6
      ids.slice(6).forEach((k) => delete fotos[k]);
      try { localStorage.setItem(CLAVE_FOTOS, JSON.stringify(fotos)); } catch { throw new Error("No entra la foto en el modo demo"); }
      this._ref = id;
      try { return await this.accion("foto", texto || "📸", quien); } finally { this._ref = null; }
    }
    async foto(id) { return this.leerFotos()[id] || null; }
    async revisar() {
      const m = this.db?.mascota;
      if (m && !m.se_fue) {
        const dias = R.diasSinCuidado(m);
        if (dias >= R.ABANDONO.seVa) {
          const dv = Math.max(1, Math.ceil((Date.now() - new Date(m.nacio)) / 86400e3));
          this.agregarEvento(NADIE, "sistema", `se_fue|${m.nombre}|${m.amor}|${dv}`, false);
          m.se_fue = new Date().toISOString(); m.durmiendo = false;
        } else if (dias >= R.ABANDONO.aviso2 && m.aviso_abandono < 2) { m.aviso_abandono = 2; this.agregarEvento(NADIE, "sistema", "aviso_abandono|2", false); }
        else if (dias >= R.ABANDONO.aviso1 && m.aviso_abandono < 1) { m.aviso_abandono = 1; this.agregarEvento(NADIE, "sistema", "aviso_abandono|1", false); }
        this.guardar();
      }
      return this.estado();
    }
    async adoptar(nombre) {
      const m = this.db.mascota;
      if (!m.se_fue) throw new Error("Su panda sigue con ustedes 🐼");
      const ahora = new Date().toISOString(), gen = (m.generacion || 1) + 1;
      this.db.mascota = {
        ...m, nombre: (nombre || "").trim() || "Pandi", amor: 0, racha: 0, mejor_racha: 0, racha_dia: null,
        ultima_comida: new Date(Date.now() - 6 * 3600e3).toISOString(), ultima_caricia: ahora, comidas_total: 0, caricias_total: 0,
        frases_total: 0, animo: "feliz", animo_nota: null, mensajes_sin_analizar: 0, frase_dia: null, frase_fecha: null,
        nacio: ahora, actualizada: ahora, ...CAMPOS_V2(), generacion: gen,
      };
      this.agregarEvento(YO, "sistema", "nacio", false);
      return this.estado();
    }
    // Modo demo: simular que pasaron días sin cuidarlo
    simularAbandono(dias) {
      this.db.mascota.ultimo_cuidado = new Date(Date.now() - dias * 86400e3).toISOString();
      this.guardar(); return this.revisar();
    }

    // Tu pareja "de mentira" responde a lo que hacés
    simularPareja(tipo) {
      const otro = (t, x) => setTimeout(() => this.accion(t, x, OTRO).catch(() => {}), 2500 + Math.random() * 2500);
      if (tipo === "mensaje" || tipo === "frase") otro("mensaje", RESPUESTAS_OTRO[Math.floor(Math.random() * RESPUESTAS_OTRO.length)]);
      else if (tipo === "sentir") { otro("caricia"); otro("mensaje", "Acá estoy para vos, siempre 💗"); }
      else if (tipo === "foto") otro("mensaje", "¡Qué linda foto! 😍");
      else if (tipo === "pregunta" && !this.db.eventos.some((e) => e.de === OTRO && e.tipo === "pregunta" && R.esHoy(e.creado))) otro("pregunta", "¡Con vos, obvio! Cualquier lugar está bien si estamos juntos 💗");
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
      else if (tipo === "sentir") this.accion("sentir", "😢 Estoy triste · hoy fue un día difícil", OTRO);
      else if (tipo === "alerta") this.accion("alerta", Math.random() < 0.5 ? "mujer" : "hombre", OTRO);
      else if (tipo === "foto") {
        // una "foto" dibujada, para probar
        const c = document.createElement("canvas"); c.width = 320; c.height = 240;
        const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 320, 240);
        gr.addColorStop(0, "#ffd1dc"); gr.addColorStop(1, "#c8b6ff"); g.fillStyle = gr; g.fillRect(0, 0, 320, 240);
        g.font = "90px serif"; g.textAlign = "center"; g.fillText("🌅", 160, 150);
        this.enviarFoto(c.toDataURL("image/jpeg", 0.8), "Mirá qué atardecer 🧡", OTRO).catch(() => {});
      }
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
    async guardarTokenPush() { return null; } // en el demo no hay push
    async guardarFechas(inicio, fechas) { this.db.fecha_inicio = inicio || null; this.db.fechas = fechas || []; this.guardar(); return this.estado(); }
    async iniciarVivo() {
      // demo: "tu pareja" también comparte en vivo y se mueve un poquito
      this.db.ubicaciones[OTRO] = { ...(this.db.ubicaciones[OTRO] || { lat: -30.9447, lng: -61.5617, precision_m: 15 }), en_vivo: true, actualizada: new Date().toISOString() };
      this.guardar(); return { clave: "demo" };
    }
    async detenerVivo() { return null; }
    async probarPush() { return false; }
    async compartirUbicacion(lat, lng, prec) {
      this.db.ubicaciones[YO] = { lat, lng, precision_m: prec, actualizada: new Date().toISOString() };
      this.agregarEvento(YO, "ubicacion", null, true); return { ok: true };
    }
    async ubicacionDe(id) {
      const u = this.db.ubicaciones[id];
      if (u?.en_vivo && id === OTRO) { u.lat += (Math.random() - 0.5) * 0.0008; u.lng += (Math.random() - 0.5) * 0.0008; u.actualizada = new Date().toISOString(); }
      return u || null;
    }
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
        const pr = R && globalThis.Frases ? globalThis.Frases.preguntaDelDia(Math.floor(Date.now() / 86400e3)) : "¿Qué es lo que más te gusta de mí?";
        m.frase_dia = f; m.pregunta_dia = pr; m.frase_fecha = d; this.guardar();
        return { frase: f, pregunta: pr, usadas, limiteDiario: this.limiteGemini };
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
