import java.net.URI
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val urlApp: String = (project.findProperty("pandaUrl") as String?)?.trim()?.ifEmpty { null }
    ?: "https://TU-PROYECTO.vercel.app/"

android {
    namespace = "com.panda.amor"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.panda.amor"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "APP_URL", "\"$urlApp\"")
        // Solo celulares reales (achica la app)
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    buildFeatures { buildConfig = true }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
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
