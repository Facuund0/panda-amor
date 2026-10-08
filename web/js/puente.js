// =============================================================
//  PUENTE con la app Android (window.AndroidPanda)
//  Si se abre en un navegador común, usa las funciones web.
// =============================================================
(function () {
  const A = () => window.AndroidPanda;
  const pendientes = new Map();
  let n = 0;

  window.__ubicacion = (id, json) => {
    const p = pendientes.get(String(id));
    if (!p) return;
    pendientes.delete(String(id));
    try {
      const d = typeof json === "string" ? JSON.parse(json) : json;
      d.error ? p.mal(new Error(d.error)) : p.ok(d);
    } catch (e) { p.mal(e); }
  };

  const PATRONES = {
    necesito_amor: [0, 160, 110, 160, 520, 160, 110, 160],
    pedir_ubicacion: [0, 90, 80, 90],
    mensaje: [0, 70, 60, 70],
    frase: [0, 120, 80, 120],
    caricia: [0, 50],
    comida: [0, 50],
    ubicacion: [0, 60],
    sentir: [0, 120, 90, 120, 90, 120],
    foto: [0, 80, 60, 80],
    aviso: [0, 300, 200, 300],
  };

  const Puente = {
    esAndroid: () => !!A(),
    // Notificaciones push (Firebase): token de este celular ("" en el navegador o app vieja)
    tokenPush() { try { return A()?.tokenPush ? A().tokenPush() || "" : ""; } catch { return ""; } },
    pushListo(si) { try { A()?.pushListo?.(!!si); } catch {} },
    // true si ya llegan las push: el panda flotante no repite las notificaciones
    pushActivo() { try { return !!A()?.pushActivo?.(); } catch { return false; } },
    // Globo nativo del panda flotante (app 1.23+). Devuelve false si no existe: se usa el globo web.
    globoNativo(texto, ms) { try { if (A()?.globo) { A().globo(texto, Math.round(ms)); return true; } } catch {} return false; },
    // Panda flotante quieto: se guarda en el celular (en el navegador, en localStorage)
    quieto() {
      try { if (A()?.quieto) return !!A().quieto(); } catch {}
      try { return localStorage.getItem("panda-quieto") === "1"; } catch { return false; }
    },
    ponerQuieto(q) {
      try { if (A()?.ponerQuieto) return A().ponerQuieto(!!q); } catch {}
      try { localStorage.setItem("panda-quieto", q ? "1" : "0"); } catch {}
    },
    // ¿La app principal está abierta? En el navegador siempre false.
    appAbierta() { try { return !!A()?.appAbierta?.(); } catch { return false; } },
    // Versión del APK instalado (0 si es una versión vieja o el navegador)
    versionApp() { try { return A()?.version ? A().version() : 0; } catch { return 0; } },
    // En el navegador no hace falta: la web siempre está al día
    buscarActualizacion() { try { A()?.buscarActualizacion?.(); } catch {} },
    flotanteActivo() { try { return !!A()?.flotanteActivo(); } catch { return false; } },
    permisos() { try { return JSON.parse(A().permisos()); } catch { return {}; } },
    pedirPermiso(tipo) { try { A()?.pedirPermiso(tipo); } catch {} },
    activarFlotante(on) { try { return A()?.activarFlotante(!!on); } catch { return "error"; } },

    vibrar(tipo) {
      const p = PATRONES[tipo] || [0, 60];
      try { if (A()) return A().vibrar(p.join(",")); } catch {}
      try { navigator.vibrate?.(p.slice(1)); } catch {}
    },
    notificar(titulo, texto, tipo) {
      try { A()?.notificar(titulo, texto, tipo || "general"); } catch {}
    },

    // { lat, lng, prec }
    obtenerUbicacion() {
      if (A()) {
        return new Promise((ok, mal) => {
          const id = String(++n);
          pendientes.set(id, { ok, mal });
          setTimeout(() => window.__ubicacion(id, { error: "Tardó demasiado en encontrar la ubicación" }), 40000);
          try { A().obtenerUbicacion(id); } catch (e) { window.__ubicacion(id, { error: e.message }); }
        });
      }
      return new Promise((ok, mal) => {
        if (!navigator.geolocation) return mal(new Error("Este navegador no da la ubicación"));
        navigator.geolocation.getCurrentPosition(
          (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }),
          (e) => mal(new Error(e.code === 1 ? "No diste permiso de ubicación" : "No se pudo obtener la ubicación")),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
        );
      });
    },
    abrirApp(accion) { try { A()?.abrirApp(accion || ""); } catch {} },
  };

  globalThis.Puente = Puente;
})();
