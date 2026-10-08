# 🐼 Nuestro Panda

Un osito panda virtual para una pareja. Crece con el amor que se dan: hay que darle bambú, hacerle mimos y dedicarse frases. Si los dos lo cuidan todos los días, se suma una racha. En Android camina por la pantalla del celular, encima de las otras apps.

**Qué puede hacer:**
- 🎋 **Comer, mimos y frases.** Suman amor 💗 y el panda crece en 6 etapas: Bebé → Cachorrito → Pequeño → Juguetón → Grande → Panda sabio.
- 🔥 **Racha.** Cada día en que **los dos** lo cuidaron suma un día de racha y amor extra.
- 📳 **"Necesito amor".** Al otro le vibra el celular y le llega un aviso. En el panda flotante es **mantener apretado** al panda.
- 📍 **"¿Dónde estás?"** Le pregunta la ubicación a tu pareja, que decide si la comparte o la deja en automático. Cuando la comparte se abre un **mapa**; después se ve en la tarjeta "📍 … compartió dónde está" de la pantalla del panda, en Mensajes ("ver mapa") y en "¿Dónde estás?". Solo se guarda la última ubicación.
- 💌 **Mensajes entre ustedes a través del panda.** Con Gemini, el panda lee el clima de la pareja y cambia su ánimo.
- 💬 **Charlar con el panda** usando IA (Gemini). Cada persona usa **su propia cuenta** de Gemini.
- 🔊 **Voz tierna de nene.** Una sola voz: la del celular (o la del navegador) con el tono subido. No gasta IA. En Ajustes se ajusta el "tono de nene".
- 🌸 **Recuerdos.** Estadísticas, mensajes guardados y las etapas de crecimiento.

**Estilo Pou (v2):**
- 🎋🛁⚡💗 **Cuatro barras:** panza, limpieza, energía y cariño. Si no lo cuidan, se ensucia (manchas y olor), se cansa o se pone triste.
- 🛁 **Bañarlo:** se frota con el dedo hasta llenarlo de espuma y después se enjuaga.
- 😴 **Dormir:** se le apaga la luz y recupera energía. Durmiendo no come, no se baña ni juega.
- 🪙 **Monedas** (compartidas): regalo diario, **desafíos del día** (mandar una foto, una frase, bañarlo…), el minijuego **"Atrapá el bambú"** y cada día de racha.
- 🛍️ **Tienda:** comida para la **heladera** (manzana, sushi, torta…) y **accesorios** (moño, gorrito, corona, lentes, bufanda…).
- 💭 **"¿Cómo estás?":** también para cosas tristes (estoy triste, te extraño, necesito un abrazo, perdón…). Al otro le llega un aviso con opciones para responder.
- 📸 **Fotos** entre ustedes, comprimidas en el celular (~100 KB).
- ❓ **Pregunta del día** para la pareja: la respuesta del otro se ve cuando respondés vos.
- 🎒 **Si nadie lo cuida:** a los 3 días avisa, a los 5 da el último aviso y a los 7 **agarra su mochila y se va**. Hay que adoptar uno nuevo (los mensajes y recuerdos quedan).

---

## 📁 Qué hay en cada carpeta

```
web/          La app (HTML + JS, sin compilar). La usan Vercel y la app Android.
  index.html    pantalla principal
  overlay.html  el panda flotante (Android). En el navegador se simula.
  js/panda.js   dibujo y animación del panda
  js/datos.js   conexión con Supabase (y "modo demo" sin internet)
  js/app.js     pantallas y acciones
  js/voz.js     voces
  js/reglas.js  puntos, etapas, hambre y ánimo
api/          Funciones de Vercel (servidor). Solo acá se usa Gemini.
supabase/     schema.sql: tablas, seguridad, reglas del juego y limpieza automática
android/      App Android (Kotlin): panda flotante, voz del celular, notificaciones, ubicación
.github/      Compila el APK sola en GitHub
AGENTS.md     Instrucciones para la IA de VS Code (contexto del proyecto)
```

---

## 🚀 Puesta en marcha (una sola vez)

### 0. Probarla sin configurar nada (modo demo)
Abrí la carpeta en VS Code, instalá la extensión **Live Server**, hacé clic derecho en `web/index.html` y elegí **"Open with Live Server"**. Arranca en **modo demo**: todo queda en el navegador y hay una pareja simulada que responde. En Ajustes → "Modo demo" podés simular avisos y ver cómo crece el panda.
`web/overlay.html` simula el panda flotante.

### 1. Supabase (la base de datos)
1. Entrá a **supabase.com** y creá un proyecto. La región que te quede más cerca, por ejemplo São Paulo.
2. En **Authentication → Sign In / Providers**, activá **Allow anonymous sign-ins**.
3. En **SQL Editor → New query**, pegá **todo** `supabase/schema.sql` y tocá **Run**.
4. En **Project Settings → API**, copiá la **Project URL** y la **anon public key**.

### 2. Gemini (una key por persona)
Cada uno entra a **aistudio.google.com** con **su propia cuenta de Google** y crea una API key. El límite gratis es **por proyecto/cuenta**, así que con dos cuentas tienen el doble de uso.

### 3. GitHub + Vercel (la web)
1. Subí esta carpeta a un repositorio de GitHub.
2. En **vercel.com → Add New → Project**, importá el repo. Framework: **Other**, sin build.
3. En **Environment Variables**, cargá:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | la Project URL |
| `SUPABASE_ANON_KEY` | la anon public key |
| `GEMINI_KEY_1` | key de Gemini de quien **crea** el panda |
| `GEMINI_KEY_2` | key de Gemini de quien **se une** con el código |
| `LIMITE_GEMINI_DIARIO` | (opcional) consultas por persona por día. Por defecto 60 |
| `CRON_SECRET` | (opcional) cualquier texto largo, protege la limpieza diaria |

