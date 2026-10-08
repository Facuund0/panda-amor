import java.net.URI
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val urlApp: String = (project.findProperty("pandaUrl") as String?)?.trim()?.ifEmpty { null }
    ?: "https://TU-PROYECTO.vercel.app/"

// Número de versión: lo pone GitHub Actions (sube solo en cada compilación). Sirve para el actualizador.
val numeroVersion: Int = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 3

android {
    namespace = "com.panda.amor"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.panda.amor"
        minSdk = 26
        targetSdk = 35
        versionCode = numeroVersion
        versionName = "1.$numeroVersion"
        buildConfigField("String", "APP_URL", "\"$urlApp\"")
        // Solo celulares reales (achica la app)
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    buildFeatures { buildConfig = true }

    // Firma SIEMPRE con la misma clave (android/panda.keystore). Si cambia la firma,
    // Android no deja actualizar encima y obliga a desinstalar (y se pierden los datos de la app).
    signingConfigs {
        create("panda") {
            storeFile = rootProject.file("panda.keystore")
            storePassword = "pandaamor"
            keyAlias = "panda"
            keyPassword = "pandaamor"
        }
    }

    buildTypes {
        debug { signingConfig = signingConfigs.getByName("panda") }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("panda")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

// ---- Motor de voz sin internet (sherpa-onnx, para la voz Piper) ----
// Se descarga solo la primera vez que se compila.
val sherpaVersion = "1.13.8"
val sherpaAar = file("libs/sherpa-onnx-$sherpaVersion.aar")
if (!sherpaAar.exists()) {
    sherpaAar.parentFile.mkdirs()
    println("Descargando sherpa-onnx $sherpaVersion (motor de voz)…")
    URI("https://github.com/k2-fsa/sherpa-onnx/releases/download/v$sherpaVersion/sherpa-onnx-$sherpaVersion.aar")
        .toURL().openStream().use { entrada -> sherpaAar.outputStream().use { entrada.copyTo(it) } }
}

dependencies {
    implementation(files(sherpaAar))
    // para descomprimir el modelo de voz (.tar.bz2)
    implementation("org.apache.commons:commons-compress:1.27.1")
}
