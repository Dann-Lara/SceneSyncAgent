import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VideoDirections } from "../types";
import { cleanTextInclude } from "./build-scenes";

const execFileAsync = promisify(execFile);
const FPS = 30;

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface WhisperResult {
  segments: WhisperSegment[];
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

function segmentTiming(
  images: { textInclude?: string }[],
  segments: WhisperSegment[],
): number[] | null {
  if (!segments.length) return null;

  const imgWordCounts = images.map((img) =>
    cleanTextInclude(img.textInclude || "").split(/\s+/).filter((w) => w.length > 0).length
  );
  const totalExpWords = imgWordCounts.reduce((s, c) => s + c, 0);
  if (totalExpWords === 0) return null;

  const segCumulWords: number[] = [0];
  const segStartTimes: number[] = [];
  const segEndTimes: number[] = [];

  for (const seg of segments) {
    const wc = seg.text.split(/\s+/).filter((w) => w.length > 0).length;
    if (wc > 0) {
      segCumulWords.push(segCumulWords[segCumulWords.length - 1] + wc);
      segStartTimes.push(seg.start);
      segEndTimes.push(seg.end);
    }
  }

  const totalWhisperWords = segCumulWords[segCumulWords.length - 1];
  if (totalWhisperWords === 0) return null;

  const segCount = segStartTimes.length;

  function timeAtWordPos(pos: number): number {
    if (pos <= 0) return segStartTimes[0] ?? 0;
    if (pos >= totalWhisperWords) return segEndTimes[segCount - 1] ?? 0;
    for (let i = 0; i < segCount; i++) {
      if (pos >= segCumulWords[i] && pos < segCumulWords[i + 1]) {
        const frac = (pos - segCumulWords[i]) / (segCumulWords[i + 1] - segCumulWords[i]);
        return segStartTimes[i] + frac * (segEndTimes[i] - segStartTimes[i]);
      }
    }
    return segEndTimes[segCount - 1] ?? 0;
  }

  const durations = new Array(images.length).fill(0);
  let expWordStart = 0;

  for (let i = 0; i < images.length; i++) {
    const expWordEnd = expWordStart + imgWordCounts[i];

    const whisPosStart = (expWordStart / totalExpWords) * totalWhisperWords;
    const whisPosEnd = (expWordEnd / totalExpWords) * totalWhisperWords;

    const timeStart = timeAtWordPos(whisPosStart);
    const timeEnd = timeAtWordPos(whisPosEnd);

    durations[i] = Math.max(0, timeEnd - timeStart);
    expWordStart = expWordEnd;
  }

  return durations;
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

  for (let ci = 0; ci < directions.scenes.length; ci++) {
    const scene = directions.scenes[ci];
    const chapterLabel = `capitulo-${String(ci + 1).padStart(2, "0")}`;
    const chapterDir = path.join(videoDir, chapterLabel);

    let audioFiles: string[];
    try { audioFiles = fs.readdirSync(chapterDir).filter((f) => f.match(/\.(mp3|wav|m4a|ogg)$/i)); } catch {
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

    const chars = scene.images.map((img) => cleanTextInclude(img.textInclude || "").length);
    const totalChars = chars.reduce((s, c) => s + c, 0);

    if (totalChars === 0) {
      console.warn(`   Capítulo ${ci + 1}: sin textInclude, distribución equitativa`);
      const eq = Math.floor(totalFrames / scene.images.length);
      for (let i = 0; i < scene.images.length; i++) {
        scene.images[i].durationInFrames = i < scene.images.length - 1 ? eq : totalFrames - eq * (scene.images.length - 1);
      }
      console.log(`   Capítulo ${ci + 1}: [${scene.images.map((img) => img.durationInFrames).join(", ")}] = ${totalFrames} frames`);
      continue;
    }

    let frames: number[] | null = null;

    console.log(`   Capítulo ${ci + 1}: ejecutando whisper...`);
    const whisperResult = await runWhisper(audioPath);
    if (whisperResult) {
      const durations = segmentTiming(scene.images, whisperResult.segments);
      if (durations) {
        const whisperSum = durations.reduce((a, b) => a + b, 0);
        if (whisperSum > 0) {
          const scale = (totalFrames / FPS) / whisperSum;
          frames = durations.map((d) => Math.round(Math.max(d * scale * FPS, FPS)));
          let sum = frames.reduce((a, b) => a + b, 0);
          const diff = totalFrames - sum;
          if (frames.length > 0) frames[frames.length - 1] += diff;
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

    console.log(`   Capítulo ${ci + 1} (${audioDuration.toFixed(1)}s, ${totalChars} chars): [${frames.join(", ")}] = ${frames.reduce((a, b) => a + b, 0)} frames`);
  }

  fs.writeFileSync(directionsPath, JSON.stringify(directions, null, 2), "utf-8");
  console.log(`\nDirection.json actualizado: ${directionsPath}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
