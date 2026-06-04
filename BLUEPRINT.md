# Blueprint — Academia de Villanos

## Identidad del canal

### Paleta de colores
| Rol | Color | Hex |
|-----|-------|-----|
| Primario (títulos, acentos) | Azul profundo | `#1a3a5c` |
| Secundario (bordes, sutilezas) | Gris medio | `#6b7280` |
| Fondo | Negro carbón | `#0d0d0d` |
| Texto principal | Blanco humo | `#f0f0f0` |
| Acento claro (hover, brillos) | Gris claro | `#9ca3af` |

### Tipografía
- **Títulos y etiquetas:** Cinzel, 'Trajan Pro', serif (gótica)
- **Subtítulos:** 'Cinzel', serif (peso 400)
- **Fallback:** Georgia, 'Times New Roman', serif

### Etiquetas de género
- No mostrar etiquetas de género (drama, tensión, terror)
- El tono se comunica VISUALMENTE mediante transiciones y paleta

---

## Reglas de edición

### 1. Timing de imágenes (por capítulo)

#### 1.1 Fuente de datos
- `guion.md` contiene la narración completa con estructura:
  - `# cX` = inicio de capítulo X
  - Párrafos separados por `<break time="Y" />`
  - Direcciones de actuación: `[thoughtful]`, `[whispers]`, `[inhales deeply]`, `[short pause]`, `[sarcastic]`, `[exhales sharply]`, `[sighs]`
- `INSTRUCCIONES.md` contiene los títulos de capítulos en sección `## Capítulos del video`

#### 1.2 Algoritmo de sincronización (2 pasos)

**Paso 1 — whisper position mapping (`sync-durations.ts`)**

Por cada capítulo:
1. Ejecuta whisper `small`/es sobre el audio (sin `--word_timestamps`)
2. Obtiene segmentos con start/end time y texto
3. Cuenta palabras esperadas por imagen desde `textInclude` (via `cleanTextInclude()`)
4. Cuenta palabras reales por segmento whisper desde `segment.text`
5. Mapea imágenes a tiempos whisper por **posición proporcional** (sin text matching):
   - Progresión acumulativa de palabras esperadas → progresión acumulativa de palabras whisper
   - Interpola tiempo dentro de cada segmento para límites por imagen
6. Escala para que `sum(durations) × FPS = audioDuration × FPS`
7. Escribe `durationInFrames` en `direccion.json`
8. Fallback a proporción de caracteres si whisper falla

**Paso 2 — distribución de pausa (`build-scenes.ts`)**

1. Lee `durationInFrames` de `direccion.json`
2. Si todas las imágenes tienen `durationInFrames > 0`, usa esos valores
3. Distribuye `CHAPTER_PAUSE_FRAMES (60) + extraFrames` proporcionalmente entre TODAS las imágenes:
   - `extraFrames = max(0, audioFrames - whisperSum)`
   - `totalExtra = CHAPTER_PAUSE_FRAMES + extraFrames`
   - Por imagen: `extra = round(totalExtra × imgDuration / whisperSum)`
4. Si no hay `durationInFrames`, fallback a proporción de caracteres o distribución equitativa

#### 1.3 Reglas de timing
- Mínimo por imagen: **1 frame** (30fps) — la duración real la define whisper
- Sin clamp: la posición mapping distribuye naturalmente por palabras narradas
- Cada capítulo tiene **2 segundos (60 frames) de pausa** al final (chapter pause)
  - Los 60 frames se distribuyen proporcionalmente entre todas las imágenes del capítulo
  - Durante esos frames se muestra un overlay de cierre de capítulo (título + fade-to-black)
  - El frame total del capítulo = `audioFrames + CHAPTER_PAUSE_FRAMES (60) + extraFrames`
  - La diferencia con el audio es intencional (incluye pausa entre capítulos)
- No requiere clamp de máximo — la interpolación de whisper distribuye naturalmente

### 2. Selección de transiciones (por sentimiento del texto)

#### 2.1 Análisis de sentimiento por grupo de párrafos
Analizar el texto del grupo asignado a CADA imagen para determinar su sentimiento dominante.

