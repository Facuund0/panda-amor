package com.panda.amor

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import org.json.JSONObject

/** La app principal: una WebView que muestra la página de Vercel. */
class MainActivity : Activity() {

    companion object {
        @Volatile var enPrimerPlano = false
            private set
    }

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Avisos.crearCanales(this)
        window.statusBarColor = Color.parseColor("#fff4f6")

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#fff4f6"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString = settings.userAgentString + " PandaAmorApp"
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                // los links externos (Google Maps, etc.) se abren afuera
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    val destino = r.url
                    val propia = Uri.parse(Config.url(this@MainActivity))
                    if (destino.host == propia.host) return false
                    try { startActivity(Intent(Intent.ACTION_VIEW, destino)) } catch (_: Exception) {}
                    return true
                }
            }
        }
        web.addJavascriptInterface(Puente(this, web, actividad = this), "AndroidPanda")
        setContentView(web)

        val error = Fallos.tomar(this)
        if (error != null) {
            // Modo seguro: se cerró por un error. Se apaga el panda flotante y se muestra qué pasó.
            Config.guardarFlotante(this, false)
            PandaService.detener(this)
            mostrarError(error)
        }
        if (Config.urlConfigurada(this)) cargar(intent) else pedirUrl()
    }

    private fun mostrarError(texto: String) {
        val portapapeles = getSystemService(android.content.ClipboardManager::class.java)
        AlertDialog.Builder(this)
            .setTitle("La app se cerró 😢")
            .setMessage("Apagué el panda flotante para que no vuelva a pasar. Si querés que lo arreglen, copiá el error y mandáselo a quien programa la app.\n\n" + texto.take(1500))
            .setPositiveButton("Copiar error") { _, _ ->
                portapapeles.setPrimaryClip(android.content.ClipData.newPlainText("error panda", texto))
                android.widget.Toast.makeText(this, "Error copiado", android.widget.Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cerrar", null)
            .show()
    }

    private fun cargar(i: Intent?) {
        val accion = i?.getStringExtra("accion").orEmpty()
        val extra = if (accion.isNotEmpty()) "&accion=" + Uri.encode(accion) else ""
        web.loadUrl(Config.url(this) + "?android=1$extra")
        if (Config.flotanteEncendido(this)) PandaService.iniciar(this, desdeApp = true)
    }

    /** La primera vez (si no se configuró la URL al compilar) la pregunta. */
    private fun pedirUrl() {
        val campo = EditText(this).apply { hint = "https://mi-panda.vercel.app"; setSingleLine() }
        val caja = LinearLayout(this).apply { setPadding(48, 24, 48, 0); addView(campo) }
        AlertDialog.Builder(this)
            .setTitle("Dirección de tu panda")
            .setMessage("Pegá la dirección de tu app en Vercel.")
            .setView(caja)
            .setCancelable(false)
            .setPositiveButton("Listo") { _, _ ->
                val u = campo.text.toString().trim()
                if (u.isEmpty()) pedirUrl() else { Config.guardarUrl(this, u); cargar(intent) }
            }
            .show()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val accion = intent.getStringExtra("accion").orEmpty()
        if (accion.isNotEmpty()) web.evaluateJavascript("window.__accionAndroid && window.__accionAndroid(${JSONObject.quote(accion)})", null)
    }

    override fun onResume() {
        super.onResume()
        enPrimerPlano = true
        PandaService.instancia?.ocultar(true) // dentro de la app no hace falta el flotante
        // si volvió de dar el permiso de "mostrar sobre otras apps"
        if (Config.flotanteEncendido(this) && Settings.canDrawOverlays(this) && PandaService.instancia == null && Config.urlConfigurada(this)) {
            PandaService.iniciar(this, desdeApp = true)
        }
        web.evaluateJavascript("window.dispatchEvent(new Event('android-volvio'))", null)
    }

    override fun onPause() {
        enPrimerPlano = false
        PandaService.instancia?.ocultar(false)
        super.onPause()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        web.evaluateJavascript("window.dispatchEvent(new Event('android-volvio'))", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
    }
}
