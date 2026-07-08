import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VideoDirections } from "../types";
import { cleanTextInclude, assignWordsToImages } from "./build-scenes";
import type { WhisperWord } from "./build-scenes";

const execFileAsync = promisify(execFile);
const FPS = 30;

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
  language: string;
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      audioPath,
    ]);
    return parseFloat(stdout.trim()) || 10;
  } catch {
    return 10;
  }
}

async function runWhisper(audioPath: string): Promise<WhisperResult | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"));
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const outPath = path.join(tmpDir, `${baseName}.json`);
  try {
    await execFileAsync("whisper", [
      audioPath,
      "--model", "small",
      "--language", "es",
      "--word_timestamps", "True",
      "--output_format", "json",
      "--output_dir", tmpDir,
    ]);
    const raw = fs.readFileSync(outPath, "utf-8");
    return JSON.parse(raw) as WhisperResult;
  } catch {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  }
}

async function detectSilences(audioPath: string): Promise<{start: number; end: number; duration: number}[]> {
  try {
    const { stderr } = await execFileAsync("ffmpeg", [
      "-i", audioPath,
      "-af", "silencedetect=noise=-35dB:d=0.4",
      "-f", "null",
      "-",
    ]);
    const lines = stderr.split("\n");
    const silences: {start: number; end: number; duration: number}[] = [];
    let currentStart = 0;
    for (const line of lines) {
      const startMatch = line.match(/silence_start:\s+([\d.]+)/);
      const endMatch = line.match(/silence_end:\s+([\d.]+)/);
      if (startMatch) currentStart = parseFloat(startMatch[1]);
      if (endMatch) {
        const end = parseFloat(endMatch[1]);
        silences.push({ start: currentStart, end, duration: end - currentStart });
      }
    }
    return silences.filter((s) => s.duration >= 0.3);
  } catch {
    return [];
  }
}

function parseDireccionTextoTxt(filePath: string): Map<number, Map<string, string>> {
  const content = fs.readFileSync(filePath, "utf-8");
  const chapters = content.split(/^=== /m).filter(Boolean);
  const result = new Map<number, Map<string, string>>();

  for (const ch of chapters) {
    const header = ch.match(/^capitulo-\d+ \(chapterIndex (\d+)\) ===/);
    if (!header) continue;
    const chIdx = parseInt(header[1]);
    const images = new Map<string, string>();
    const imgBlocks = ch.split(/^  --- /m).filter(Boolean);

    for (const block of imgBlocks) {
      const imgMatch = block.match(/^(\d+\.png) \(\d+f = [\d.]+s\) ---/);
      if (!imgMatch) continue;
      const imgFile = imgMatch[1];
      const textMatch = block.match(/'([\s\S]*?)'/);
      if (!textMatch) continue;
      const text = textMatch[1].replace(/\s*\n\s*/g, " ").trim();
      images.set(imgFile, text);
    }
    result.set(chIdx, images);
  }
  return result;
}

