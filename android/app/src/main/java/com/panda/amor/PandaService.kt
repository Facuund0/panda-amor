package com.panda.amor

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * El panda flotante: una ventanita transparente encima de las demás apps.
 * Adentro hay una WebView con web/overlay.html (que dibuja y anima al panda).
 * La ventana la mueve este servicio; los toques los detecta CapaToque.
 */
class PandaService : Service() {

    companion object {
        var instancia: PandaService? = null
            private set

        fun iniciar(ctx: Context, desdeApp: Boolean) {
            if (!Settings.canDrawOverlays(ctx)) return
            val i = Intent(ctx, PandaService::class.java).putExtra("desde_app", desdeApp)
            // Android 12+ no deja arrancarlo desde segundo plano: en ese caso no hace nada
            try { ctx.startForegroundService(i) } catch (_: Exception) {}
        }

        fun detener(ctx: Context) {
            ctx.stopService(Intent(ctx, PandaService::class.java))
        }
    }

    private lateinit var wm: WindowManager
    private lateinit var lp: WindowManager.LayoutParams
    private lateinit var capa: CapaToque
    private lateinit var web: WebView
    private var animacion: ValueAnimator? = null
    private val principal = Handler(Looper.getMainLooper())
    private val densidad get() = resources.displayMetrics.density

    private fun dp(v: Int) = (v * densidad).roundToInt()
    private fun aDp(px: Int) = (px / densidad).roundToInt()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instancia = this
        Avisos.crearCanales(this)
        wm = getSystemService(WindowManager::class.java)
        val filtro = android.content.IntentFilter().apply { addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON) }
        try {
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(pantalla, filtro, Context.RECEIVER_NOT_EXPORTED)
            else registerReceiver(pantalla, filtro)
        } catch (_: Exception) {}
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val desdeApp = intent?.getBooleanExtra("desde_app", false) ?: false
        try {
            val noti = Avisos.notificacionFija(this)
            if (Build.VERSION.SDK_INT >= 34) {
                // Solo "uso especial": el tipo "ubicación" en Android 14+ cierra la app si falta algún permiso.
                // La ubicación se pide con la app abierta, así que no lo necesita.
                startForeground(Avisos.ID_FIJA, noti, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(Avisos.ID_FIJA, noti)
            }
        } catch (e: Exception) {
            // Android no dejó mostrar el panda ahora (por ej. arrancó en segundo plano): se apaga sin romper nada
            stopSelf(); return START_NOT_STICKY
        }
        if (!::capa.isInitialized) {
            try { crearVentana() } catch (e: Exception) {
                Fallos.guardar(this, "panda flotante", e); stopSelf(); return START_NOT_STICKY
            }
        }
        ocultar(MainActivity.enPrimerPlano)
        // NOT_STICKY: si Android lo cierra, vuelve al abrir la app (evita cierres en bucle en Samsung)
        return START_NOT_STICKY
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun crearVentana() {
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString = settings.userAgentString + " PandaAmorApp"
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            webViewClient = WebViewClient()
        }
        web.addJavascriptInterface(Puente(this, web, servicio = this), "AndroidPanda")

        capa = CapaToque(this) { tipo -> web.evaluateJavascript("window.pandaToque && window.pandaToque('$tipo')", null) }
        capa.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        val pantalla = medidas()
        lp = WindowManager.LayoutParams(
            dp(140), dp(152),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = pantalla.widthPixels - dp(160)
            y = pantalla.heightPixels - dp(260)
        }
        wm.addView(capa, lp)
        web.loadUrl(Config.url(this) + "overlay.html?android=1")
    }

    fun ocultar(oculto: Boolean) = principal.post {
        if (!::capa.isInitialized) return@post
        capa.visibility = if (oculto) View.GONE else View.VISIBLE
        pausarDibujo(oculto || !pantallaPrendida)
    }

    // ---- ahorro de batería: con la pantalla apagada (o el panda oculto) no se dibuja nada ----
    // (los avisos de la pareja siguen llegando: solo se pausa la animación)
    private var pantallaPrendida = true
    private fun pausarDibujo(pausar: Boolean) {
        if (!::web.isInitialized) return
        try { if (pausar) web.onPause() else web.onResume() } catch (_: Exception) {}
    }
    private val pantalla = object : android.content.BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            pantallaPrendida = i.action != Intent.ACTION_SCREEN_OFF
            pausarDibujo(!pantallaPrendida || MainActivity.enPrimerPlano)
        }
    }

    private fun medidas(): DisplayMetrics {
        val m = DisplayMetrics()
        if (Build.VERSION.SDK_INT >= 30) {
            val b = wm.currentWindowMetrics.bounds
            m.widthPixels = b.width(); m.heightPixels = b.height()
        } else {
            @Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(m)
        }
        return m
    }

    fun pantallaJson(): String { val m = medidas(); return "{\"w\":${aDp(m.widthPixels)},\"h\":${aDp(m.heightPixels)}}" }
    fun posicionJson(): String = if (!::lp.isInitialized) "{\"x\":0,\"y\":0}" else "{\"x\":${aDp(lp.x)},\"y\":${aDp(lp.y)}}"

    private fun limitar() {
        val m = medidas()
        lp.x = lp.x.coerceIn(0, maxOf(0, m.widthPixels - lp.width))
        lp.y = lp.y.coerceIn(0, maxOf(0, m.heightPixels - lp.height))
    }

    private fun actualizar() { try { wm.updateViewLayout(capa, lp) } catch (_: Exception) {} }

    fun moverA(xDp: Int, yDp: Int, ms: Int) = principal.post {
        if (!::capa.isInitialized) return@post
        animacion?.cancel()
        val x0 = lp.x; val y0 = lp.y
        val x1 = dp(xDp); val y1 = dp(yDp)
        animacion = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = maxOf(1, ms).toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val k = it.animatedValue as Float
                lp.x = (x0 + (x1 - x0) * k).roundToInt()
                lp.y = (y0 + (y1 - y0) * k).roundToInt()
                limitar(); actualizar()
            }
            start()
        }
    }

    fun tamano(wDp: Int, hDp: Int, xDp: Int, yDp: Int) = principal.post {
        if (!::capa.isInitialized) return@post
        animacion?.cancel()
        lp.width = dp(wDp); lp.height = dp(hDp); lp.x = dp(xDp); lp.y = dp(yDp)
        limitar(); actualizar()
    }

    fun arrastrar(dx: Int, dy: Int, x0: Int, y0: Int) {
        if (!::capa.isInitialized) return
        animacion?.cancel()
        lp.x = x0 + dx; lp.y = y0 + dy
        limitar(); actualizar()
    }

    val xActual get() = lp.x
    val yActual get() = lp.y

    override fun onDestroy() {
        instancia = null
        try { unregisterReceiver(pantalla) } catch (_: Exception) {}
        animacion?.cancel()
        if (::capa.isInitialized) {
            try { wm.removeView(capa) } catch (_: Exception) {}
            try { web.destroy() } catch (_: Exception) {}
        }
        super.onDestroy()
    }
}

