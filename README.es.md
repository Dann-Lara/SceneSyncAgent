# Scene Sync Agent

Pipeline automatizado para crear videopresentaciones narradas con sincronización frame-exacta usando OpenAI Whisper y Remotion.

## Características

- **Sincronización con Whisper** — alinea la duración de cada imagen con la narración usando mapeo por posición de segmentos (sin text matching frágil)
- **Transiciones por sentimiento** — 10 tipos de sentimiento con selección ponderada de transiciones según el contexto narrativo
- **Efecto Ken Burns** — zoom por imagen vinculado a la intensidad del sentimiento y la escalada narrativa
- **Audio multi-pista** — narración por capítulos con música de fondo con crossfade
- **Pausa entre capítulos** — 2 segundos con overlay de título y fade-to-black
- **Render determinista** — todos los efectos visuales usan funciones seudoaleatorias con semilla para resultados reproducibles
- **Aceleración por GPU** — renderizado vía ANGLE/DirectX 11 (beneficioso en tarjetas NVIDIA)

## Requisitos

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/) (en PATH)
- [OpenAI Whisper](https://github.com/openai/whisper) (comando `whisper` en PATH)
- GPU con soporte DirectX 11 (recomendado para render más rápido)

## Instalación

```bash
git clone <repo-url>
cd <proyecto>
npm run setup
```

## Estructura del proyecto

```
content/{nombre-canal}/{slug-video}/
├── INSTRUCCIONES.md          # Metadatos del video y títulos de capítulos
├── guion.md                  # Guion completo de narración con secciones por capítulo
├── direccion.json            # Metadatos por imagen (sentimiento, transiciones, duración)
├── recursos/                 # Recursos globales (pistas musicales, intro/outro)
├── capitulo-01/
│   ├── narracion.mp3         # Audio de narración por capítulo
│   ├── img-01.jpg            # Imágenes (orden alfabético)
│   ├── img-02.jpg
│   └── ...
├── capitulo-02/
│   └── ...
└── ...
```

## Pipeline (3 pasos)

```bash
# 1. Sincronizar duraciones de imágenes con la narración usando Whisper
npx tsx src/scripts/sync-durations.ts content/{canal}/{video}

# 2. Construir escenas desde los datos de dirección
npm run build content/{canal}/{video}

# 3. Renderizar video final
npm run render content/{canal}/{video}
```

El paso 1 solo es necesario cuando cambia el audio o el contenido de texto.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run setup` | Instala todas las dependencias (npm + whisper) |
| `npm run build <dir>` | Construye escenas desde direction.json |
| `npm run render <dir>` | Renderiza video final con aceleración GPU |
| `npm run validate <dir>` | Valida estructura de contenido |
| `npm run studio` | Abre Remotion Studio para previsualización |
| `npm run typecheck` | Verifica tipos de TypeScript |
| `npm run create-structure` | Crea estructura de directorios para nuevo video |

## Configuración clave

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| FPS | 30 | Cuadros por segundo |
| INTRO_FRAMES | 240 (8s) | Duración de intro |
| OUTRO_FRAMES | 360 (12s) | Duración de outro |
| CHAPTER_PAUSE_FRAMES | 60 (2s) | Pausa entre capítulos |
| TRANSITION_FRAMES | 30 (1s) | Duración de transición |
| CROSSFADE_FRAMES | 90 (3s) | Duración de crossfade musical |
| MUSIC_VOLUME | 0.10 | Volumen de música de fondo |
| Modelo Whisper | `small` | Tamaño del modelo de transcripción |
| Idioma Whisper | `es` | Idioma (cambiar según proyecto) |

## Algoritmo de sincronización

El pipeline usa **mapeo por posición de segmentos** en lugar de text matching palabra por palabra:

1. Cuenta palabras esperadas por imagen desde `textInclude`
2. Cuenta palabras por segmento Whisper desde el texto del segmento
3. Mapea rangos de palabras de cada imagen a posiciones Whisper proporcionalmente
4. Interpola límites de segmentos para tiempos de inicio/fin por imagen
5. Escala la duración total para que coincida con `audioDuration × FPS`

Este enfoque es robusto ante errores de transcripción ASR (ej: "Thorne" vs "Zorn") porque solo usa conteo de palabras, no la identidad de las palabras.

Ver [`BLUEPRINT.md`](./BLUEPRINT.md) para las reglas de edición detalladas y referencia del algoritmo.

## Licencia

MIT