| Sentimiento | Palabras clave | Tono |
|-------------|----------------|------|
| `calm` | Explicación, descripción, contexto, historia | Neutral, expositivo |
| `tension` | "de repente", "trampa", "acecho", "oscuridad", "acecha", "algo", "presencia" | Creciente, inquietante |
| `drama` | "traición", "pérdida", "dolor", "sacrificio", "colapso", "arder", "morir" | Emotivo, conflictivo |
| `terror` | "horror", "pesadilla", "indefenso", "grita", "sangre", "implacable", "obsceno" | Violento, aterrador |
| `resolution` | "renacer", "nueva", "final", "descansa", "aprendió", "despertó" | Cierre, reflexivo |

#### 2.2 Mapeo sentimiento → transición (con diversidad)

Cada sentimiento tiene una **distribución ponderada** de transiciones. La selección es determinista basada en `imageIndex`:

| Sentimiento | Opciones | Peso |
|-------------|----------|------|
| `calm` | fade (7), crossfade (3) | Siempre suave |
| `tension` | radial (5), fade (3), zoom-blur (2) | Mayoría suave |
| `drama` | glitch (4), flash (3), fade (3) | Mixto, evita saturación |
| `terror` | shatter (4), glitch (3), flash (3) | Intenso pero alternado |
| `resolution` | crossfade (6), fade (4) | Siempre suave |

**Regla de sentimiento consecutivo:** Si dos imágenes consecutivas tienen el MISMO sentimiento, la transición se fuerza a `fade` (independientemente del mapeo). Esto evita efecto strobe cuando varias imágenes seguidas tienen el mismo tono narrativo.

Ejemplo: 3 imágenes `calm` consecutivas → todas usan `fade`, sin cambios bruscos.

#### 2.3 Reglas de aplicación
- Las transiciones SOLO se aplican durante el cambio de imagen (últimos N frames de la imagen actual)
- Fuera de la transición, la imagen es estable (sin transformaciones adicionales)
- Math.random() NO debe usarse: usar sin/cos determinista para efectos de vibración
- No se aplican transiciones durante la pausa de capítulo (últimos 60 frames del capítulo)

### 3. Efecto Ken Burns

| Sentimiento | Escala inicial | Escala final | Easing |
|-------------|---------------|-------------|--------|
| `calm` | 1.0 | 1.08 | Linear (lento) |
| `tension` | 1.04 | 1.12 | Ease-in-out |
| `drama` | 1.05 | 1.15 | Ease-in (acelerando) |
| `terror` | 1.08 | 1.22 | Ease-in (rápido) |
| `resolution` | 1.08 | 1.0 | Ease-out (zoom out) |

- El zoom se aplica SIEMPRE (toda la duración de la imagen)
- Mínimo visible: 1.0 → 1.08 (8% de zoom)

### 4. Título de capítulo

- Mostrar SOLO al inicio de cada capítulo (primeros **5 segundos**, 150 frames)
- Formato: `>> CAPÍTULO XX` + nombre del capítulo
- Posición: bottom-left (60px desde cada borde)
- Estilo: fondo negro 90% opacidad + blur(8px), borde izquierdo color primario
- Animación:
  - 0.0s → 0.5s: slide up + fade in + glow pulse
  - 0.5s → 4.0s: hold visible, glow decae gradualmente
  - 4.0s → 5.0s: fade out + slide up
- Tipografía: `>>` en monospace (15px), título en Cinzel 36px
- NO mostrar el título durante la pausa de capítulo (últimos 60 frames)

### 4.1 Pausa entre capítulos
- Cada capítulo tiene **60 frames (2 segundos)** de pausa al final
- Los CHAPTER_PAUSE_FRAMES se distribuyen proporcionalmente entre todas las imágenes del capítulo
- Durante la pausa se muestra **ChapterPauseOverlay**:
  - Fondo negro que funde de 0 → 1 en los primeros 30 frames
  - Texto centrado: `>> CAPÍTULO XX` + nombre del capítulo
  - Línea decorativa horizontal debajo del título
  - Texto funde out en los últimos 12 frames
- Después de la pausa, el siguiente capítulo comienza con un fade-from-black (primeros 20 frames)
- La pausa es silenciosa (el audio del capítulo ya terminó)
- El crossfade de música de fondo continua durante la pausa

