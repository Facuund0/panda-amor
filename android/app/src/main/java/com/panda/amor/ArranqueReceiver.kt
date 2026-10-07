package com.panda.amor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Al prender el celular (o actualizar la app), vuelve a poner al panda en la pantalla. */
class ArranqueReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (Config.flotanteEncendido(ctx) && Config.urlConfigurada(ctx)) {
            try { PandaService.iniciar(ctx, desdeApp = false) } catch (_: Exception) {}
        }
    }
}
