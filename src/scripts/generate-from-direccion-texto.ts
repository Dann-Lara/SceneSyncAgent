import * as fs from "node:fs";
import * as path from "node:path";
import type { TransitionType, Sentiment, DirectionImage, DirectionChapter, VideoDirections } from "../types";

const FPS = 30;

const ALL_16_TRANSITIONS: TransitionType[] = [
  "fade", "radial", "glitch", "flash", "zoom-blur", "shatter",
  "crossfade", "slide-left", "slide-right", "slide-up", "slide-down",
  "whip", "zoom-in", "zoom-out", "pixelate",
];

const TRANSITION_BY_CONTEXT: Record<string, { type: TransitionType; duration: number }[]> = {
  "introduccion-calma": [
    { type: "fade", duration: 1.0 },
    { type: "crossfade", duration: 1.2 },
    { type: "slide-right", duration: 1.0 },
    { type: "zoom-out", duration: 1.2 },
  ],
  "misterio-intriga": [
    { type: "fade", duration: 1.1 },
    { type: "radial", duration: 0.9 },
    { type: "zoom-blur", duration: 0.8 },
    { type: "slide-up", duration: 0.9 },
    { type: "slide-right", duration: 1.0 },
  ],
  "tension-creciente": [
    { type: "radial", duration: 0.7 },
    { type: "zoom-blur", duration: 0.6 },
    { type: "slide-left", duration: 0.7 },
    { type: "slide-up", duration: 0.8 },
    { type: "zoom-in", duration: 0.7 },
  ],
  "climax-drama": [
    { type: "glitch", duration: 0.35 },
    { type: "flash", duration: 0.3 },
    { type: "shatter", duration: 0.25 },
    { type: "whip", duration: 0.3 },
    { type: "pixelate", duration: 0.4 },
    { type: "radial", duration: 0.5 },
  ],
  "terror-impacto": [
    { type: "shatter", duration: 0.25 },
    { type: "glitch", duration: 0.3 },
    { type: "pixelate", duration: 0.5 },
    { type: "flash", duration: 0.2 },
    { type: "whip", duration: 0.25 },
    { type: "zoom-blur", duration: 0.4 },
  ],
  "pavor-inminente": [
    { type: "pixelate", duration: 0.5 },
    { type: "zoom-blur", duration: 0.5 },
    { type: "glitch", duration: 0.4 },
    { type: "radial", duration: 0.6 },
    { type: "fade", duration: 0.9 },
  ],
  "ira-explosiva": [
    { type: "shatter", duration: 0.2 },
    { type: "glitch", duration: 0.3 },
    { type: "whip", duration: 0.25 },
    { type: "flash", duration: 0.3 },
    { type: "zoom-in", duration: 0.45 },
  ],
  "desesperacion": [
    { type: "fade", duration: 1.3 },
    { type: "crossfade", duration: 1.2 },
    { type: "slide-down", duration: 1.0 },
    { type: "zoom-out", duration: 1.1 },
  ],
  "triunfo-poder": [
    { type: "zoom-in", duration: 0.7 },
    { type: "slide-down", duration: 0.8 },
    { type: "radial", duration: 0.7 },
    { type: "crossfade", duration: 1.1 },
  ],
  "resolucion": [
    { type: "crossfade", duration: 1.5 },
    { type: "fade", duration: 1.2 },
    { type: "slide-down", duration: 0.9 },
    { type: "zoom-out", duration: 1.3 },
  ],
  "sostenido-tension": [
    { type: "radial", duration: 0.8 },
    { type: "zoom-blur", duration: 0.7 },
    { type: "fade", duration: 0.9 },
    { type: "slide-left", duration: 0.8 },
    { type: "slide-right", duration: 0.9 },
    { type: "zoom-in", duration: 0.8 },
  ],
  "sostenido-drama": [
    { type: "glitch", duration: 0.5 },
    { type: "flash", duration: 0.4 },
    { type: "fade", duration: 0.8 },
    { type: "zoom-in", duration: 0.6 },
    { type: "radial", duration: 0.6 },
    { type: "whip", duration: 0.4 },
    { type: "pixelate", duration: 0.5 },
  ],
};

