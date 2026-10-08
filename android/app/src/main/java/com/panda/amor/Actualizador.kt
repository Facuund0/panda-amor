package com.panda.amor

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Busca si hay una versión nueva del APK en GitHub (Releases → "apk") y la instala
 * desde la misma app: un toque en "Actualizar" y Android pide confirmar. Sin desinstalar.
 * Los cambios de la web (pantallas, panda, frases) NO necesitan esto: se actualizan solos desde Vercel.
 */
object Actualizador {
    private const val BASE = "https://github.com/Facuund0/panda-amor/releases/download/apk/"
    private const val PREFS = "panda"
    @Volatile private var trabajando = false
    private var pendiente: Int = 0 // versión que esperaba el permiso de "instalar apps"

    private fun descargar(url: String): HttpURLConnection {
        var u = URL(url); var saltos = 0
        while (true) {
            val c = u.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 15000; c.readTimeout = 30000
            val code = c.responseCode
            if (code in 300..399 && saltos++ < 5) { u = URL(u, c.getHeaderField("Location")); c.disconnect(); continue }
            if (code != 200) throw Exception("HTTP $code")
            return c
        }
    }

    /** Se llama al abrir la app. Como mucho una vez cada 6 horas (salvo "manual"). */
    fun revisar(act: Activity, manual: Boolean = false) {
        if (trabajando) return
        val prefs = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ahora = System.currentTimeMillis()
        if (!manual && ahora - prefs.getLong("ultima_revision", 0) < 6 * 3600_000L) return
        prefs.edit().putLong("ultima_revision", ahora).apply()
        thread(name = "revisar-version") {
            try {
                val c = descargar(BASE + "version.json")
                val datos = JSONObject(c.inputStream.bufferedReader().readText())
                val nueva = datos.optInt("version", 0)
                act.runOnUiThread {
                    if (nueva > BuildConfig.VERSION_CODE) preguntar(act, nueva, datos.optString("nombre"))
                    else if (manual) Toast.makeText(act, "Ya tenés la última versión 🐼", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                if (manual) act.runOnUiThread { Toast.makeText(act, "No pude buscar actualizaciones", Toast.LENGTH_SHORT).show() }
            }
        }
    }

    private fun preguntar(act: Activity, version: Int, nombre: String) {
        if (act.isFinishing) return
        AlertDialog.Builder(act)
            .setTitle("Hay una versión nueva 🐼")
            .setMessage("Versión $nombre. Se descarga e instala encima: no se borra nada.")
            .setPositiveButton("Actualizar") { _, _ -> instalar(act, version) }
            .setNegativeButton("Después", null)
            .show()
    }

    private fun instalar(act: Activity, version: Int) {
        // Android pide permitir "instalar apps desconocidas" para esta app (una sola vez)
        if (Build.VERSION.SDK_INT >= 26 && !act.packageManager.canRequestPackageInstalls()) {
            pendiente = version
            Toast.makeText(act, "Activá \"Permitir de esta fuente\" y volvé a la app", Toast.LENGTH_LONG).show()
            act.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${act.packageName}")))
            return
        }
        trabajando = true
        Toast.makeText(act, "Descargando la actualización…", Toast.LENGTH_LONG).show()
        val app = act.applicationContext
        thread(name = "actualizar") {
            try {
                val c = descargar(BASE + "NuestroPanda.apk")
                val pi = app.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                if (c.contentLengthLong > 0) params.setSize(c.contentLengthLong)
                val id = pi.createSession(params)
                pi.openSession(id).use { sesion ->
                    sesion.openWrite("NuestroPanda.apk", 0, -1).use { salida ->
                        c.inputStream.use { it.copyTo(salida, 64 * 1024) }
                        sesion.fsync(salida)
                    }
                    val aviso = Intent(app, ResultadoInstalacion::class.java)
                    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                    sesion.commit(PendingIntent.getBroadcast(app, 77, aviso, flags).intentSender)
                }
            } catch (e: Exception) {
                act.runOnUiThread { Toast.makeText(act, "No se pudo actualizar: ${e.message}", Toast.LENGTH_LONG).show() }
            } finally {
                trabajando = false
            }
        }
    }

    /** Al volver de dar el permiso de instalar, sigue sola. */
    fun alVolver(act: Activity) {
        val v = pendiente
        if (v > 0 && Build.VERSION.SDK_INT >= 26 && act.packageManager.canRequestPackageInstalls()) {
            pendiente = 0; instalar(act, v)
        }
    }
}

/** Android avisa acá cómo va la instalación: si hace falta, muestra la pantalla de "¿Actualizar?". */
class ResultadoInstalacion : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirmar = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try { ctx.startActivity(confirmar) } catch (_: Exception) {}
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> {
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "error"
                Toast.makeText(ctx, "No se pudo actualizar: $msg", Toast.LENGTH_LONG).show()
            }
        }
    }
}
