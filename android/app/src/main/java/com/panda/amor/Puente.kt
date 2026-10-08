package com.panda.amor

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Lo que la página web puede pedirle al celular (window.AndroidPanda).
 * Lo usan las dos WebViews: la app principal (actividad) y el panda flotante (servicio).
 */
class Puente(
    private val ctx: Context,
    private val web: WebView,
    private val actividad: MainActivity? = null,
    private val servicio: PandaService? = null,
) {
    private fun js(codigo: String) = web.post { web.evaluateJavascript(codigo, null) }
    private fun q(s: String) = JSONObject.quote(s)

    // ---------- pantalla y ventana flotante ----------
    @JavascriptInterface fun pantalla(): String = servicio?.pantallaJson() ?: "{}"
    @JavascriptInterface fun posicion(): String = servicio?.posicionJson() ?: "{\"x\":0,\"y\":0}"
    @JavascriptInterface fun moverA(x: Int, y: Int, ms: Int) { servicio?.moverA(x, y, ms) }
    @JavascriptInterface fun tamano(w: Int, h: Int, x: Int, y: Int) { servicio?.tamano(w, h, x, y) }
    // globo de texto del panda flotante (ventanita aparte; así la del panda no cambia de tamaño)
    @JavascriptInterface fun globo(texto: String, ms: Int) { servicio?.mostrarGlobo(texto, ms) }
    @JavascriptInterface fun ocultarGlobo() { servicio?.ocultarGlobo() }

    // ---------- avisos ----------
    @JavascriptInterface fun vibrar(patron: String) = Avisos.vibrar(ctx, patron)
    @JavascriptInterface fun notificar(titulo: String, texto: String, tipo: String) = Avisos.mostrar(ctx, titulo, texto, tipo)

    @JavascriptInterface fun abrirApp(accion: String) {
        val i = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("accion", accion)
        }
        ctx.startActivity(i)
    }

    // ---------- voz (una sola: la del celular, con tono de nene) ----------
    @JavascriptInterface fun callar() = VozCelular.callar()
    // ¿La app principal está abierta? (el panda flotante no habla para no pisarse con ella)
    @JavascriptInterface fun appAbierta(): Boolean = MainActivity.enPrimerPlano
    // Voz del celular (motor de Android) con tono de nene
    @JavascriptInterface fun estadoVozCelular(): String { VozCelular.precargar(ctx); return VozCelular.estado() }
    @JavascriptInterface fun hablarCelular(texto: String, tono: Double, id: String) {
        VozCelular.hablar(ctx, texto, tono.toFloat(), id) { tipo -> js("window.__vozEvento && window.__vozEvento(${q(id)}, ${q(tipo)})") }
    }
    @JavascriptInterface fun ajustesVozCelular() {
        try { abrir(Intent("com.android.settings.TTS_SETTINGS")) } catch (_: Exception) {}
    }

    // ---------- actualizaciones ----------
    @JavascriptInterface fun version(): Int = BuildConfig.VERSION_CODE
    @JavascriptInterface fun buscarActualizacion() { actividad?.let { a -> a.runOnUiThread { Actualizador.revisar(a, manual = true) } } }

    // ---------- ubicación ----------
    @JavascriptInterface fun obtenerUbicacion(id: String) {
        web.post {
            Ubicacion.obtener(ctx) { l, error ->
                val r = JSONObject()
                if (l != null) { r.put("lat", l.latitude); r.put("lng", l.longitude); r.put("prec", l.accuracy.toDouble()) }
                else r.put("error", error ?: "No se pudo obtener la ubicación")
                js("window.__ubicacion && window.__ubicacion(${q(id)}, ${r})")
            }
        }
    }

    // ---------- panda flotante y permisos ----------
    // ---------- ubicación en vivo ----------
    @JavascriptInterface fun iniciarVivo(url: String, anonKey: String, clave: String, pareja: String): Boolean = VivoService.iniciar(ctx, url, anonKey, clave, pareja)
    @JavascriptInterface fun detenerVivo() = VivoService.detener(ctx)
    @JavascriptInterface fun vivoActivo(): Boolean = VivoService.activo(ctx)

    // ---------- notificaciones push ----------
    @JavascriptInterface fun tokenPush(): String = Push.token(ctx)
    @JavascriptInterface fun pushListo(si: Boolean) = Push.marcarListo(ctx, si)
    @JavascriptInterface fun pushActivo(): Boolean = Push.listo(ctx)
    @JavascriptInterface fun pushHabla(): Boolean = Push.habla(ctx)
    @JavascriptInterface fun ponerPushHabla(si: Boolean) = Push.guardarHabla(ctx, si)
    @JavascriptInterface fun ponerTonoVoz(t: Double) = Push.guardarTono(ctx, t.toFloat())

    // Panda flotante quieto (lo leen las dos pantallas: la app y el flotante)
    @JavascriptInterface fun quieto(): Boolean = Config.quieto(ctx)
    @JavascriptInterface fun ponerQuieto(q: Boolean) = Config.guardarQuieto(ctx, q)

    @JavascriptInterface fun flotanteActivo(): Boolean = Config.flotanteEncendido(ctx) && Settings.canDrawOverlays(ctx)

    @JavascriptInterface fun activarFlotante(encender: Boolean): String {
        if (encender && !Settings.canDrawOverlays(ctx)) {
            Config.guardarFlotante(ctx, true) // se enciende al volver con el permiso
            pedirPermiso("flotante")
            return "permiso"
        }
        Config.guardarFlotante(ctx, encender)
        if (encender) PandaService.iniciar(ctx, desdeApp = true) else PandaService.detener(ctx)
        return "ok"
    }

    @JavascriptInterface fun permisos(): String {
        val pm = ctx.getSystemService(PowerManager::class.java)
        val notif = if (Build.VERSION.SDK_INT >= 33)
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        else ctx.getSystemService(android.app.NotificationManager::class.java).areNotificationsEnabled()
        return JSONObject()
            .put("flotante", Settings.canDrawOverlays(ctx))
            .put("notificaciones", notif)
            .put("ubicacion", Ubicacion.tienePermiso(ctx))
            .put("bateria", pm.isIgnoringBatteryOptimizations(ctx.packageName))
            .toString()
    }

    @JavascriptInterface fun pedirPermiso(tipo: String) {
        val paquete = Uri.parse("package:${ctx.packageName}")
        when (tipo) {
            "flotante" -> abrir(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, paquete))
            "bateria" -> abrir(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, paquete))
            "notificaciones" -> if (Build.VERSION.SDK_INT >= 33 && actividad != null)
                actividad.runOnUiThread { actividad.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 10) }
            else abrir(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName))
            "ubicacion" -> if (actividad != null)
                actividad.runOnUiThread { actividad.requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 11) }
            else abrirApp("")
        }
    }

    private fun abrir(i: Intent) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { ctx.startActivity(i) } catch (_: Exception) {
            ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
