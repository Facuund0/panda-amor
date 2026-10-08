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
                appCtx = ctx.applicationContext
                estado = if (elegirVoz(t)) "lista" else "sin-voz"
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

    private var appCtx: Context? = null
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("panda", Context.MODE_PRIVATE)

    /**
     * Qué voz usar:
     *  1) la que eligieron en Ajustes de la app (si existe en este celular);
     *  2) la voz PREDETERMINADA del celular, si es en castellano: es la misma que suena en
     *     Ajustes de Android → Texto a voz → "Reproducir" (en algunos Samsung la de "es-AR" suena a robot);
     *  3) si no, castellano de Argentina, Latinoamérica o España.
     */
    private fun elegirVoz(t: TextToSpeech): Boolean {
        val elegida = appCtx?.let { prefs(it).getString("voz_nombre", null) }
        val voces = try { t.voices?.toList().orEmpty() } catch (_: Exception) { emptyList() }
        if (elegida != null) {
            voces.firstOrNull { it.name == elegida }?.let { v -> if (try { t.setVoice(v) } catch (_: Exception) { -1 } >= 0) return true }
        }
        val pred = try { t.defaultVoice } catch (_: Exception) { null }
        if (pred != null && pred.locale.language == "es") {
            if (try { t.setVoice(pred) } catch (_: Exception) { -1 } >= 0) return true
        }
        val idiomas = listOf(Locale("es", "AR"), Locale("es", "US"), Locale("es", "MX"), Locale("es", "ES"), Locale("es"))
        return idiomas.any { (try { t.setLanguage(it) } catch (_: Exception) { -2 }) >= 0 }
    }

    /** Voces en castellano de este celular (para elegir en Ajustes), en JSON. */
    fun voces(): String {
        val t = tts ?: return "[]"
        if (estado != "lista") return "[]"
        val actual = try { t.voice?.name } catch (_: Exception) { null }
        val pred = try { t.defaultVoice?.name } catch (_: Exception) { null }
        val arr = org.json.JSONArray()
        val lista = try { t.voices?.toList().orEmpty() } catch (_: Exception) { emptyList() }
        lista.filter { it.locale.language == "es" && it.features?.contains("notInstalled") != true }
            .sortedWith(compareBy({ it.isNetworkConnectionRequired }, { -it.quality }, { it.locale.toLanguageTag() }, { it.name }))
            .forEach { v ->
                arr.put(org.json.JSONObject()
                    .put("nombre", v.name).put("idioma", v.locale.getDisplayName(Locale("es")))
                    .put("calidad", v.quality).put("internet", v.isNetworkConnectionRequired)
                    .put("actual", v.name == actual).put("predeterminada", v.name == pred))
            }
        return arr.toString()
    }

    /** Elegir una voz ("" = volver a la predeterminada del celular). */
    fun elegir(ctx: Context, nombre: String) = principal.post {
        prefs(ctx).edit().apply { if (nombre.isEmpty()) remove("voz_nombre") else putString("voz_nombre", nombre) }.apply()
        appCtx = ctx.applicationContext
        tts?.let { if (estado == "lista") elegirVoz(it) }
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
