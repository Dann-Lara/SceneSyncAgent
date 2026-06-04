import * as fs from "node:fs";
import * as path from "node:path";
import type { TransitionType, Sentiment, DirectionImage, DirectionChapter, VideoDirections } from "../types";

const ALL_16_TRANSITIONS: TransitionType[] = [
  "fade", "radial", "glitch", "flash", "zoom-blur", "shatter",
  "crossfade", "slide-left", "slide-right", "slide-up", "slide-down",
  "whip", "3d-flip", "zoom-in", "zoom-out", "pixelate",
];

const AVAILABLE_EFFECTS = {
  ParticleOverlay: "partículas flotando, fondo narrativo oscuro",
  LightLeak: "fugas de luz atmosféricas - usar en Intro/Outro",
  KineticText: "animaciones de texto: pop, slide-left, slide-up, scale, typewriter",
  PunchText: "texto impactante: shake, glitch",
  CrtChannelChange: "efecto cambio de canal CRT entre capítulos",
  ProgressBar: "barra de progreso narrativa",
  BreatherOverlay: "pausa reflexiva con respiro visual",
};

const TRANSITION_BY_CONTEXT: Record<string, { type: TransitionType; duration: number }[]> = {
  "introduccion-calma": [
    { type: "fade", duration: 1.0 },
    { type: "crossfade", duration: 1.2 },
    { type: "slide-right", duration: 1.0 },
    { type: "3d-flip", duration: 1.5 },
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
    { type: "3d-flip", duration: 0.9 },
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
    { type: "3d-flip", duration: 1.0 },
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
    { type: "3d-flip", duration: 1.6 },
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

function analyzeParagraphContext(
  text: string,
  prevText: string | null
): {
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

  const isShift = prevText && !text.includes(prevText.slice(0, 30));

  if (terrorScore >= 2) return { context: "terror-impacto", sentiment: "terror" };
  if (dreadScore >= 2) return { context: "pavor-inminente", sentiment: "dread" };
  if (rageScore >= 2) return { context: "ira-explosiva", sentiment: "rage" };
  if (dramaScore >= 2 && tensionScore >= 1) return { context: "climax-drama", sentiment: "drama" };
  if (dramaScore >= 2) return { context: "sostenido-drama", sentiment: "drama" };
  if (tensionScore >= 2) return { context: "tension-creciente", sentiment: "tension" };
  if (tensionScore >= 1 && isShift) return { context: "tension-creciente", sentiment: "tension" };
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

export function generateDirections(
  videoDir: string
): VideoDirections {
  const guionPath = path.join(videoDir, "guion.md");
  if (!fs.existsSync(guionPath)) {
    console.warn("⚠️  No guion.md found, skipping direction generation");
    return { scenes: [] };
  }

  const content = fs.readFileSync(guionPath, "utf-8");
  const sections = content.split(/^#\s+c(\d+)/m);

  const directions: VideoDirections = { scenes: [] };

  for (let i = 1; i < sections.length; i += 2) {
    const chapterIdx = parseInt(sections[i], 10) - 1;
    const body = sections[i + 1].trim();
    const rawParagraphs = body.split(/\n\n+/).filter((p) => p.trim().length > 0);

    // Collect clean paragraphs (strip tags and breaks for context analysis)
    // IMPORTANT: keep ALL entries, including standalone <break> paragraphs,
    // so textInclude preserves the complete raw text including breaks.
    const cleanParagraphs: { original: string; clean: string; breakTime: number }[] = [];
    for (const raw of rawParagraphs) {
      let text = raw.trim();
      const breakMatches = [...text.matchAll(/<break\s+time="([\d.]+)s"\s*\/>/g)];
      let totalBreak = 0;
      for (const bm of breakMatches) totalBreak += parseFloat(bm[1]);
      text = text.replace(/<break\s+time="[\d.]+s"\s*\/>/g, "").trim();
      text = text.replace(/\[.*?\]/g, "").trim();
      text = text.replace(/\s+/g, " ").trim();
      cleanParagraphs.push({ original: raw, clean: text, breakTime: totalBreak });
    }

    // Determine how many images exist for this chapter
    const chapterDir = path.join(
      videoDir,
      `capitulo-${String(chapterIdx + 1).padStart(2, "0")}`
    );
    const imageFiles: string[] = [];
    if (fs.existsSync(chapterDir)) {
      const files = fs.readdirSync(chapterDir).sort();
      const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
      for (const f of files) {
        if (VALID_IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
          imageFiles.push(f);
        }
      }
    }

    if (cleanParagraphs.length === 0 || imageFiles.length === 0) {
      console.warn(`   ⚠️  Chapter ${chapterIdx + 1}: no paragraphs or images`);
      directions.scenes.push({
        chapterIndex: chapterIdx,
        images: imageFiles.map((f, idx) => ({
          imageFile: f,
          textInclude: "",
          scriptParagraphs: [idx],
          transitionToNext: "fade",
          transitionDuration: 0.8,
          kenBurnsStart: 1.0,
          kenBurnsEnd: 1.08,
          sentiment: "calm",
          contextNote: "default",
        })),
      });
      continue;
    }

    // Smart grouping: detect topic shifts between paragraphs
    const groups: { paragraphIndices: number[]; context: keyof typeof TRANSITION_BY_CONTEXT; sentiment: Sentiment }[] = [];
    let currentGroup: number[] = [0];
    let prevContext = analyzeParagraphContext(cleanParagraphs[0].clean, null);

    for (let p = 1; p < cleanParagraphs.length; p++) {
      const curr = analyzeParagraphContext(cleanParagraphs[p].clean, cleanParagraphs[p - 1].clean);
      const isBreak = cleanParagraphs[p - 1].breakTime >= 2.0;
      const isBigShift = curr.context !== prevContext.context || isBreak;

      if (isBigShift && currentGroup.length > 0) {
        groups.push({
          paragraphIndices: [...currentGroup],
          context: prevContext.context,
          sentiment: prevContext.sentiment,
        });
        currentGroup = [p];
      } else {
        currentGroup.push(p);
      }
      prevContext = curr;
    }
    if (currentGroup.length > 0) {
      groups.push({
        paragraphIndices: [...currentGroup],
        context: prevContext.context,
        sentiment: prevContext.sentiment,
      });
    }

    // Distribute images to groups
    const chapterImages: DirectionImage[] = [];
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const imageIdx = Math.min(g, imageFiles.length - 1);
      const isLast = g === groups.length - 1;

      if (g >= imageFiles.length) {
        // More groups than images — merge into last image
        const lastImg = chapterImages[chapterImages.length - 1];
        if (lastImg) {
          lastImg.scriptParagraphs.push(...group.paragraphIndices);
        }
        continue;
      }

      const options = TRANSITION_BY_CONTEXT[group.context] || TRANSITION_BY_CONTEXT["introduccion-calma"];
      const transition = pickTransition(options, g + chapterIdx * 7);
      const kenBurns = kenBurnsForContext(group.context);

      const rawText = group.paragraphIndices
        .map((pi) => cleanParagraphs[pi].original)
        .join("\n\n");
      chapterImages.push({
        imageFile: imageFiles[imageIdx],
        textInclude: rawText,
        scriptParagraphs: group.paragraphIndices,
        transitionToNext: isLast ? "fade" : transition.type,
        transitionDuration: isLast ? 1.0 : transition.duration,
        kenBurnsStart: kenBurns.start,
        kenBurnsEnd: kenBurns.end,
        sentiment: group.sentiment,
        contextNote: group.context,
      });
    }

    // Handle remaining images (more images than groups)
    for (let g = groups.length; g < imageFiles.length; g++) {
      const lastIdx = cleanParagraphs.length - 1;
      chapterImages.push({
        imageFile: imageFiles[g],
        textInclude: lastIdx >= 0 ? cleanParagraphs[lastIdx].original : "",
        scriptParagraphs: [lastIdx >= 0 ? lastIdx : 0],
        transitionToNext: g < imageFiles.length - 1 ? "fade" : "fade",
        transitionDuration: 0.8,
        kenBurnsStart: 1.0,
        kenBurnsEnd: 1.08,
        sentiment: "calm",
        contextNote: "extra image, merged with last group",
      });
    }

    directions.scenes.push({
      chapterIndex: chapterIdx,
      images: chapterImages,
    });
  }

  return directions;
}

// CLI usage
if (process.argv[1]?.endsWith("generate-directions.ts")) {
  const videoDir = process.argv[2];
  if (!videoDir) {
    console.error("❌ Uso: npx tsx src/scripts/generate-directions.ts <directorio-del-video>");
    process.exit(1);
  }

  const directions = generateDirections(videoDir);
  const outputPath = path.join(videoDir, "direccion.json");
  fs.writeFileSync(outputPath, JSON.stringify(directions, null, 2), "utf-8");
  console.log(`✅ Direcciones guardadas en: ${outputPath}`);

  const totalImages = directions.scenes.reduce((s, sc) => s + sc.images.length, 0);
  console.log(`   ${directions.scenes.length} capítulos, ${totalImages} imágenes asignadas por contexto`);
}
