# Reglas para Agentes — SceneSyncAgent

## Reglas generales

1. **NUNCA hardcodees datos de contenido en los scripts.** Los scripts deben ser genéricos y reutilizables. La letra de una canción, los textos de narración, los títulos, etc., van en archivos externos (`.txt`, `.md`, `config.json`), nunca inline en código TypeScript.

2. **Siempre prefiere crear herramientas genéricas.** Si necesitas transformar datos, crea un script que lea archivos de entrada y produzca archivos de salida, sin datos específicos de un proyecto.

3. **Usa los scripts existentes.** No crees nuevos scripts si ya existe uno que hace lo que necesitas. Verifica `src/scripts/` y `package.json` primero.

4. **Documenta los workflows en este archivo.** Si descubres un nuevo patrón, agrégalo aquí para que otros agentes no pierdan contexto.

---

## Los 3 tipos de video

| Tipo | Pipeline | Script de render | Scene builder | Composición Remotion |
|------|----------|-----------------|---------------|---------------------|
| Narrativo | Principal | `render-video.ts` | `build-scenes.ts` | `Root.tsx` → `Main` |
| Lista | Principal | `render-video.ts` | `build-scenes.ts` | `Root.tsx` → `Main` |
| Video musical | Música | `render-music-video.ts` | `build-music-video-scenes.ts` | `MusicRoot.tsx` → `MusicVideo` |

Narrativo y Lista comparten pipeline. La diferencia está en `config.json` → `videoType: "lista"` y cómo `Chapter.tsx` renderiza cada tipo.

---

## 1. Video Narrativo

### Estructura de carpetas
```
content/<canal>/YYYY-MM-DD_nombre-video/
├── config.json              # Estilo del canal (colores, fuentes, etc.)
├── direccion.json           # Dirección por imagen (timing, transiciones, sentimiento)
├── guion.md                 # Narración completa con estructura de capítulos
├── INSTRUCCIONES.md         # Títulos de capítulos y metadatos
├── capitulo-01/
│   ├── narracion.mp3        # Audio de narración del capítulo (TTS)
│   ├── img-01.jpg           # Imágenes para el slideshow
│   └── img-02.jpg
├── capitulo-02/
│   └── ...
└── recursos/
    └── *.mp3                # Pistas de música de fondo
```

### Flujo de creación
1. El usuario provee el tema y los textos
2. Generar `guion.md` con estructura `# c1`, `# c2`, etc. y `<break>` para pausas
3. Generar `INSTRUCCIONES.md` con títulos de capítulos
4. Generar `config.json` con los colores y estilo del canal
5. Crear imágenes por capítulo en `capitulo-NN/`
6. Generar `narracion.mp3` por capítulo (TTS)
7. Ejecutar `npx tsx src/scripts/sync-durations.ts <video-dir>` (sincroniza timings con Whisper)
8. Ejecutar `npx tsx src/scripts/render-video.ts <video-dir>` (construye escenas + renderiza)

### Reglas de estilo
- **Academia de Villanos:** Azul profundo (#1a3a5c), grises, tipografía Cinzel/Trajan Pro
- **Codex Mythologica:** Dorado (#c9a84c), teal (#1a8a7a), tipografía Cinzel/Trajan Pro
- No mostrar etiquetas de género — el tono se comunica visualmente (transiciones, paleta)

---

## 2. Video Lista

### Diferencias con Narrativo
- `config.json` debe incluir `"videoType": "lista"`
- La estructura de capítulos reserva el primero y último como Intro y Outro
- Los items de la lista ocupan los capítulos intermedios
- `Chapter.tsx` muestra tarjetas numeradas (01, 02, 03...) centradas
- La barra de progreso excluye los capítulos de borde: muestra `NN/(total-2)`

### Estructura de carpetas
Igual que Narrativo, pero con capítulos estructurados como:
```
capitulo-01/   → Intro
capitulo-02/   → Item 1
capitulo-03/   → Item 2
...
capitulo-N/    → Outro
```

### Flujo de creación
Idéntico al narrativo, pero asegurarse de:
1. `config.json` → `"videoType": "lista"`
2. `INSTRUCCIONES.md` indica explícitamente `**Tipo:** Lista (N items)`
3. El primer y último capítulo son intro/outro (sin título de ítem numerado)
4. `contentPalettes` en config.json para colores por protagonista (opcional)

---

## 3. Video Musical

### Estructura de carpetas
```
content/<canal>/YYYY-MM-DD_nombre-cancion/
├── config.json              # Estilo del canal
├── autoria/
│   ├── *.mp3                # Canción (MP3, 1 archivo)
│   ├── img/                 # Imágenes para el video (001.jpg, 002.jpg, ...)
│   ├── letra.txt            # Letra de la canción (1 línea = 1 entrada de letra)
│   └── *.json               # Output de Whisper (se genera automáticamente)
```

### Flujo de creación
1. El usuario provee: MP3 en `autoria/`, imágenes en `autoria/img/`, y la letra de la canción (en el mensaje)
2. Escribir la letra del usuario en `autoria/letra.txt` (1 línea por entrada de letra)
3. Ejecutar Whisper sobre el MP3 para obtener timestamps:
   ```bash
   whisper autoria/*.mp3 --model small --language es --output_format json --output_dir autoria/
   ```
   → Genera `autoria/[nombre].json`
4. Ejecutar el script genérico de mapeo:
   ```bash
   npx tsx src/scripts/generate-lyrics-srt.ts <video-dir>
   ```
   - Lee `autoria/*.json` (timestamps de Whisper)
   - Lee `autoria/letra.txt` (letra del usuario)
   - Filtra segmentos basura (suscríbete, música, silencio, etc.)
   - Mapea líneas de letra a segmentos Whisper:
     - Misma cantidad → 1:1 directo
     - Más líneas que segmentos → subdivide los segmentos más largos
     - Menos líneas → combina segmentos adyacentes
   - Genera `autoria/letra.srt`
5. Verificar que `letra.srt` se generó correctamente
6. Renderizar:
   ```bash
   npx tsx src/scripts/render-music-video.ts <video-dir> [output.mp4]
   ```

### Notas importantes
- **NUNCA hardcodees la letra en un script.** La letra viene del usuario y va en `autoria/letra.txt`.
- Whisper se usa SOLO para timestamps aproximados. El texto que se muestra es el que el usuario provee.
- El script `generate-lyrics-srt.ts` ya existe y es genérico. No necesitas crear otro.
- Si Whisper detecta segmentos basura ("suscríbete", "música", etc.), `generate-lyrics-srt.ts` los filtra automáticamente.
- Las imágenes van en `autoria/img/` numeradas (001.jpg, 002.jpg, ...). El orden alfabético determina el orden de aparición.
- La duración total del video = duración del MP3. Las imágenes se distribuyen uniformemente a lo largo de la canción, con transiciones sincronizadas por energía RMS.

---

## Comandos útiles

```bash
# Validar estructura del proyecto
npm run validate <video-dir>

# Sync Whisper (narrativo/lista)
npx tsx src/scripts/sync-durations.ts <video-dir>

# Render narrativo/lista
npm run render <video-dir>

# Render video musical
npx tsx src/scripts/render-music-video.ts <video-dir>

# Generar letra.srt desde Whisper + letra.txt (video musical)
npx tsx src/scripts/generate-lyrics-srt.ts <video-dir>

# TypeScript check
npm run typecheck
```
