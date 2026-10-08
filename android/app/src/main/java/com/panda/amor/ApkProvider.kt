package com.panda.amor

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File

/**
 * Le "presta" el APK descargado al instalador de Android (sin AndroidX no hay FileProvider,
 * así que este es uno mínimo que comparte UN solo archivo: la actualización).
 */
class ApkProvider : ContentProvider() {
    companion object {
        fun archivo(ctx: Context) = File(ctx.cacheDir, "actualizacion/NuestroPanda.apk")
        fun uri(ctx: Context): Uri = Uri.parse("content://${ctx.packageName}.apk/NuestroPanda.apk")
    }

    override fun onCreate() = true
    override fun getType(uri: Uri) = "application/vnd.android.package-archive"

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
        ParcelFileDescriptor.open(archivo(context!!), ParcelFileDescriptor.MODE_READ_ONLY)

    // el instalador pregunta el nombre y el tamaño
    override fun query(uri: Uri, p: Array<out String>?, s: String?, a: Array<out String>?, o: String?): Cursor {
        val f = archivo(context!!)
        return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)).apply { addRow(arrayOf<Any>(f.name, f.length())) }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, s: String?, a: Array<out String>?) = 0
    override fun update(uri: Uri, v: ContentValues?, s: String?, a: Array<out String>?) = 0
}
