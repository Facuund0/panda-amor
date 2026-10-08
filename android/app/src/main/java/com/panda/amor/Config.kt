package com.panda.amor

import android.content.Context

/** Ajustes guardados en el celular. */
object Config {
    private const val PREFS = "panda"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Dirección de la app web en Vercel (siempre termina en "/"). */
    fun url(ctx: Context): String {
        val guardada = prefs(ctx).getString("url", null)
        val u = (guardada ?: BuildConfig.APP_URL).trim()
        return if (u.endsWith("/")) u else "$u/"
    }

    fun urlConfigurada(ctx: Context): Boolean = !url(ctx).contains("TU-PROYECTO")

    fun guardarUrl(ctx: Context, url: String) {
        var u = url.trim()
        if (!u.startsWith("http")) u = "https://$u"
        if (!u.endsWith("/")) u += "/"
        prefs(ctx).edit().putString("url", u).apply()
    }

    fun flotanteEncendido(ctx: Context): Boolean = prefs(ctx).getBoolean("flotante", false)

    fun guardarFlotante(ctx: Context, encendido: Boolean) {
        prefs(ctx).edit().putBoolean("flotante", encendido).apply()
    }

    /** Panda flotante quieto (no camina solo). Se cambia tocándolo 3 veces o desde Ajustes. */
    fun quieto(ctx: Context): Boolean = prefs(ctx).getBoolean("quieto", false)
    fun guardarQuieto(ctx: Context, q: Boolean) { prefs(ctx).edit().putBoolean("quieto", q).apply() }
}
