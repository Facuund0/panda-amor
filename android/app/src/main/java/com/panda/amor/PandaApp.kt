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
        val anterior = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { hilo, e ->
            try { Fallos.guardar(this, hilo.name, e) } catch (_: Throwable) {}
            anterior?.uncaughtException(hilo, e)
        }
    }
}

object Fallos {
    private fun archivo(ctx: Context) = File(ctx.filesDir, "ultimo_error.txt")
    /** Marca que se escribe antes de usar la voz Piper y se borra al terminar.
     *  Si al abrir la app sigue ahí, la voz hizo cerrar la app (error nativo). */
    private fun marcaVoz(ctx: Context) = File(ctx.filesDir, "voz_en_uso")

    fun guardar(ctx: Context, hilo: String, e: Throwable) {
        val sw = StringWriter(); e.printStackTrace(PrintWriter(sw))
        val texto = "Android ${Build.VERSION.RELEASE} · ${Build.MANUFACTURER} ${Build.MODEL} · v${BuildConfig.VERSION_NAME}\nHilo: $hilo\n\n$sw"
        archivo(ctx).writeText(texto.take(6000))
    }

    /** Devuelve el último error (y lo borra), o null si no hubo. */
    fun tomar(ctx: Context): String? {
        val m = marcaVoz(ctx)
        if (m.exists()) {
            m.delete()
            Config.guardarVozDesactivada(ctx, true)
            if (!archivo(ctx).exists()) archivo(ctx).writeText("La voz real (Piper) hizo cerrar la app. La desactivé; se usa la voz del celular.")
        }
        val f = archivo(ctx)
        if (!f.exists()) return null
        val t = f.readText(); f.delete(); return t
    }

    fun empiezaVoz(ctx: Context) = try { marcaVoz(ctx).writeText("1") } catch (_: Exception) {}
    fun terminaVoz(ctx: Context) = try { marcaVoz(ctx).delete() } catch (_: Exception) { false }
}
