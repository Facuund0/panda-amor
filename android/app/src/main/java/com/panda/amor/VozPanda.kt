package com.panda.amor

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.concurrent.thread

/**
 * Voz real del panda: Piper (voz "Daniela", Argentina) corriendo DENTRO del celular
 * con sherpa-onnx. No usa internet (salvo para bajar el modelo una vez) ni tiene límites.
 *
 * Voz de nene: se genera más lenta y se reproduce más rápido (tono = 1.35 por defecto),
 * así sube el tono sin cambiar la velocidad.
 */
object VozPanda {
    private const val CARPETA = "vits-piper-es_AR-daniela-high"
    private const val MODELO = "es_AR-daniela-high.onnx"
    private const val URL_MODELO =
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2"

    @Volatile private var descargando = false
    @Volatile private var progreso = 0
    @Volatile private var error: String? = null
    @Volatile private var token = 0
    @Volatile private var pistaActual: AudioTrack? = null
    private var tts: OfflineTts? = null
    private val cola = Executors.newSingleThreadExecutor()

    private fun dir(ctx: Context) = File(ctx.filesDir, CARPETA)
    private fun lista(ctx: Context) = File(dir(ctx), "listo").exists() && File(dir(ctx), MODELO).exists()

    /** "lista" | "falta" | "descargando:NN" | "error:..." */
    fun estado(ctx: Context): String = when {
        descargando -> "descargando:$progreso"
        lista(ctx) -> "lista"
        error != null -> "falta"
        else -> "falta"
    }

    fun descargar(ctx: Context) {
        if (descargando || lista(ctx)) return
        descargando = true; progreso = 0; error = null
        val app = ctx.applicationContext
        thread(name = "descarga-voz") {
            val tmp = File(app.cacheDir, "voz.tar.bz2")
            try {
                // 1) bajar (sigue redirecciones de GitHub)
                var url = URL(URL_MODELO)
                var con: HttpURLConnection
                var saltos = 0
                while (true) {
                    con = url.openConnection() as HttpURLConnection
                    con.instanceFollowRedirects = false
                    con.connectTimeout = 20000; con.readTimeout = 30000
                    val c = con.responseCode
                    if (c in 300..399 && saltos++ < 5) { url = URL(url, con.getHeaderField("Location")); con.disconnect(); continue }
                    if (c != 200) throw Exception("HTTP $c")
                    break
                }
                val total = con.contentLengthLong
                con.inputStream.use { entrada ->
                    tmp.outputStream().use { salida ->
                        val buf = ByteArray(64 * 1024)
                        var leido = 0L
                        while (true) {
                            val n = entrada.read(buf)
                            if (n < 0) break
                            salida.write(buf, 0, n)
                            leido += n
                            if (total > 0) progreso = (leido * 90 / total).toInt()
                        }
                    }
                }
                // 2) descomprimir en la memoria interna de la app
                val destino = app.filesDir
                val raiz = destino.canonicalPath + File.separator
                TarArchiveInputStream(BZip2CompressorInputStream(BufferedInputStream(FileInputStream(tmp)))).use { tar ->
                    while (true) {
                        val e = tar.nextEntry ?: break
                        val f = File(destino, e.name)
                        if (!f.canonicalPath.startsWith(raiz)) continue // seguridad
                        if (e.isDirectory) { f.mkdirs(); continue }
                        f.parentFile?.mkdirs()
                        f.outputStream().use { tar.copyTo(it) }
                    }
                }
                File(dir(app), "listo").writeText("ok")
                progreso = 100
            } catch (e: Exception) {
                error = e.message ?: "error"
            } finally {
                tmp.delete()
                descargando = false
            }
        }
    }

    private fun motor(ctx: Context): OfflineTts? {
        tts?.let { return it }
        if (!lista(ctx)) return null
        val d = dir(ctx).absolutePath
        val cfg = OfflineTtsConfig(
            model = OfflineTtsModelConfig(
                vits = OfflineTtsVitsModelConfig(
                    model = "$d/$MODELO",
                    tokens = "$d/tokens.txt",
                    dataDir = "$d/espeak-ng-data",
                    noiseScale = 0.6f,
                    noiseScaleW = 0.8f,
                ),
                numThreads = 2,
                debug = false,
                provider = "cpu",
            ),
            maxNumSentences = 1,
        )
        return try { OfflineTts(null, cfg).also { tts = it } } catch (e: Throwable) { error = e.message; null }
    }

    fun callar() {
        token++
        try { pistaActual?.pause(); pistaActual?.flush() } catch (_: Exception) {}
    }

    /** evento(tipo): "inicio" | "fin" | "error" */
    fun hablar(ctx: Context, texto: String, tono: Float, evento: (String) -> Unit) {
        val mio = ++token
        try { pistaActual?.pause(); pistaActual?.flush() } catch (_: Exception) {}
        val app = ctx.applicationContext
        cola.execute {
            if (mio != token) { evento("fin"); return@execute }
            val t = motor(app)
            if (t == null) { evento("error"); return@execute }
            val factor = tono.coerceIn(1f, 1.8f)
            val velocidad = 1.06f / factor            // se genera más lenta…
            val frecuencia = (t.sampleRate() * factor).toInt() // …y se reproduce más rápido
            val minimo = AudioTrack.getMinBufferSize(frecuencia, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
            val pista = AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setSampleRate(frecuencia).build())
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(maxOf(minimo, frecuencia * 4 / 2))
                .build()
            pistaActual = pista
            var escritas = 0
            var empezo = false
            try {
                pista.play()
                t.generateWithCallback(texto, 0, velocidad) { muestras ->
                    if (mio != token) return@generateWithCallback 0
                    if (!empezo) { empezo = true; evento("inicio") }
                    pista.write(muestras, 0, muestras.size, AudioTrack.WRITE_BLOCKING)
                    escritas += muestras.size
                    1
                }
                // esperar a que termine de sonar lo que quedó en el buffer
                val limite = System.currentTimeMillis() + 15000
                while (mio == token && pista.playbackHeadPosition < escritas && System.currentTimeMillis() < limite) Thread.sleep(40)
                evento("fin")
            } catch (e: Throwable) {
                evento("error")
            } finally {
                try { pista.stop() } catch (_: Exception) {}
                pista.release()
                if (pistaActual === pista) pistaActual = null
            }
        }
    }
}
