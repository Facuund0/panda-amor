package com.panda.amor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Notificaciones y vibración. */
object Avisos {
    const val CANAL_AMOR = "amor"
    const val CANAL_FIJO = "panda_fijo"
    const val CANAL_ALERTA = "alerta_broma"
    const val CANAL_VIVO = "ubicacion_vivo"
    const val ID_VIVO = 2
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
        // Alerta en broma ("¿estás con otra mujer/otro hombre?"): suena con el tono de alarma
        val alerta = NotificationChannel(CANAL_ALERTA, "Alertas en broma 🚨", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Cuando tu pareja te manda una alerta de broma"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 150, 400, 150, 400, 150, 900)
            enableLights(true); lightColor = Color.RED
            val tono = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            setSound(tono, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        }
        val vivo = NotificationChannel(CANAL_VIVO, "Ubicación en vivo", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Aparece mientras compartís tu ubicación en vivo"
            setShowBadge(false)
        }
        nm.createNotificationChannel(amor)
        nm.createNotificationChannel(fijo)
        nm.createNotificationChannel(alerta)
        nm.createNotificationChannel(vivo)
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
            "mensaje", "frase", "foto", "pregunta", "llegue" -> "mensajes"
            "sentir" -> "sentir"
            "ubicacion" -> "ver_ubicacion"
            "alerta" -> "alerta"
            else -> ""
        }
        val codigo = tipo.hashCode() and 0xffff
        val b = Notification.Builder(ctx, if (tipo == "alerta") CANAL_ALERTA else CANAL_AMOR)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setStyle(Notification.BigTextStyle().bigText(texto))
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setContentIntent(intentApp(ctx, accion, codigo))
        if (tipo == "alerta") b.setColor(Color.RED).setCategory(Notification.CATEGORY_ALARM)
        if (tipo == "pedir_ubicacion") {
            b.addAction(Notification.Action.Builder(null, "Compartir", intentApp(ctx, "compartir_ubicacion", codigo + 1)).build())
        }
        if (tipo == "necesito_amor") {
            b.addAction(Notification.Action.Builder(null, "Mandar mimos 🤗", intentApp(ctx, "mimos", codigo + 2)).build())
        }
        if (tipo == "alerta") {
            b.addAction(Notification.Action.Builder(null, "😇 ¡No, te lo juro!", intentApp(ctx, "alerta_no", codigo + 3)).build())
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
