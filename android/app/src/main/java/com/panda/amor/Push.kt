package com.panda.amor

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Notificaciones push (Firebase). Las manda Vercel (/api/push) cuando tu pareja hace algo,
 * y llegan aunque la app esté cerrada y el panda flotante apagado.
 */
class MensajeriaPush : FirebaseMessagingService() {
    // Firebase cambia el token cada tanto: se guarda y la web lo sube a Supabase al abrir la app
    override fun onNewToken(token: String) = Push.guardar(this, token)

    override fun onMessageReceived(m: RemoteMessage) {
        val d = m.data
        val tipo = d["tipo"] ?: "general"
        if (MainActivity.enPrimerPlano) return // con la app abierta ya avisa ella
        Avisos.mostrar(this, d["titulo"] ?: "Nuestro Panda 🐼", d["texto"] ?: "", tipo)
        Avisos.vibrar(this, Push.patron(tipo))
    }
}

object Push {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("panda", Context.MODE_PRIVATE)

    fun guardar(ctx: Context, token: String) { prefs(ctx).edit().putString("push_token", token).apply() }

    /** Devuelve el token guardado (o "" si todavía no llegó) y le pide uno a Firebase. */
    fun token(ctx: Context): String {
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { t -> if (!t.isNullOrEmpty()) guardar(ctx, t) }
        } catch (_: Exception) {}
        return prefs(ctx).getString("push_token", "") ?: ""
    }

    /** La web avisa cuando el servidor ya manda push: así el panda flotante no repite las notificaciones. */
    fun listo(ctx: Context): Boolean = prefs(ctx).getBoolean("push_listo", false)
    fun marcarListo(ctx: Context, si: Boolean) { prefs(ctx).edit().putBoolean("push_listo", si).apply() }

    // Mismos patrones que web/js/puente.js
    fun patron(tipo: String): String = when (tipo) {
        "necesito_amor" -> "0,160,110,160,520,160,110,160"
        "pedir_ubicacion" -> "0,90,80,90"
        "mensaje" -> "0,70,60,70"
        "frase" -> "0,120,80,120"
        "sentir" -> "0,120,90,120,90,120"
        "foto" -> "0,80,60,80"
        "aviso" -> "0,300,200,300"
        else -> "0,60"
    }
}