function analyzeParagraphContext(text: string): {
  context: keyof typeof TRANSITION_BY_CONTEXT;
  sentiment: Sentiment;
} {
  const lower = text.toLowerCase();

  const terrorWords = ["muerte", "sangre", "grita", "horror", "implacable", "aterrador", "panico", "obsceno", "asesinato", "cruel", "brutal", "indefenso", "pesadilla", "sufrimiento", "dolor latente", "empalacion"];
  const dramaWords = ["traicion", "perdida", "dolor", "sacrificio", "colapso", "arder", "destruccion", "lagrimas", "roto", "abandonado", "culpa", "tragedia"];
  const tensionWords = ["de repente", "silenciosamente", "sombra", "acecho", "presencia", "algo", "movimiento", "inquietante", "latencia", "error", "anomalia", "observaba", "detecto"];
  const resolutionWords = ["renacer", "nueva", "final", "descansa", "aprendio", "desperto", "amanecer", "esperanza", "paz", "comprender", "aceptar", "regreso"];
  const mysteryWords = ["enigma", "incognita", "secreto", "oculto", "misterio", "desconocido", "extrano", "inexplicable", "ambiguo", "velado", "cifrado", "intriga", "sospecha", "trasfondo", "profecia"];
  const rageWords = ["ira", "furia", "odio", "venganza", "destruir", "aniquilar", "exterminio", "violencia", "salvaje", "implacable", "resentimiento", "furioso", "arrasar"];
  const despairWords = ["desesperacion", "vacio", "sin sentido", "rendirse", "abismo", "oscuridad total", "sin esperanza", "devastado", "perdido", "anulado", "nihilismo", "absurdo", "consumido"];
  const triumphWords = ["triunfo", "victoria", "poder absoluto", "dominacion", "conquista", "superioridad", "control total", "imparable", "supremacia", "exitoso", "logro", "derroto", "vencio"];
  const dreadWords = ["pavor", "anticipacion", "inminente", "inevitable", "condenado", "fatalidad", "presagio", "amenaza latente", "opresivo", "asfixiante", "saber que", "pronto", "llegara"];

  const terrorScore = terrorWords.filter(w => lower.includes(w)).length;
  const dramaScore = dramaWords.filter(w => lower.includes(w)).length;
  const tensionScore = tensionWords.filter(w => lower.includes(w)).length;
  const resolutionScore = resolutionWords.filter(w => lower.includes(w)).length;
  const mysteryScore = mysteryWords.filter(w => lower.includes(w)).length;
  const rageScore = rageWords.filter(w => lower.includes(w)).length;
  const despairScore = despairWords.filter(w => lower.includes(w)).length;
  const triumphScore = triumphWords.filter(w => lower.includes(w)).length;
  const dreadScore = dreadWords.filter(w => lower.includes(w)).length;

  if (terrorScore >= 2) return { context: "terror-impacto", sentiment: "terror" };
  if (dreadScore >= 2) return { context: "pavor-inminente", sentiment: "dread" };
  if (rageScore >= 2) return { context: "ira-explosiva", sentiment: "rage" };
  if (dramaScore >= 2 && tensionScore >= 1) return { context: "climax-drama", sentiment: "drama" };
  if (dramaScore >= 2) return { context: "sostenido-drama", sentiment: "drama" };
  if (tensionScore >= 2) return { context: "tension-creciente", sentiment: "tension" };
  if (despairScore >= 1) return { context: "desesperacion", sentiment: "despair" };
  if (mysteryScore >= 1) return { context: "misterio-intriga", sentiment: "mystery" };
  if (triumphScore >= 1) return { context: "triunfo-poder", sentiment: "triumph" };
  if (resolutionScore >= 1) return { context: "resolucion", sentiment: "resolution" };
  if (dramaScore >= 1) return { context: "sostenido-drama", sentiment: "drama" };

  return { context: "introduccion-calma", sentiment: "calm" };
}

function pickTransition(
  options: { type: TransitionType; duration: number }[],
  seed: number
): { type: TransitionType; duration: number } {
  return options[seed % options.length];
}

function kenBurnsForContext(
  context: keyof typeof TRANSITION_BY_CONTEXT
): { start: number; end: number } {
  switch (context) {
    case "terror-impacto":
    case "ira-explosiva":
      return { start: 1.08, end: 1.22 };
    case "climax-drama":
    case "triunfo-poder":
      return { start: 1.06, end: 1.18 };
    case "tension-creciente":
    case "pavor-inminente":
    case "sostenido-drama":
      return { start: 1.04, end: 1.15 };
    case "misterio-intriga":
      return { start: 1.02, end: 1.1 };
    case "desesperacion":
      return { start: 1.03, end: 1.12 };
    case "resolucion":
      return { start: 1.1, end: 1.0 };
    default:
      return { start: 1.0, end: 1.06 };
  }
}

interface DireccionTextImage {
  imageFile: string;
  frames: number;
  text: string;
}

interface DireccionTextChapter {
  chapterIndex: number;
  images: DireccionTextImage[];
}

