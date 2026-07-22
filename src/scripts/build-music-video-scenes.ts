import * as fs from "node:fs";
import * as path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { Scene, ImageMeta, ChannelStyle, TransitionType, Sentiment, SubtitleLine } from "../types";

const execFileAsync = promisify(execFile);

const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const FPS = 30;
const INTRO_FRAMES = 150;
const OUTRO_FRAMES = 120;

const RMS_TRANSITIONS: { maxRMS: number; types: TransitionType[] }[] = [
  { maxRMS: 0.06, types: ["fade", "crossfade", "slide-up", "slide-down"] },
  { maxRMS: 0.15, types: ["zoom-out", "radial", "slide-left", "slide-right", "pixelate", "zoom-in"] },
  { maxRMS: Infinity, types: ["whip", "flash", "glitch", "shatter"] },
];

interface BuildResult {
  scenes: Scene[];
  totalFrames: number;
  songPath: string;
  channelStyle: ChannelStyle;
  introDuration: number;
  outroDuration: number;
  subtitles: SubtitleLine[];
  authorName: string;
}

async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    audioPath,
  ]);
  return parseFloat(stdout.trim()) || 10;
}

function getAudioRMS(audioPath: string, totalFrames: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const sampleRate = 48000;
    const samplesPerFrame = Math.round(sampleRate / FPS);

    const proc = spawn("ffmpeg", [
      "-i", audioPath,
      "-ac", "1",
      "-ar", String(sampleRate),
      "-f", "f32le",
      "-",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    const chunks: Buffer[] = [];
    let errorOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.warn(`   ⚠️ ffmpeg exited with code ${code}, usando RMS plano`);
        resolve(new Array(totalFrames).fill(0.05));
        return;
      }
      try {
        const full = Buffer.concat(chunks);
        const totalSamples = Math.floor(full.length / 4);
        const rms: number[] = [];
        let offset = 0;
        while (offset < totalSamples) {
          let sumSq = 0;
          const count = Math.min(samplesPerFrame, totalSamples - offset);
          for (let j = 0; j < count; j++) {
            const s = full.readFloatLE((offset + j) * 4);
            sumSq += s * s;
          }
          rms.push(Math.sqrt(sumSq / count));
          offset += samplesPerFrame;
        }
        while (rms.length < totalFrames) rms.push(0.01);
        resolve(rms.slice(0, totalFrames));
      } catch (e) {
        console.warn(`   ⚠️ Error procesando audio, usando RMS plano`);
        resolve(new Array(totalFrames).fill(0.05));
      }
    });

    proc.on("error", (err) => {
      console.warn(`   ⚠️ Error al iniciar ffmpeg: ${err.message}, usando RMS plano`);
      resolve(new Array(totalFrames).fill(0.05));
    });
  });
}

function pickTransition(rms: number): TransitionType {
  const bucket = RMS_TRANSITIONS.find((b) => rms <= b.maxRMS) || RMS_TRANSITIONS[RMS_TRANSITIONS.length - 1];
  return bucket.types[Math.floor(Math.random() * bucket.types.length)];
}

