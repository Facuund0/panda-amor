# Instrucciones para asistentes de IA (VS Code, Copilot, Claude, etc.)

Proyecto: **Nuestro Panda**, un panda virtual de pareja. Respondé y comentá el código **en español rioplatense**: el dueño del proyecto es estudiante y lee en español.

## Arquitectura
- **web/**: HTML + JavaScript **sin frameworks ni compilación** (scripts clásicos con `<script src>`, nada de `import`). Cada archivo se envuelve en una IIFE y expone un global (`Panda`, `Reglas`, `Frases`, `Voz`, `Puente`, `crearDatos`). Orden de carga: ver `web/index.html`.
  - `js/panda.js`: el SVG del panda por etapa (`svgPanda(etapa)`, con FORMAS 0..5) y el motor de animación con resortes (`class Panda`, se actualiza en `cuadro()` cada frame). Las partes animables tienen clases `pz-*`.
  - `js/datos.js`: misma interfaz para **Supabase** (real) y **Demo** (localStorage, pareja simulada). Si agregás una función, implementala en las DOS clases.
  - `js/app.js`: pantallas (pestañas Panda, Mensajes, Recuerdos, Ajustes) y acciones.
  - `js/overlay.js` + `overlay.html`: el panda flotante. En Android la ventana la mueve la app nativa; en el navegador se simula.
  - `js/puente.js`: llamadas a `window.AndroidPanda` (la app Android), con alternativa web.
  - `js/reglas.js`: etapas, puntos, hambre y ánimo **visibles**.
- **api/** (Vercel, Node 18+, ES modules): `panda.js` es lo **único que llama a Gemini** (acciones `chat`, `animo`, `frase_dia`). `_comun.js` tiene helpers (los archivos con `_` no son endpoints). `config.js` da la URL y la anon key de Supabase a la web. `mantenimiento.js` lo corre el cron diario. `estado.js` es el diagnóstico.
- **supabase/schema.sql**: tablas, RLS (cada pareja ve solo lo suyo), funciones RPC. **Toda escritura pasa por funciones `security definer`** (no hay políticas de insert/update). Se puede re-ejecutar entero.
- **android/** (Kotlin, sin AndroidX, minSdk 26): `MainActivity` (WebView de la app), `PandaService` (ventana flotante + `CapaToque` para gestos), `Puente` (`@JavascriptInterface`, nombre JS `AndroidPanda`), `VozPanda` (Piper con sherpa-onnx; tono de nene = generar lento + reproducir rápido), `Ubicacion`, `Avisos`.

## Reglas importantes
1. **Reglas del juego duplicadas a propósito**: los puntos reales se calculan en `registrar_accion` (schema.sql). `web/js/reglas.js` y `DatosDemo.accion` (datos.js) deben coincidir. Si cambiás puntos, topes o etapas, cambiá los tres.
2. **Cuidar la cuota gratis de Gemini**: no agregar llamadas a Gemini en cosas frecuentes (comer, mimos, abrir la app). Siempre pasar por `usar_gemini` (contador diario) en `api/panda.js`. Preferir frases locales (`js/frases.js`).
3. **Privacidad**: la ubicación solo se comparte si la persona acepta (o activó "compartir sin preguntarme"). Guardar solo la última ubicación. No guardar historial de ubicaciones.
4. **No subir secretos**: las keys de Gemini van solo en variables de entorno de Vercel. La anon key de Supabase es pública (la protege RLS).
5. Si agregás un método al puente Android: agregarlo en `Puente.kt` con `@JavascriptInterface` **y** en `web/js/puente.js` con alternativa para navegador.
6. Mantener la web **mobile-first** (máx. 480 px), con letra clara y botones grandes.
7. Cambios de base de datos: agregarlos a `schema.sql` de forma idempotente (`create or replace`, `if not exists`) y avisar que hay que volver a ejecutarlo en Supabase.

## Cómo probar
- Web sin backend: abrir `web/index.html` con Live Server → modo demo (o agregar `?demo` a la URL).
- Panda flotante: `web/overlay.html` (simulación con el mouse).
- API: se prueba una vez publicada en Vercel (`/api/estado`, `/api/estado?probar=1`).
- Android: GitHub Actions (`.github/workflows/android.yml`) compila el APK y lo publica en Releases → "apk".