### 5. Audio

#### 5.1 Arquitectura de audio (Sequence-based)
- Cada `<Audio>` de narración y música se envuelve en un `<Sequence>` de Remotion
- `<Sequence from={startFrame} durationInFrames={dur}>` monta/desmonta el Audio automáticamente
- Solo 1-2 `<Audio>` están activos simultáneamente (vs 12+ con el approach anterior)
- Remotion maneja correctamente el ciclo de vida del Audio via Sequence (mount → play → unmount)
- `volume` function solo se usa para fades locales (fade-in / fade-out / crossfade)

#### 5.2 Narración por capítulos
- Cada capítulo tiene su propio `<Sequence from={sceneStart} durationInFrames={dur}>` conteniendo `<Audio src={audioPath}>`
- Fade-in: primeros 10 frames (~0.33s) → linear 0→1 (via volume function dentro del Sequence)
- Fade-out: últimos 5 frames (~0.17s) → linear 1→0

#### 5.3 Música de fondo (multi-track)
- **Rotación de pistas:** Las pistas en `recursos/` se asignan en orden secuencial
  - Pista 1 → Capítulos 1-3
  - Pista 2 → Capítulos 4-6
  - Pista 3 → Capítulos 7-9
  - Pista 4 → Capítulos 10-12
- Cada pista musical se envuelve en `<Sequence from={chStart - 90} durationInFrames={...}>` para activar solo en su rango de capítulos
- **Volumen:** `0.10` (10%) — reducido para que la narración (volumen 1.0) tenga más presencia
- **Crossfade entre pistas:** 3 segundos (90 frames) de transición vía volumen dentro del Sequence
  - Sequence se extiende 90 frames antes del primer capítulo y 90 frames después del último
  - Pista entrante: 0 → 0.10 en 90 frames
  - Pista saliente: 0.10 → 0 en 90 frames
  - El crossfade extendido ayuda a suavizar silencios al final de algunas pistas
- **Intro music:** Sequence separado `from={0} durationInFrames={introDuration}` con la primera pista, fade-out en últimos 90 frames
- **Outro music:** Sequence separado `from={outroStart} durationInFrames={outroDuration}` con la última pista, fade-in en primeros 90 frames
- Fallback: si no hay musicTracks, un solo `<Sequence from={0} durationInFrames={totalFrames}>` con `backgroundMusic` a volumen 0.10

#### 5.4 Break tags
- `<break time="X" />` en guion.md → pausa en la narración
- Incluir estas pausas en el cálculo de timing de la imagen correspondiente

### 6. Outro

- Texto: "Gracias por ver" (blanco, texto shadow fuerte)
- Nombre del canal en caja semitransparente con borde primario
- Botón "Suscríbete" con glow pulsante basado en `primaryColor`
  - `boxShadow: 0 0 ${30 * glow}px ${primaryColor}55`
  - Fade in desde 0.35s de progreso
- Fondo con:
  - Data stream de hex (misma función que Intro, frame offset +1000)
  - Scan line horizontal (barrido cada 60 frames)
  - Gradientes radiales pulsantes en azul/gris
- Watermark: nombre del canal en bottom-left con barra vertical primaria
  - `font-family: 'Courier New', monospace`
  - Opacidad 0.4, visible durante toda la duración
- Sin etiquetas de género

### 7. Intro

- Mostrar:
  - Nombre del canal (Academia de Villanos)
  - Título del video
  - Sin etiquetas de género/mood
- Efectos existentes: pulso radial, líneas decorativas, glitch sutil, viñeta
- **Nuevos efectos visuales:**
  - **Data stream de fondo:** matriz de caracteres hex (0-9, A-F) generados determinísticamente
    - Fuente: `'Courier New', monospace`, 11px
    - Opacidad: 0.04 (muy sutil)
    - Scroll vertical lento (0.3px/frame)
    - Color: `primaryColor`
  - **Scan line:** línea horizontal que barre de arriba a abajo cada 60 frames
    - Gradiente horizontal de transparente → primaryColor → transparente
    - Opacidad: 0.3-0.6 según posición
    - Box shadow para efecto glow
  - **Backdrop de texto:** caja semitransparente `rgba(0,0,0,0.55)` + blur(12px) detrás del título
    - Garantiza legibilidad independientemente de la viñeta
    - Padding: 28px 48px, border-radius: 8px
  - **Text shadow mejorado:** `0 4px 40px rgba(0,0,0,0.7), 0 0 80px ${primaryColor}22`
