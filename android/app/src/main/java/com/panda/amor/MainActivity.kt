package com.panda.amor

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ContentValues
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import org.json.JSONObject

/** La app principal: una WebView que muestra la página de Vercel. */
class MainActivity : Activity() {

    companion object {
        @Volatile var enPrimerPlano = false
            private set
    }

    private lateinit var web: WebView
    private var elegirArchivo: ValueCallback<Array<Uri>>? = null
    private var fotoCamara: Uri? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Avisos.crearCanales(this)
        val rosa = Color.parseColor("#fff4f6")
        window.statusBarColor = rosa
        window.navigationBarColor = rosa

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#fff4f6"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString = settings.userAgentString + " PandaAmorApp"
            webChromeClient = object : WebChromeClient() {
                // <input type="file">: elegir una foto de la galería o sacarla con la cámara
                override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                    elegirArchivo?.onReceiveValue(null)
                    elegirArchivo = cb
                    abrirSelectorFoto()
                    return true
                }
            }
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
        // Recién actualizada la app: borrar la página guardada para que cargue la web nueva
        val prefs = getSharedPreferences("panda", MODE_PRIVATE)
        if (prefs.getInt("version_web_limpia", 0) != BuildConfig.VERSION_CODE) {
            web.clearCache(true)
            prefs.edit().putInt("version_web_limpia", BuildConfig.VERSION_CODE).apply()
        }
        val raiz = FrameLayout(this).apply { setBackgroundColor(rosa); addView(web) }
        setContentView(raiz)
        ajustarBordes(raiz)

        val error = Fallos.tomar(this)
        if (error != null) {
            // Modo seguro: se cerró por un error. Se apaga el panda flotante y se muestra qué pasó.
            Config.guardarFlotante(this, false)
            PandaService.detener(this)
            mostrarError(error)
        }
        if (Config.urlConfigurada(this)) cargar(intent) else pedirUrl()
        Actualizador.revisar(this)
        borrarVozVieja()
    }

    /** La voz de Daniela (Piper) se sacó: si estaba descargada, se borra para liberar ~115 MB. */
    private fun borrarVozVieja() {
        Thread {
            try {
                java.io.File(filesDir, "vits-piper-es_AR-daniela-high").deleteRecursively()
                java.io.File(cacheDir, "voz.tar.bz2").delete()
            } catch (_: Exception) {}
        }.start()
    }

    /**
     * Android 15 dibuja la app debajo de la barra de estado y de los botones/gesto de abajo.
     * Acá se deja un margen del tamaño de esas barras (y del teclado) para que no tapen nada.
     */
    private fun ajustarBordes(raiz: FrameLayout) {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            )
            raiz.setOnApplyWindowInsetsListener { v, ins ->
                val barras = ins.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val teclado = ins.getInsets(WindowInsets.Type.ime())
                v.setPadding(barras.left, barras.top, barras.right, maxOf(barras.bottom, teclado.bottom))
                WindowInsets.CONSUMED
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
    }

    /** Elegir foto: galería, o la cámara (la foto queda también en Imágenes/NuestroPanda). */
    private fun abrirSelectorFoto() {
        val galeria = Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE)
        val extras = mutableListOf<Intent>()
        fotoCamara = null
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                val datos = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, "panda_${System.currentTimeMillis()}.jpg")
                    put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/NuestroPanda")
                }
                fotoCamara = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, datos)
                fotoCamara?.let { extras.add(Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, it)) }
            } catch (_: Exception) { fotoCamara = null }
        }
        val selector = Intent.createChooser(galeria, "Elegí una foto").putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toTypedArray())
        try { startActivityForResult(selector, 21) } catch (_: Exception) { elegirArchivo?.onReceiveValue(null); elegirArchivo = null }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 21) return
        var elegida: Uri? = null
        if (resultCode == RESULT_OK) elegida = data?.data ?: fotoCamara
        // si no usó la cámara, se borra el lugar vacío que se había reservado
        if (fotoCamara != null && elegida != fotoCamara) try { contentResolver.delete(fotoCamara!!, null, null) } catch (_: Exception) {}
        elegirArchivo?.onReceiveValue(elegida?.let { arrayOf(it) })
        elegirArchivo = null
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
        Actualizador.alVolver(this)
        VivoService.reanudar(this) // si compartía en vivo y Android lo cerró
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

    /** Atrás (gesto o flechita): primero cierra lo que esté abierto en la app (ventanas, juego, baño…). */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.__atras && window.__atras()) ? 'si' : 'no'") { r ->
            if (r?.contains("si") == true) return@evaluateJavascript
            if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
        }
    }
}
