import * as fs from "node:fs";
import * as path from "node:path";
import type { ContentValidatorResult } from "../types";

interface ValidateArgs {
  videoDir: string;
  chapters: { index: number; title: string }[];
}

const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
const VALID_AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg"];
const VALID_VIDEO_EXTS = [".mp4", ".mov", ".webm", ".avi"];

function listFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

function getExtension(file: string): string {
  return path.extname(file).toLowerCase();
}

export function validateContent(args: ValidateArgs): ContentValidatorResult {
  const { videoDir, chapters } = args;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(videoDir)) {
    return {
      valid: false,
      errors: [`El directorio no existe: ${videoDir}`],
      warnings: [],
    };
  }

  for (const chapter of chapters) {
    const chapterDir = path.join(
      videoDir,
      `capitulo-${String(chapter.index + 1).padStart(2, "0")}`
    );

    if (!fs.existsSync(chapterDir)) {
      errors.push(
        `Falta carpeta: capitulo-${String(chapter.index + 1).padStart(2, "0")} ("${chapter.title}")`
      );
      continue;
    }

    const files = listFiles(chapterDir);

    const audioFiles = files.filter((f) =>
      VALID_AUDIO_EXTS.includes(getExtension(f))
    );

    const imageFiles = files.filter((f) =>
      VALID_IMAGE_EXTS.includes(getExtension(f))
    );

    const videoFiles = files.filter((f) =>
      VALID_VIDEO_EXTS.includes(getExtension(f))
    );

    if (audioFiles.length === 0) {
      errors.push(
        `capitulo-${String(chapter.index + 1).padStart(2, "0")}: Falta narracion.mp3 (o audio .wav/.m4a/.ogg)`
      );
    } else if (audioFiles.length > 1) {
      errors.push(
        `capitulo-${String(chapter.index + 1).padStart(2, "0")}: Solo debe haber 1 audio, pero hay ${audioFiles.length}: ${audioFiles.join(", ")}`
      );
    }

    if (imageFiles.length === 0 && videoFiles.length === 0) {
      errors.push(
        `capitulo-${String(chapter.index + 1).padStart(2, "0")}: Falta al menos 1 imagen (.jpg/.png) o video (.mp4)`
      );
    }

    if (imageFiles.length === 0 && videoFiles.length > 0) {
      warnings.push(
        `capitulo-${String(chapter.index + 1).padStart(2, "0")}: Tiene video pero no imágenes. Se usará el video como visual.`
      );
    }
  }

  const recursosDir = path.join(videoDir, "recursos");
  if (fs.existsSync(recursosDir)) {
    const recursos = listFiles(recursosDir);
    if (recursos.length > 0) {
      warnings.push(`Recursos encontrados: ${recursos.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function detectChapters(videoDir: string): { index: number; title: string }[] {
  const chapters: { index: number; title: string }[] = [];
  const items = fs.readdirSync(videoDir);

  const chapterRegex = /^capitulo-(\d+)/i;

  for (const item of items) {
    const match = item.match(chapterRegex);
    if (match && fs.statSync(path.join(videoDir, item)).isDirectory()) {
      const index = parseInt(match[1], 10) - 1;
      chapters.push({ index, title: item });
    }
  }

  chapters.sort((a, b) => a.index - b.index);
  return chapters;
}

if (process.argv[1]?.endsWith("validate-content.ts")) {
  const args = process.argv.slice(2);
  const videoDir = args[0] || process.cwd();

  console.log(`\n🔍 Validando contenido en: ${videoDir}\n`);

  const chapters = detectChapters(videoDir);

  if (chapters.length === 0) {
    console.log("❌ No se encontraron carpetas de capítulos (capitulo-01, etc.)");
    process.exit(1);
  }

  const result = validateContent({ videoDir, chapters });

  if (result.errors.length > 0) {
    console.log("❌ ERRORES:");
    for (const err of result.errors) {
      console.log(`   ● ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  ADVERTENCIAS:");
    for (const warn of result.warnings) {
      console.log(`   ● ${warn}`);
    }
  }

  if (result.valid) {
    console.log(`\n✅ TODO LISTO! ${chapters.length} capítulo(s) validado(s) correctamente.`);
    console.log("   Puedes proceder a renderizar el video.\n");
  } else {
    console.log(`\n❌ El contenido NO está completo. Corrige los errores y vuelve a intentar.\n`);
    process.exit(1);
  }
}

export { detectChapters };