/** Detecta toque, doble toque, mantener apretado y arrastrar sobre el panda. */
@SuppressLint("ViewConstructor")
class CapaToque(private val servicio: PandaService, private val avisar: (String) -> Unit) : FrameLayout(servicio) {
    private val umbral = ViewConfiguration.get(servicio).scaledTouchSlop
    private val h = Handler(Looper.getMainLooper())
    private var abajoX = 0f; private var abajoY = 0f
    private var ventanaX = 0; private var ventanaY = 0
    private var arrastrando = false
    private var largoHecho = false
    private var toques = 0
    private val largo = Runnable { largoHecho = true; avisar("largo") }
    // Cuenta los toques seguidos: 1 = mimos, 2 = abrir la app, 3 o más = quedarse quieto / volver a pasear
    private val resolverToques = Runnable {
        val n = toques; toques = 0
        avisar(when { n >= 3 -> "triple"; n == 2 -> "doble"; else -> "tap" })
    }

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean = true

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                abajoX = e.rawX; abajoY = e.rawY
                ventanaX = servicio.xActual; ventanaY = servicio.yActual
                arrastrando = false; largoHecho = false
                h.postDelayed(largo, 600)
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = e.rawX - abajoX; val dy = e.rawY - abajoY
                if (!arrastrando && (abs(dx) > umbral || abs(dy) > umbral) && !largoHecho) {
                    arrastrando = true; h.removeCallbacks(largo); avisar("arrastre_inicio")
                }
                if (arrastrando) servicio.arrastrar(dx.roundToInt(), dy.roundToInt(), ventanaX, ventanaY)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                h.removeCallbacks(largo)
                when {
                    arrastrando -> avisar("arrastre_fin")
                    largoHecho -> {}
                    e.actionMasked == MotionEvent.ACTION_UP -> {
                        toques++
                        h.removeCallbacks(resolverToques)
                        h.postDelayed(resolverToques, 320)
                    }
                }
                arrastrando = false
            }
        }
        return true
    }
}
