package com.panda.amor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Notificaciones y vibración. */
object Avisos {
    const val CANAL_AMOR = "amor"
    const val CANAL_FIJO = "panda_fijo"
    const val ID_FIJA = 1

    fun crearCanales(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val amor = NotificationChannel(CANAL_AMOR, "Avisos de amor", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Mimos, mensajes y pedidos de tu pareja"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 160, 110, 160, 520, 160, 110, 160)
        }
        val fijo = NotificationChannel(CANAL_FIJO, "Panda en la pantalla", NotificationManager.IMPORTANCE_MIN).apply {
            description = "Necesaria para que el panda pueda caminar por la pantalla"
            setShowBadge(false)
            setSound(null, null)
        }
        nm.createNotificationChannel(amor)
        nm.createNotificationChannel(fijo)
    }

    fun intentApp(ctx: Context, accion: String, codigo: Int): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("accion", accion)
        }
        return PendingIntent.getActivity(ctx, codigo, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    fun notificacionFija(ctx: Context): Notification =
        Notification.Builder(ctx, CANAL_FIJO)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle("Tu panda está con vos 🐼")
            .setContentText("Tocá para abrir la app")
            .setOngoing(true)
            .setContentIntent(intentApp(ctx, "", 1))
            .build()

    /** tipo: necesito_amor, pedir_ubicacion, mensaje, frase, ubicacion, general */
    fun mostrar(ctx: Context, titulo: String, texto: String, tipo: String) {
        if (MainActivity.enPrimerPlano) return // la app ya lo muestra adentro
        val accion = when (tipo) {
            "necesito_amor" -> "necesito_amor"
            "pedir_ubicacion" -> "pregunta_ubicacion"
            "mensaje", "frase", "foto", "pregunta" -> "mensajes"
            "sentir" -> "sentir"
            "ubicacion" -> "ver_ubicacion"
            else -> ""
        }
        val codigo = tipo.hashCode() and 0xffff
        val b = Notification.Builder(ctx, CANAL_AMOR)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setStyle(Notification.BigTextStyle().bigText(texto))
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setContentIntent(intentApp(ctx, accion, codigo))
        if (tipo == "pedir_ubicacion") {
            b.addAction(Notification.Action.Builder(null, "Compartir", intentApp(ctx, "compartir_ubicacion", codigo + 1)).build())
        }
        if (tipo == "necesito_amor") {
            b.addAction(Notification.Action.Builder(null, "Mandar mimos 🤗", intentApp(ctx, "mimos", codigo + 2)).build())
        }
        val nm = ctx.getSystemService(NotificationManager::class.java)
        try { nm.notify(codigo, b.build()) } catch (_: SecurityException) { /* sin permiso de notificaciones */ }
    }

    fun vibrar(ctx: Context, patron: String) {
        val tiempos = patron.split(",").mapNotNull { it.trim().toLongOrNull() }.toLongArray()
        if (tiempos.isEmpty()) return
        val v: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
            ctx.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (!v.hasVibrator()) return
        v.vibrate(VibrationEffect.createWaveform(tiempos, -1))
    }
}