function parseDireccionTexto(content: string): DireccionTextChapter[] {
  const chapters: DireccionTextChapter[] = [];

  const chapterBlocks = content.split(/^=== /m).filter(Boolean);

  for (const block of chapterBlocks) {
    const headerMatch = block.match(/^capitulo-\d+ \(chapterIndex (\d+)\) ===/);
    if (!headerMatch) continue;
    const chapterIndex = parseInt(headerMatch[1], 10);

    const images: DireccionTextImage[] = [];

    const lines = block.split(/\r?\n/);
    let currentImage: Partial<DireccionTextImage> | null = null;
    let inText = false;
    let textBuffer: string[] = [];

    for (const line of lines) {
      const imgHeaderMatch = line.match(/^\s*---\s+([\w.-]+)\s+\((\d+)f\s*=\s*[\d.]+s\)\s*---/);
      if (imgHeaderMatch) {
        if (currentImage && textBuffer.length > 0) {
          currentImage.text = textBuffer.join("\n").replace(/^'|'$/g, "").trim();
          if (currentImage.imageFile && currentImage.frames && currentImage.text) {
            images.push({
              imageFile: currentImage.imageFile,
              frames: currentImage.frames,
              text: currentImage.text,
            });
          }
        }
        currentImage = {
          imageFile: imgHeaderMatch[1],
          frames: parseInt(imgHeaderMatch[2], 10),
        };
        textBuffer = [];
        inText = false;
        continue;
      }

      if (currentImage) {
        const textLine = line.trim();
        if (textLine.startsWith("'") || inText) {
          inText = true;
          textBuffer.push(line);
          if (textLine.endsWith("'")) {
            currentImage.text = textBuffer.join("\n").replace(/^'|'$/g, "").trim();
            if (currentImage.imageFile && currentImage.frames && currentImage.text) {
              images.push({
                imageFile: currentImage.imageFile,
                frames: currentImage.frames,
                text: currentImage.text,
              });
            }
            currentImage = null;
            textBuffer = [];
            inText = false;
          }
        }
      }
    }

    // Flush remaining
    if (currentImage && textBuffer.length > 0) {
      currentImage.text = textBuffer.join("\n").replace(/^'|'$/g, "").trim();
      if (currentImage.imageFile && currentImage.frames && currentImage.text) {
        images.push({
          imageFile: currentImage.imageFile,
          frames: currentImage.frames,
          text: currentImage.text,
        });
      }
    }

    if (images.length > 0) {
      chapters.push({ chapterIndex, images });
    }
  }

  return chapters;
}

function generateFromDireccionTexto(videoDir: string): VideoDirections {
  const textoPath = path.join(videoDir, "direccion-texto.txt");
  if (!fs.existsSync(textoPath)) {
    console.error("❌ direccion-texto.txt not found in", videoDir);
    return { scenes: [] };
  }

  const content = fs.readFileSync(textoPath, "utf-8");
  const parsed = parseDireccionTexto(content);

  const directions: VideoDirections = { scenes: [] };

  for (const ch of parsed) {
    const chapterImages: DirectionImage[] = [];

    for (let i = 0; i < ch.images.length; i++) {
      const img = ch.images[i];
      const isLast = i === ch.images.length - 1;

      const { context, sentiment } = analyzeParagraphContext(img.text);
      const options = TRANSITION_BY_CONTEXT[context] || TRANSITION_BY_CONTEXT["introduccion-calma"];
      const transition = pickTransition(options, i + ch.chapterIndex * 7);
      const kenBurns = kenBurnsForContext(context);

      chapterImages.push({
        imageFile: img.imageFile,
        textInclude: img.text,
        scriptParagraphs: [i],
        transitionToNext: isLast ? "fade" : transition.type,
        transitionDuration: isLast ? 1.0 : transition.duration,
        kenBurnsStart: kenBurns.start,
        kenBurnsEnd: kenBurns.end,
        sentiment,
        contextNote: context,
        durationInFrames: img.frames,
      });
    }

    directions.scenes.push({
      chapterIndex: ch.chapterIndex,
      images: chapterImages,
    });
  }

  return directions;
}

// CLI usage
if (process.argv[1]?.endsWith("generate-from-direccion-texto.ts")) {
  const videoDir = process.argv[2];
  if (!videoDir) {
    console.error("❌ Uso: npx tsx src/scripts/generate-from-direccion-texto.ts <directorio-del-video>");
    process.exit(1);
  }

  const directions = generateFromDireccionTexto(videoDir);
  const outputPath = path.join(videoDir, "direccion.json");
  fs.writeFileSync(outputPath, JSON.stringify(directions, null, 2), "utf-8");
  console.log(`✅ direccion.json generado desde direccion-texto.txt: ${outputPath}`);

  const totalImages = directions.scenes.reduce((s, sc) => s + sc.images.length, 0);
  const totalFrames = directions.scenes.reduce((s, sc) => s + sc.images.reduce((si, img) => si + (img.durationInFrames || 0), 0), 0);
  console.log(`   ${directions.scenes.length} capítulos, ${totalImages} imágenes, ${totalFrames} frames totales`);
}