4. Deploy. Para comprobar, abrí `https://TU-APP.vercel.app/api/estado`: tiene que decir `"conexion": "OK"`. Con `?probar=1` también prueba las keys de Gemini.

### 4. La app Android (panda flotante + voz)
**Opción fácil, sin instalar nada:** GitHub la compila sola.
1. En el repo, **Settings → Secrets and variables → Actions → Variables**, creá `PANDA_URL` con tu dirección de Vercel, por ejemplo `https://mi-panda.vercel.app/`. Si no la cargás, la app la pide al abrirla la primera vez.
2. Andá a **Actions → "Compilar APK" → Run workflow**. Tarda unos 5 minutos.
3. Desde el celular entrá a **Releases → "APK más reciente"**, descargá **NuestroPanda.apk** e instalala. Android pide permitir "instalar apps desconocidas" desde el navegador.

**Opción Android Studio:** abrí la carpeta `android/` y tocá Run.

### 5. Primer uso
1. Uno abre la app → **Crear nuestro panda**. Le aparecen un **código** para la pareja y una **clave de recuperación**. Sacale una captura.
2. El otro abre la app → **Tengo un código** y lo escribe. También recibe su clave de recuperación.
3. En **Ajustes** de cada celular:
   - **Panda flotante:** activarlo y dar el permiso **"Mostrar sobre otras apps"**.
   - **Notificaciones** y **Ubicación:** permitir.
   - **Batería:** quitar el límite. Si no, Samsung, Xiaomi y otras marcas cierran al panda.
   - **Voz:** en Ajustes → Voz probá el "Tono de nene". Con "Elegir otra voz del celu" podés cambiar a la de Google.

**Panda flotante:** un toque le da mimos · doble toque abre la app · **tres toques lo dejan quieto** (o lo vuelven a soltar; también en Ajustes) · mantener apretado manda "Necesito amor" · arrastrar lo mueve.

---

## ⏳ Para que dure mucho tiempo (límites gratis)

**Gemini (IA)** se usa **solo** en tres casos:
- cuando le escriben al panda en "Hablar" (1 consulta por mensaje);
- la frase del día (1 por día);
- para entender el ánimo (1 cada 8 mensajes entre ustedes).

**No gastan nada:** comer, mimos, racha, vibrar, ubicación, mensajes, baño, dormir, tienda, desafíos, minijuego, fotos y la **voz**, que funciona en el celular.

- Cada persona tiene un tope diario (`LIMITE_GEMINI_DIARIO`, por defecto 60). Se ve en **Ajustes → Inteligencia artificial**. Si se llega al tope, el panda responde con frases propias hasta el día siguiente. El cupo de Google se renueva a la medianoche del Pacífico (4–5 AM en Argentina).
- En el plan gratis, Google puede usar los mensajes que se envían a Gemini para mejorar sus productos.

**Supabase gratis:** 500 MB de base, que es muchísimo para esto: cada acción ocupa menos de 1 KB. Igual hay **limpieza automática diaria**:
- borra eventos de más de 180 días;
- borra frases de más de 2 años;
- borra las fotos de más de 120 días (salvo las guardadas con 💖);
- **nunca borra los mensajes guardados con 💖**;
- si la base pasa los 400 MB, borra lo más viejo.

La ejecutan Supabase (pg_cron) y Vercel (`/api/mantenimiento`, una vez por día). Esa visita diaria también evita que Supabase **pause** el proyecto, cosa que hace a la semana sin uso.

---

## 🧑‍💻 Seguir desarrollando con VS Code
Pedile cambios a la IA de VS Code (Copilot, Claude, etc.). El archivo **AGENTS.md** le explica cómo está armado todo. Ejemplos:
- "Agregá un accesorio nuevo al panda en la etapa Juguetón."
- "Cambiá cuántos puntos da una caricia" (se cambia en `supabase/schema.sql` **y** en `web/js/reglas.js`).
- "Agregá un minijuego para ganar amor."

Los cambios en `web/` y `api/` se publican solos al subirlos a GitHub (Vercel). Los cambios en `android/` necesitan compilar el APK de nuevo (Actions).

## 🧩 Si cambian la base de datos
Cada vez que `supabase/schema.sql` cambia (por ejemplo, con la versión estilo Pou), hay que **volver a ejecutarlo entero** en Supabase → SQL Editor → Run. No se pierde nada: agrega lo nuevo y deja lo que ya había.

## 🔄 Actualizaciones
- **web/ y api/**: se actualizan solos al subir a GitHub (Vercel). No hace falta reinstalar nada.
- **android/**: GitHub compila un APK nuevo y la app avisa sola "Hay una versión nueva" (o Ajustes → Buscar actualización). Se instala encima, sin desinstalar.
- La firma del APK es `android/panda.keystore`: **no la borres ni la cambies**, o Android obliga a desinstalar.

## 🆘 Problemas comunes
- **La app arranca en "modo demo" estando en Vercel:** faltan `SUPABASE_URL` o `SUPABASE_ANON_KEY`, o falta hacer *Redeploy* después de cargarlas.
- **"No se pudo iniciar sesión":** no activaste *Anonymous sign-ins* en Supabase.
- **El panda flotante desaparece al rato:** quitale el límite de batería a la app.
- **No llega la vibración:** el panda flotante tiene que estar activado y con internet. Si Android cerró la app, vuelve al abrirla.
- **Cambié de celular:** "Cambié de celular / recuperar mi lugar" con el código de la pareja y tu clave.
