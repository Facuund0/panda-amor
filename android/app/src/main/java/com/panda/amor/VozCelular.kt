package com.panda.amor

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * Voz del celular (el motor de voz de Android: Google o Samsung) con tono agudo de nene.
 * No descarga nada extra y es muy estable. Es la voz por defecto si no está la de Daniela.
 */
object VozCelular {
    private val principal = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null
    @Volatile private var estado = "apagada" // apagada | cargando | lista | sin-voz
    private val enEspera = mutableListOf<() -> Unit>()
    private val eventos = ConcurrentHashMap<String, (String) -> Unit>()

    fun estado(): String = estado

    private fun preparar(ctx: Context) {
        if (estado == "lista" || estado == "cargando") return
        estado = "cargando"
        tts = TextToSpeech(ctx.applicationContext) { ok ->
            principal.post {
                val t = tts
                if (ok != TextToSpeech.SUCCESS || t == null) { estado = "sin-voz"; vaciar(); return@post }
                // Castellano: primero de Argentina, si no de Latinoamérica, si no de España
                val idiomas = listOf(Locale("es", "AR"), Locale("es", "US"), Locale("es", "MX"), Locale("es", "ES"), Locale("es"))
                val elegido = idiomas.firstOrNull { (try { t.setLanguage(it) } catch (_: Exception) { -2 }) >= 0 }
                estado = if (elegido != null) "lista" else "sin-voz"
                t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String) { eventos[id]?.invoke("inicio") }
                    override fun onDone(id: String) { eventos.remove(id)?.invoke("fin") }
                    override fun onStop(id: String, interrumpida: Boolean) { eventos.remove(id)?.invoke("fin") }
                    @Deprecated("Deprecated in Java")
                    override fun onError(id: String) { eventos.remove(id)?.invoke("error") }
                    override fun onError(id: String, codigo: Int) { eventos.remove(id)?.invoke("error") }
                })
                vaciar()
            }
        }
    }

    private fun vaciar() { val l = enEspera.toList(); enEspera.clear(); l.forEach { it() } }

    /** tono: 1 (normal) a 1.7 (muy agudo). La voz del celular se sube un poco más para que suene a nene. */
    fun hablar(ctx: Context, texto: String, tono: Float, id: String, evento: (String) -> Unit) = principal.post {
        val decir = {
            val t = tts
            if (estado != "lista" || t == null) evento("error")
            else {
                eventos[id] = evento
                t.setPitch((1f + (tono - 1f) * 1.7f).coerceIn(1f, 2.2f))
                t.setSpeechRate(1.05f)
                val r = t.speak(texto, TextToSpeech.QUEUE_FLUSH, Bundle(), id)
                if (r != TextToSpeech.SUCCESS) eventos.remove(id)?.invoke("error")
            }
        }
        if (estado == "lista") decir() else { enEspera.add(decir); preparar(ctx) }
    }

    fun callar() = principal.post { try { tts?.stop() } catch (_: Exception) {} }

    /** Arranca el motor de antemano para que la primera frase no tarde. */
    fun precargar(ctx: Context) = principal.post { preparar(ctx) }
}
