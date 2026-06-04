# SceneSyncAgent — Cambios v2 (optimizado)

## Bugs críticos corregidos

### 1. Outro.tsx — Bug de doble frame source
- **Problema:** `Outro` recibía `currentFrame` como prop y también llamaba `useCurrentFrame()`. Usaba el prop externo, pero `TransitionSeries` remapea el frame interno, causando que todas las animaciones del Outro estuvieran desfasadas.
- **Fix:** Eliminado `currentFrame` de `OutroProps`. El componente usa exclusivamente `useCurrentFrame()` internamente.
- **Impacto:** Scan line, glow pulse, animaciones de entrada del Outro ahora sincronizan correctamente.

### 2. build-scenes.ts — Desface de timing en última escena  
- **Problema:** `CHAPTER_PAUSE_FRAMES` (60f = 2s) se sumaba a la duración de la **última imagen** de cada capítulo. Resultado: la última imagen se mostraba 2s después de que el audio terminaba.
- **Fix:** `CHAPTER_PAUSE_FRAMES` ahora se suma al `durationInFrames` total de la **escena**, no a la última imagen. Las imágenes individuales solo absorben el error de redondeo.
- **Impacto:** La última imagen de cada capítulo termina exactamente cuando termina el audio.

### 3. Main.tsx — Prop `currentFrame` en OutroPlayer
- Eliminado `currentFrame={frame}` del componente `<Outro>` en `OutroPlayer`.

## Mejoras de Intro

### AccessSequence — Secuencia de acceso terminal (nuevo)
- Primeros 25% del Intro: muestra secuencia de autenticación tipo terminal
- `INICIANDO PROTOCOLO`, `NIVEL: MÁXIMO CLASIFICADO`, `VERIFICANDO...`, `ACCESO CONCEDIDO`
- Crea narrativa de "archivo secreto siendo desbloqueado"

### HexDataStream — Matrix hexadecimal de fondo (implementado del blueprint)
- Grid de 32×52 caracteres hex con scroll vertical lento (`frame * 0.3`)
- Generación determinista (sin `Math.random()`): `HEX_CHARS[(r*7 + c*13 + 42) % 16]`
- Opacidad 0.04 para subtileza

### Backdrop del título (implementado del blueprint)
- El título ahora tiene fondo `rgba(0,0,0,0.55)` + `backdropFilter: blur(12px)`
- Garantiza legibilidad sobre cualquier imagen de fondo
- `textShadow` mejorado: `0 4px 40px + 0 0 80px primaryColor22`

### fontFamily consistente
- El título usa `channelStyle.fontFamily` en lugar de `'Limelight', serif` hardcodeado

## Mejoras de Outro

### Glitch de entrada (nuevo)
- Primeros 15 frames: translate X aleatorio ± 8px + saturación alterna
- Se estabiliza hacia frame 20
- Coherente con la identidad perturbadora del canal

### Indicador "CASO: ACTIVO" (nuevo)
- Esquina superior derecha: LED parpadeante + "CASO: [TÍTULO] — ACTIVO"
- Refuerza el cierre narrativo de "expediente abierto"

### Backdrop del texto principal
- El título "El expediente continúa." tiene fondo `rgba(0,0,0,0.5)` + blur

### HexDataStream en Outro
- Misma matrix hex que el Intro, pero con seed diferente (offset `frame * 0.25`)

### Sub-label del canal en botón de suscripción
- El botón SUSCRIBIRSE ahora muestra `channelStyle.channelName` como sub-label

### Card "Próximo análisis" mejorada
- Muestra "EN PRODUCCIÓN" cuando no hay video siguiente

### Fade-out final propio
- El Outro tiene su propio fade-out en los últimos 12% del progreso

## Overlays SVG mejorados

### mystery → NeuralPulse (reemplaza WhisperingEcho)
- 8 nodos posicionados determinísticamente
- Conexiones entre nodos cercanos (dist < 380px)
- Pulsos que viajan por las conexiones con velocidad variable
- Nodos que se "activan" periódicamente con ondas de expansión

### tension → TargetingReticle (mejorado)
- Jitter nervioso: `sin(frame*0.8)*2 + cos(frame*1.3)*1.5`
- Segundo reticle orbitante a 90px del principal
- Modo LOCK cada 90 frames con indicador de texto "LOCKED"

### dread → SlowGaze (mejorado)
- 3 ojos: uno principal (opacity 0.38) + 2 secundarios en esquinas
- Párpado superior que se cierra cada 180 frames
- Iris intermedio + pupila que dilata/contrae
- Movimiento de gaze más orgánico

### despair → FallingAshes (mejorado)
- Polígonos irregulares (3-5 vértices) en lugar de círculos
- Rotación individual mientras caen (`frame * rotSpeed`)
- 18 partículas (antes 12) con más variedad de tamaño y drift

### rage → FractureLightning (mejorado)
- Polylínea con zigzag determinista de 9 puntos (antes curva cuadrática suave)
- Ramificación lateral desde el punto medio de cada rayo
- Resplandor suave (strokeWidth=4, opacity=0.12) para profundidad
- Seed cambia cada 8 frames → rayo parece "moverse" orgánicamente
- Flash irregular basado en ciclo primo (% 100, visible < 14)

### calm → DataGrid (mejorado)
- Data burst ocasional: cada ~120 frames, 4 puntos brillan con onda expansiva
- Simula procesamiento de datos, coherente con el personaje Thorne

### triumph → AscendingPulse (mejorado)
- 3 pulsos en V (central + 2 laterales a ±120px con fase +20f y +40f)
- Líneas de explosión radiales al llegar al tope (4 líneas de 45°)
- Línea horizontal de barrido de izquierda a derecha en el momento del tope

## Correcciones de sentimiento (direccion.json)

### Capítulo 12 — Enfrentamiento final
- Antes: todas las 7 imágenes en `calm` (DataGrid)
- Ahora: `dread` → `drama` → `tension` → `drama` × 2 → `rage` → `resolution`

### Capítulo 6 — Behavioral Sink
- Antes: `calm` y `resolution`
- Ahora: `dread` → `mystery` → `despair` → `dread` × 2

### Capítulo 10 — El costo humano
- Antes: `calm` y `resolution`
- Ahora: `dread` → `mystery` → `despair` × 2 → `resolution`

### Capítulo 8 — Laboratorio del Dolor
- Imagen 4 (víctimas): `tension` → `terror`

## Mejoras de build-scenes.ts

### Seed de transición con chapterIndex
- Antes: `(imageIndex * 11 + totalImages * 3) % totalWeight`
- Ahora: `(chapterIndex * 97 + imageIndex * 11 + totalImages * 3) % totalWeight`
- Más variedad de transiciones entre capítulos con patrones de sentimiento similares
