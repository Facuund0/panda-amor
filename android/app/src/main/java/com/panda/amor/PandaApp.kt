package com.panda.amor

import android.app.Application
import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Arranca antes que todo. Si la app se cierra por un error, lo guarda en un archivo
 * para mostrarlo la próxima vez que se abra (y arrancar en "modo seguro").
 */
class PandaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= 28 && Application.getProcessName().endsWith(":voz")) return
        val anterior = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { hilo, e ->
            try { Fallos.guardar(this, hilo.name, e) } catch (_: Throwable) {}
            anterior?.uncaughtException(hilo, e)
        }
    }
}

object Fallos {
    private fun archivo(ctx: Context) = File(ctx.filesDir, "ultimo_error.txt")
    fun guardar(ctx: Context, hilo: String, e: Throwable) {
        val sw = StringWriter(); e.printStackTrace(PrintWriter(sw))
        val texto = "Android ${Build.VERSION.RELEASE} · ${Build.MANUFACTURER} ${Build.MODEL} · v${BuildConfig.VERSION_NAME}\nHilo: $hilo\n\n$sw"
        archivo(ctx).writeText(texto.take(6000))
    }

    /** Devuelve el último error (y lo borra), o null si no hubo. */
    fun tomar(ctx: Context): String? {
        val f = archivo(ctx)
        if (!f.exists()) return null
        val t = f.readText(); f.delete(); return t
    }

}
