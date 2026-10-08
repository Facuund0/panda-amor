package com.panda.amor

import android.annotation.SuppressLint
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * UBICACIÓN EN VIVO (tipo Snapchat). La activa cada uno para sí mismo desde la app.
 * Mientras está prendida hay una notificación fija ("Compartiendo tu ubicación en vivo").
 * Manda la ubicación a Supabase (vivo_ubicacion) cada 1 minuto como mucho o cuando te movés,
 * aunque la app esté cerrada. Solo se guarda la ÚLTIMA ubicación, nunca un historial.
 */
class VivoService : Service(), LocationListener {

    companion object {
        @Volatile var corriendo = false
            private set
        private const val PARAR = "parar"
        private fun prefs(ctx: Context) = ctx.getSharedPreferences("panda", Context.MODE_PRIVATE)

        /** La web le pasa la dirección de Supabase, la anon key (pública) y la clave propia del vivo. */
        fun iniciar(ctx: Context, url: String, anonKey: String, clave: String, pareja: String): Boolean {
            if (!Ubicacion.tienePermiso(ctx)) return false
            prefs(ctx).edit().putString("vivo_url", url.trimEnd('/')).putString("vivo_key", anonKey)
                .putString("vivo_clave", clave).putString("vivo_pareja", pareja).apply()
            return try { ctx.startForegroundService(Intent(ctx, VivoService::class.java)); true } catch (_: Exception) { false }
        }

        fun activo(ctx: Context) = !prefs(ctx).getString("vivo_clave", null).isNullOrEmpty()

        fun detener(ctx: Context) {
            prefs(ctx).edit().remove("vivo_clave").apply()
            ctx.stopService(Intent(ctx, VivoService::class.java))
        }

        /** Al abrir la app: si estaba compartiendo y Android lo cerró, lo vuelve a prender. */
        fun reanudar(ctx: Context) {
            if (activo(ctx) && !corriendo && Ubicacion.tienePermiso(ctx)) {
                try { ctx.startForegroundService(Intent(ctx, VivoService::class.java)) } catch (_: Exception) {}
            }
        }
    }

    private var lm: LocationManager? = null
    private var ultimoEnvio = 0L
    private var ultimaEnviada: Location? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == PARAR) { avisarQueParo(); detener(this); return START_NOT_STICKY }
        val clave = prefs(this).getString("vivo_clave", null)
        if (clave.isNullOrEmpty()) { stopSelf(); return START_NOT_STICKY }
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(Avisos.ID_VIVO, notificacion(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            else startForeground(Avisos.ID_VIVO, notificacion())
        } catch (e: Exception) {
            // Android no deja prenderlo ahora (por ej. desde segundo plano): se reanuda al abrir la app
            stopSelf(); return START_NOT_STICKY
        }
        corriendo = true
        empezarAEscuchar()
        return START_STICKY
    }

    private fun notificacion(): Notification {
        val pareja = prefs(this).getString("vivo_pareja", null) ?: "tu pareja"
        val parar = PendingIntent.getService(this, 31, Intent(this, VivoService::class.java).setAction(PARAR), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, Avisos.CANAL_VIVO)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("📡 Compartiendo tu ubicación en vivo")
            .setContentText("$pareja ve dónde estás. Tocá \"Dejar de compartir\" para apagarlo.")
            .setOngoing(true)
            .setContentIntent(Avisos.intentApp(this, "ver_ubicacion", 30))
            .addAction(Notification.Action.Builder(null, "Dejar de compartir", parar).build())
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun empezarAEscuchar() {
        if (lm != null) return
        val m = getSystemService(LocationManager::class.java) ?: return
        lm = m
        // "fused" (Android 12+) gasta menos batería; si no, red + GPS
        val proveedores = if (Build.VERSION.SDK_INT >= 31 && m.allProviders.contains(LocationManager.FUSED_PROVIDER))
            listOf(LocationManager.FUSED_PROVIDER)
        else listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).filter { m.allProviders.contains(it) }
        for (p in proveedores) {
            try { m.requestLocationUpdates(p, 60_000L, 25f, this, Looper.getMainLooper()) } catch (_: Exception) {}
        }
        // manda una ya, para no esperar el primer minuto
        try {
            proveedores.mapNotNull { m.getLastKnownLocation(it) }.maxByOrNull { it.time }?.let { onLocationChanged(it) }
        } catch (_: Exception) {}
    }

    override fun onLocationChanged(l: Location) {
        val ahora = System.currentTimeMillis()
        val antes = ultimaEnviada
        // como mucho una vez cada 30 s, salvo que se haya movido bastante
        if (antes != null && ahora - ultimoEnvio < 30_000 && l.distanceTo(antes) < 100) return
        ultimoEnvio = ahora; ultimaEnviada = l
        val p = prefs(this)
        val url = p.getString("vivo_url", null) ?: return
        val key = p.getString("vivo_key", null) ?: return
        val clave = p.getString("vivo_clave", null) ?: return
        thread(name = "vivo") {
            try {
                val c = URL("$url/rest/v1/rpc/vivo_ubicacion").openConnection() as HttpURLConnection
                c.requestMethod = "POST"; c.doOutput = true
                c.connectTimeout = 15000; c.readTimeout = 15000
                c.setRequestProperty("apikey", key)
                c.setRequestProperty("Content-Type", "application/json")
                val cuerpo = JSONObject().put("clave", clave).put("la", l.latitude).put("ln", l.longitude).put("prec", l.accuracy.toInt())
                c.outputStream.use { it.write(cuerpo.toString().toByteArray()) }
                val r = c.inputStream.bufferedReader().readText().trim()
                // "false": desde la app se dejó de compartir (o salió de la pareja) → apagar
                if (r == "false") detener(this)
            } catch (_: Exception) { /* sin internet: lo intenta en la próxima */ }
        }
    }

    /** "Dejar de compartir" desde la notificación: le avisa a la base para que no se vea más "en vivo". */
    private fun avisarQueParo() {
        val p = prefs(this)
        val url = p.getString("vivo_url", null) ?: return
        val key = p.getString("vivo_key", null) ?: return
        val clave = p.getString("vivo_clave", null) ?: return
        thread(name = "vivo-parar") {
            try {
                val c = URL("$url/rest/v1/rpc/detener_vivo").openConnection() as HttpURLConnection
                c.requestMethod = "POST"; c.doOutput = true
                c.setRequestProperty("apikey", key); c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(JSONObject().put("clave", clave).toString().toByteArray()) }
                c.inputStream.close()
            } catch (_: Exception) {}
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(p: String?, s: Int, b: Bundle?) {}
    override fun onProviderEnabled(p: String) {}
    override fun onProviderDisabled(p: String) {}

    override fun onDestroy() {
        corriendo = false
        try { lm?.removeUpdates(this) } catch (_: Exception) {}
        lm = null
        super.onDestroy()
    }
}