export async function buildMusicVideoScenes(videoDir: string): Promise<BuildResult> {
  const configPath = path.join(videoDir, "config.json");
  if (!fs.existsSync(configPath)) throw new Error(`config.json not found in ${videoDir}`);
  const channelStyle: ChannelStyle = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const autoriaDir = path.join(videoDir, "autoria");
  if (!fs.existsSync(autoriaDir)) throw new Error(`autoria/ directory not found in ${videoDir}`);

  const songFiles = fs.readdirSync(autoriaDir).filter((f) => f.toLowerCase().endsWith(".mp3"));
  if (songFiles.length === 0) throw new Error(`No MP3 files found in autoria/`);
  const songFile = songFiles[0];
  const songPath = path.join("autoria", songFile);
  const songFsPath = path.join(autoriaDir, songFile);
  const songDurationSec = await getAudioDuration(songFsPath);

  // Extract author from MP3 metadata
  let authorName = "";
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format_tags=artist",
      "-of", "default=noprint_wrappers=1:nokey=1",
      songFsPath,
    ]);
    authorName = stdout.trim();
  } catch {
    // fallback: use channelName
    authorName = channelStyle.channelName;
  }
  if (!authorName) authorName = channelStyle.channelName;
  const totalFrames = Math.round(songDurationSec * FPS);
  const availableFrames = totalFrames - INTRO_FRAMES - OUTRO_FRAMES;

  // ─── Images: prefer autoria/img/, fall back to chapter dirs ────────────────
  const imgDir = path.join(autoriaDir, "img");
  const useCustomImages = fs.existsSync(imgDir);
  let allImages: { filePath: string; fileName: string }[] = [];

  if (useCustomImages) {
    const files = fs.readdirSync(imgDir).sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? "9999", 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? "9999", 10);
      return numA - numB;
    });
    for (const f of files) {
      if (VALID_IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
        allImages.push({ filePath: path.join("autoria", "img", f), fileName: f });
      }
    }
    if (allImages.length > 0) {
      console.log(`   🖼️ Usando ${allImages.length} imágenes de autoria/img/`);
    }
  }

  // Fallback: chapter-based images
  if (allImages.length === 0) {
    console.log("   📁 Usando imágenes de capítulos narrativos");
    const maxChapter = channelStyle.musicVideoMaxChapter ?? Infinity;
    for (let i = 0; i < maxChapter; i++) {
      const chLabel = `capitulo-${String(i + 1).padStart(2, "0")}`;
      const chDir = path.join(videoDir, chLabel);
      if (!fs.existsSync(chDir)) break;
      const files = fs.readdirSync(chDir).sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? "9999", 10);
        const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? "9999", 10);
        return numA - numB;
      });
      for (const f of files) {
        if (VALID_IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
          allImages.push({ filePath: path.join(chLabel, f), fileName: f });
        }
      }
    }
  }

  if (allImages.length === 0) throw new Error(`No images found`);

  // ─── Read direccion.json for metadata (only used in fallback mode) ─────────
  let directionData: { scenes: { chapterIndex: number; images: { imageFile: string; transitionToNext?: TransitionType; transitionDuration?: number; kenBurnsStart?: number; kenBurnsEnd?: number; sentiment?: Sentiment }[] }[] } | null = null;
  const dirPath = path.join(videoDir, "direccion.json");
  if (fs.existsSync(dirPath)) {
    try { directionData = JSON.parse(fs.readFileSync(dirPath, "utf-8")); }
    catch { console.warn("   ⚠️ Could not parse direccion.json"); }
  }
  const metaLookup: Map<number, Map<string, { transitionToNext: TransitionType; transitionDuration: number; kenBurnsStart: number; kenBurnsEnd: number; sentiment: Sentiment }>> = new Map();
  if (directionData) {
    for (const ch of directionData.scenes) {
      const chMap = new Map();
      for (const img of ch.images) {
        chMap.set(img.imageFile, {
          transitionToNext: img.transitionToNext || "fade",
          transitionDuration: img.transitionDuration ?? 0.8,
          kenBurnsStart: img.kenBurnsStart ?? 1.0,
          kenBurnsEnd: img.kenBurnsEnd ?? 1.2,
          sentiment: img.sentiment || "calm",
        });
      }
      metaLookup.set(ch.chapterIndex, chMap);
    }
  }

  // ─── Parse SRT lyrics ──────────────────────────────────────────────────────
  const srtPath = path.join(autoriaDir, "letra.srt");
  let subtitles: SubtitleLine[] = [];
  if (fs.existsSync(srtPath)) {
    try {
      const srtContent = fs.readFileSync(srtPath, "utf-8");
      subtitles = parseSrt(srtContent, FPS);
      console.log(`   📝 Letra cargada: ${subtitles.length} líneas`);
    } catch (e) {
      console.warn(`   ⚠️ No se pudo parsear letra.srt`);
    }
  }

  // ─── Audio RMS extraction ──────────────────────────────────────────────────
  console.log("   🔊 Analizando energía del audio...");
  const rms = await getAudioRMS(songFsPath, totalFrames);
  const validRMS = rms.filter(v => v > 0);
  const rmsMin = validRMS.length > 0 ? validRMS.reduce((a, b) => Math.min(a, b), 1).toFixed(4) : "N/A";
  const rmsMax = rms.reduce((a, b) => Math.max(a, b), 0).toFixed(4);
  const rmsAvg = (rms.reduce((a, b) => a + b, 0) / rms.length).toFixed(4);
  console.log(`      ${rms.length} frames, rango [${rmsMin} - ${rmsMax}], media ${rmsAvg}`);

  // ─── Calculate transition points ───────────────────────────────────────────
  const imageCount = allImages.length;
  const idealSpacing = availableFrames / imageCount;
  const transitionFrames: number[] = [0];
  for (let i = 1; i < imageCount; i++) {
    const ideal = Math.round(i * idealSpacing);
    const windowSize = Math.max(1, Math.round(idealSpacing * 0.2));
    let bestFrame = ideal;
    let bestScore = -1;

    for (let f = Math.max(0, ideal - windowSize); f < Math.min(availableFrames, ideal + windowSize); f++) {
      let score = 0;
      for (const s of subtitles) {
        const srtOffset = s.startFrame - INTRO_FRAMES;
        if (srtOffset >= 0 && srtOffset < availableFrames && Math.abs(srtOffset - f) < 3) {
          score += 15;
        }
      }
      if (f > 1 && f < rms.length - 1 && rms[f] > rms[f - 1] && rms[f] > rms[f + 1]) {
        score += rms[f] * 80;
      }
      if (score > bestScore) {
        bestScore = score;
        bestFrame = f;
      }
    }
    transitionFrames.push(bestFrame);
  }
  transitionFrames.push(availableFrames);

  // ─── Build scenes ──────────────────────────────────────────────────────────
  const imageMetas: ImageMeta[] = [];
  let transitionCounts: Record<string, number> = {};

  for (let i = 0; i < imageCount; i++) {
    const start = transitionFrames[i];
    const end = transitionFrames[i + 1];
    const dur = Math.max(FPS, end - start);

    const transitionRms = rms[Math.min(start + Math.round(dur / 2), rms.length - 1)];
    const tType = useCustomImages ? pickTransition(transitionRms) : ("fade" as TransitionType);
    transitionCounts[tType] = (transitionCounts[tType] || 0) + 1;

    imageMetas.push({
      path: allImages[i].filePath,
      fileType: "image",
      durationInFrames: dur,
      transitionType: tType,
      transitionDuration: 0.8,
      kenBurnsStart: 1.0 + (i % 2 === 0 ? 0.0 : 0.03),
      kenBurnsEnd: 1.0 + (i % 2 === 0 ? 0.06 : 0.09),
      sentiment: "calm",
    });
  }

  // ─── Split at first chorus (~01:41.340 → frame 2890 within available) ────
  const chorusFrame = Math.round(101.34 * FPS) - INTRO_FRAMES;
  let splitIndex = imageMetas.length;
  let accFrames = 0;
  for (let i = 0; i < imageMetas.length; i++) {
    accFrames += imageMetas[i].durationInFrames;
    if (accFrames > chorusFrame) {
      splitIndex = i + 1;
      break;
    }
  }
  const preChorusMetas = imageMetas.slice(0, splitIndex);
  const postChorusMetas = imageMetas.slice(splitIndex);

  const scenes: Scene[] = [
    {
      chapterIndex: 0,
      title: "Lluvia",
      audioPath: "",
      audioDurationSeconds: 0,
      durationInFrames: preChorusMetas.reduce((sum, img) => sum + img.durationInFrames, 0),
      images: preChorusMetas,
      climate: "matrix",
    },
    {
      chapterIndex: 1,
      title: "Tormenta",
      audioPath: "",
      audioDurationSeconds: 0,
      durationInFrames: postChorusMetas.reduce((sum, img) => sum + img.durationInFrames, 0),
      images: postChorusMetas,
      climate: "matrix",
    },
  ];

  const summary = Object.entries(transitionCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(", ");
  console.log(`   🔄 Transiciones (${imageCount - 1} totales): ${summary}`);

  return {
    scenes,
    totalFrames,
    songPath,
    channelStyle,
    introDuration: INTRO_FRAMES,
    outroDuration: OUTRO_FRAMES,
    subtitles,
    authorName,
  };
}

function parseSrtTime(time: string): number {
  const [h, m, rest] = time.split(":");
  const [sec, ms] = rest.split(",");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
}

function parseSrt(srtContent: string, fps: number): SubtitleLine[] {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const timeLine = lines[1];
    const text = lines.slice(2).join("\n").trim();
    if (!timeLine || !text) return null;
    const [startStr, endStr] = timeLine.split(" --> ");
    const startSec = parseSrtTime(startStr.trim());
    const endSec = parseSrtTime(endStr.trim());
    return {
      startFrame: Math.round(startSec * fps),
      endFrame: Math.round(endSec * fps),
      text,
    };
  }).filter(Boolean) as SubtitleLine[];
}