- Duración: 5 segundos (150 frames)

### 8. Secuencia completa de build

```bash
# Paso 1: sincronizar duraciones con whisper (si cambió audio o textInclude)
npx tsx src/scripts/sync-durations.ts content/academia-de-villanos/YYYY-MM-DD_nombre-video

# Paso 2: construir escenas (lee durationInFrames de direccion.json)
npm run build content/academia-de-villanos/YYYY-MM-DD_nombre-video

# Paso 3: renderizar
npm run render content/academia-de-villanos/YYYY-MM-DD_nombre-video
```

### 9. Renderizado con GPU (RTX 3070)

El script `render-video.ts` usa `chromiumOptions.gl: "angle"` para activar aceleración DirectX 11 vía ANGLE en Windows. Esto acelera significativamente el compositing con la GPU NVIDIA.

El nombre de salida se genera automáticamente desde `config.json → videoTitle` con slug, en `output/`:

```bash
npm run render content/academia-de-villanos/YYYY-MM-DD_nombre-video
# → output/silias-thorne-el-motor-determinista.mp4
```

Se puede sobrescribir la ruta de salida con un segundo argumento:

```bash
npm run render content/academia-de-villanos/YYYY-MM-DD_nombre-video output/mi-video.mp4
```

Flags adicionales (manual):
- `--codec=h264` (por defecto)
- Para NVENC hardware encoding: `--codec=h264 --enable-nvenc`

---

## Convenciones de código

### Nombres de archivos de salida
- Formato: `{slug-del-titulo}.mp4` (generado desde `config.json` → `videoTitle`)
- Ejemplo: `silias-thorne-el-motor-determinista.mp4`
- Ubicación por defecto: `output/{slug}.mp4` (directorio `output/` en raíz del proyecto)
- Se puede sobrescribir pasando segundo argumento al script de render

### Estructura de datos (types.ts)
```typescript
type TransitionType = "fade" | "radial" | "glitch" | "flash" | "zoom-blur" | "shatter" | "crossfade";
type Sentiment = "calm" | "tension" | "drama" | "terror" | "resolution";

interface ImageMeta {
  path: string;
  fileType: "image" | "video";
  caption?: string;
  durationInFrames: number;
  transitionType: TransitionType;
  transitionDuration: number;
  sentiment: Sentiment;
  kenBurnsStart: number;
  kenBurnsEnd: number;
}

interface MusicTrack {
  path: string;
  chapterStart: number;
  chapterEnd: number;
}
```

### Reglas de audio en Main.tsx
- **SIEMPRE** usar `<Sequence>` de Remotion para manejar el ciclo de vida del `<Audio>`
- Cada capítulo de narración: `<Sequence from={sceneStart} durationInFrames={dur}><Audio .../></Sequence>`
- Cada pista musical: `<Sequence>` con extensión de 90 frames para crossfade
- `MUSIC_VOLUME = 0.10` (constante global en Main.tsx)
- `CROSSFADE_FRAMES = 90` (3 segundos de transición entre pistas)
- Narración: volume 1.0 con fade-in 10f y fade-out 5f
- `volume` function solo para fades locales, no para gating de rango completo
- La función de volumen recibe el frame **relativo al Sequence** (no el frame absoluto)

---

## Validación

Antes de renderizar, verificar:
1. ✅ `direccion.json` tiene `durationInFrames` en todas las imágenes (ejecutar sync-durations si cambió audio o textInclude)
2. Cada capítulo tiene al menos 1 imagen
3. El guion.md tiene secciones `# c1` a `# c12`
4. INSTRUCCIONES.md tiene 12 títulos de capítulos
5. recursos/ tiene al menos 1 pista de música
6. Los nombres de imágenes son alfabéticamente estables
