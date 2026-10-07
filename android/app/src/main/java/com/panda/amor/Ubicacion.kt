package com.panda.amor

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper

/** Ubicación actual (solo se pide cuando la persona acepta compartirla). */
object Ubicacion {
    fun tienePermiso(ctx: Context) =
        ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun obtener(ctx: Context, listo: (Location?, String?) -> Unit) {
        if (!tienePermiso(ctx)) return listo(null, "Falta el permiso de ubicación (Ajustes de la app)")
        val lm = ctx.getSystemService(LocationManager::class.java)
        val principal = Handler(Looper.getMainLooper())
        // si hay una ubicación reciente (menos de 2 minutos), usarla
        val reciente = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { p -> try { lm.getLastKnownLocation(p) } catch (_: Exception) { null } }
            .filter { System.currentTimeMillis() - it.time < 120_000 }
            .minByOrNull { it.accuracy }
        if (reciente != null) return listo(reciente, null)

        val proveedor = when {
            Build.VERSION.SDK_INT >= 31 && lm.isProviderEnabled(LocationManager.FUSED_PROVIDER) -> LocationManager.FUSED_PROVIDER
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> return listo(null, "La ubicación del celular está apagada")
        }
        var terminado = false
        val terminar = { l: Location?, e: String? -> if (!terminado) { terminado = true; listo(l, e) } }
        if (Build.VERSION.SDK_INT >= 30) {
            lm.getCurrentLocation(proveedor, null, ctx.mainExecutor) { l -> terminar(l, if (l == null) "No se encontró la ubicación" else null) }
        } else {
            val oyente = object : LocationListener {
                override fun onLocationChanged(l: Location) { lm.removeUpdates(this); terminar(l, null) }
                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(p: String?, s: Int, b: android.os.Bundle?) {}
                override fun onProviderEnabled(p: String) {}
                override fun onProviderDisabled(p: String) {}
            }
            lm.requestLocationUpdates(proveedor, 0L, 0f, oyente, Looper.getMainLooper())
            principal.postDelayed({ lm.removeUpdates(oyente); terminar(null, "Tardó demasiado en encontrar la ubicación") }, 30_000)
        }
    }
}
