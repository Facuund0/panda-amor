package com.panda.amor

import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger

/**
 * La voz de Daniela (Piper) corre en un PROCESO APARTE (":voz", ver AndroidManifest).
 * Si el motor nativo se rompe, se cae solo este proceso y la app sigue andando.
 */
class VozService : Service() {
    companion object {
        const val HABLAR = 1
        const val CALLAR = 2
        const val EVENTO = 3
    }

    private val manejador = object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(m: Message) {
            when (m.what) {
                HABLAR -> {
                    val d = m.data
                    val id = d.getString("id") ?: return
                    val responder = m.replyTo
                    VozPanda.hablar(this@VozService, d.getString("texto").orEmpty(), d.getFloat("tono", 1.35f)) { tipo ->
                        try {
                            responder?.send(Message.obtain(null, EVENTO).apply {
                                data = Bundle().apply { putString("id", id); putString("tipo", tipo) }
                            })
                        } catch (_: Exception) {}
                    }
                }
                CALLAR -> VozPanda.callar()
            }
        }
    }
    private val mensajero = Messenger(manejador)

    override fun onBind(intent: Intent?): IBinder = mensajero.binder
}

/** Lado de la app: le pide a VozService que hable y se entera si el proceso de la voz se cayó. */
object VozCliente {
    private val principal = Handler(Looper.getMainLooper())
    private var servicio: Messenger? = null
    private var conectando = false
    private lateinit var app: Context
    private val enEspera = mutableListOf<Message>()
    private val pendientes = mutableMapOf<String, (String) -> Unit>()

    private val respuestas = Messenger(object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(m: Message) {
            if (m.what != VozService.EVENTO) return
            val id = m.data.getString("id") ?: return
            val tipo = m.data.getString("tipo") ?: return
            val cb = if (tipo == "fin" || tipo == "error") pendientes.remove(id) else pendientes[id]
            if (tipo == "fin") Config.vozAndaBien(app)
            cb?.invoke(tipo)
        }
    })

    private val conexion = object : ServiceConnection {
        override fun onServiceConnected(n: ComponentName?, b: IBinder?) {
            servicio = Messenger(b); conectando = false
            enEspera.forEach { enviar(it) }; enEspera.clear()
        }
        override fun onServiceDisconnected(n: ComponentName?) { caida() }
        override fun onBindingDied(n: ComponentName?) {
            caida(); conectando = false
            try { app.unbindService(this) } catch (_: Exception) {}
        }
    }

    /** El proceso de la voz murió (error nativo de Piper). */
    private fun caida() {
        servicio = null
        if (pendientes.isNotEmpty()) {
            Config.sumarFalloVoz(app)
            val cbs = pendientes.values.toList(); pendientes.clear()
            cbs.forEach { it("error") }
        }
    }

    private fun conectar() {
        if (servicio != null || conectando) return
        conectando = true
        try { app.bindService(Intent(app, VozService::class.java), conexion, Context.BIND_AUTO_CREATE) }
        catch (_: Exception) { conectando = false }
    }

    private fun enviar(m: Message) {
        val s = servicio
        if (s == null) { enEspera.add(m); conectar(); return }
        try { s.send(m) } catch (_: Exception) { caida() }
    }

    fun hablar(ctx: Context, texto: String, tono: Float, id: String, evento: (String) -> Unit) = principal.post {
        app = ctx.applicationContext
        if (Config.vozDesactivada(app)) { evento("error"); return@post }
        pendientes[id] = evento
        enviar(Message.obtain(null, VozService.HABLAR).apply {
            replyTo = respuestas
            data = Bundle().apply { putString("id", id); putString("texto", texto); putFloat("tono", tono) }
        })
    }

    fun callar() = principal.post {
        if (servicio != null) enviar(Message.obtain(null, VozService.CALLAR))
    }
}