async function main() {
  const videoDir = process.argv[2];
  if (!videoDir) {
    console.error("Uso: npx tsx src/scripts/sync-durations.ts <directorio-del-video>");
    process.exit(1);
  }

  const directionsPath = path.join(videoDir, "direccion.json");
  if (!fs.existsSync(directionsPath)) {
    console.error("No se encuentra direccion.json en", videoDir);
    process.exit(1);
  }

  const directions: VideoDirections = JSON.parse(fs.readFileSync(directionsPath, "utf-8"));

  // ─── Step 1: Update textInclude from direccion-texto.txt if it exists ──────
  const textoPath = path.join(videoDir, "direccion-texto.txt");
  if (fs.existsSync(textoPath)) {
    console.log("direccion-texto.txt encontrado — actualizando textInclude...");
    const textMap = parseDireccionTextoTxt(textoPath);
    let updatedCount = 0;
    for (const scene of directions.scenes) {
      const imgTexts = textMap.get(scene.chapterIndex);
      if (!imgTexts) continue;
      for (const img of scene.images) {
        const txt = imgTexts.get(img.imageFile);
        if (txt && img.textInclude !== txt) {
          img.textInclude = txt;
          updatedCount++;
        }
      }
    }
    console.log(`  ${updatedCount} textInclude actualizados`);
  } else {
    console.log("direccion-texto.txt no encontrado — textInclude no modificado");
  }

  // ─── Step 2: Sync durations via Whisper + DP ─────────────────────────────
  const onlyChapter = process.argv.includes("--cap")
    ? parseInt(process.argv[process.argv.indexOf("--cap") + 1]) - 1
    : -1;
  for (let ci = 0; ci < directions.scenes.length; ci++) {
    if (onlyChapter >= 0 && ci !== onlyChapter) continue;
    const scene = directions.scenes[ci];
    const chapterLabel = `capitulo-${String(ci + 1).padStart(2, "0")}`;
    const chapterDir = path.join(videoDir, chapterLabel);

    let audioFiles: string[];
    try {
      audioFiles = fs
        .readdirSync(chapterDir)
        .filter((f) => f.match(/\.(mp3|wav|m4a|ogg)$/i));
    } catch {
      console.warn(`   Capítulo ${ci + 1}: sin directorio de audio`);
      continue;
    }
    if (audioFiles.length === 0) {
      console.warn(`   Capítulo ${ci + 1}: sin archivo de audio`);
      continue;
    }

    const audioFile = audioFiles[0];
    const audioPath = path.join(chapterDir, audioFile);
    const audioDuration = await getAudioDuration(audioPath);
    const totalFrames = Math.round(audioDuration * FPS);

    const chars = scene.images.map((img) =>
      cleanTextInclude(img.textInclude || "").length
    );
    const totalChars = chars.reduce((s, c) => s + c, 0);

    if (totalChars === 0) {
      console.warn(`   Capítulo ${ci + 1}: sin textInclude, distribución equitativa`);
      const eq = Math.floor(totalFrames / scene.images.length);
      for (let i = 0; i < scene.images.length; i++) {
        scene.images[i].durationInFrames =
          i < scene.images.length - 1
            ? eq
            : totalFrames - eq * (scene.images.length - 1);
      }
      console.log(
        `   Capítulo ${ci + 1}: [${scene.images.map((img) => img.durationInFrames).join(", ")}] = ${totalFrames} frames`
      );
      continue;
    }

    let frames: number[] | null = null;

    console.log(`   Capítulo ${ci + 1}: ejecutando whisper...`);
    const whisperResult = await runWhisper(audioPath);
    if (whisperResult) {
      const allWords = whisperResult.segments.flatMap((s) => s.words || []);
      if (allWords.length > 5) {
        const texts = scene.images.map((img) =>
          cleanTextInclude(img.textInclude || "")
        );
        const alignment = assignWordsToImages(texts, allWords);
        const { wordCounts, imageStart } = alignment;

        if (wordCounts.some((c) => c === 0)) {
          console.log(
            `   Capítulo ${ci + 1}: algunas imágenes sin palabras asignadas, fallback a proporción`
          );
        } else {
          const floatFrames: number[] = [];
          for (let i = 0; i < wordCounts.length; i++) {
            const wStartSec = i === 0 ? 0 : (imageStart[i] ?? 0);
            const wEndSec =
              i === wordCounts.length - 1
                ? audioDuration
                : (imageStart[i + 1] ?? audioDuration);
            const durSec = Math.max(wEndSec - wStartSec, 1 / FPS);
            floatFrames.push(durSec * FPS);
          }

          // Largest remainder method: preserve totalFrames exactly
          const intFrames = floatFrames.map((f) => Math.floor(f));
          let diff =
            totalFrames - intFrames.reduce((a, b) => a + b, 0);
          const fracSorted = floatFrames
            .map((f, idx) => ({ idx, frac: f - Math.floor(f) }))
            .sort((a, b) => b.frac - a.frac);
          for (let k = 0; k < diff && k < fracSorted.length; k++) {
            intFrames[fracSorted[k].idx]++;
          }

          frames = intFrames;
        }
      }
    }

    if (!frames) {
      console.log(`   Capítulo ${ci + 1}: fallback a proporción de caracteres`);
      frames = [];
      let sumFrames = 0;
      for (let i = 0; i < scene.images.length; i++) {
        const raw = Math.round((chars[i] / totalChars) * totalFrames);
        frames.push(raw);
        sumFrames += raw;
      }
      const diff = totalFrames - sumFrames;
      if (frames.length > 0) frames[frames.length - 1] += diff;
    }

    for (let i = 0; i < scene.images.length; i++) {
      scene.images[i].durationInFrames = Math.max(frames[i], Math.round(FPS * 1));
    }

    const rawSilences = await detectSilences(audioPath);
    const silenceRegions = rawSilences
      .filter((s) => s.duration >= 0.5)
      .map((s) => ({
        startFrame: Math.round(s.start * FPS),
        endFrame: Math.round(s.end * FPS),
        durationInFrames: Math.round(s.duration * FPS),
      }));
    scene.silences = silenceRegions;

    console.log(
      `   Capítulo ${ci + 1} (${audioDuration.toFixed(1)}s, ${totalChars} chars): [${frames.join(", ")}] = ${frames.reduce((a, b) => a + b, 0)} frames, ${silenceRegions.length} silencios`
    );
  }

  fs.writeFileSync(directionsPath, JSON.stringify(directions, null, 2), "utf-8");
  console.log(`\n✓ direccion.json actualizado: ${directionsPath}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
