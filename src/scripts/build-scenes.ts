import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Scene, ImageMeta, ChannelStyle, MusicTrack, TransitionType, Sentiment, DirectionImage, Climate } from "../types";
import { detectChapters } from "./validate-content";

const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VALID_VIDEO_EXTS = [".mp4", ".mov", ".webm"];
const VALID_AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg"];

const execFileAsync = promisify(execFile);

// ─── SILENCE DETECTION via ffmpeg ───────────────────────────────────────────────
// Returns measured silence gaps from the actual audio.
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

// ─── SPEECH SEGMENTS FROM AUDIO ────────────────────────────────────────────────
// Uses silence detection to measure actual speech segment durations.
function buildSpeechSegments(
  totalDuration: number,
  silences: {start: number; end: number; duration: number}[]
): {speech: {start: number; end: number; duration: number}[]; totalSilence: number} {
  const speech: {start: number; end: number; duration: number}[] = [];
  let prevEnd = 0;
  let totalSilence = 0;
  for (const s of silences) {
    if (s.start > prevEnd) speech.push({ start: prevEnd, end: s.start, duration: s.start - prevEnd });
    totalSilence += s.duration;
    prevEnd = s.end;
  }
  if (prevEnd < totalDuration) speech.push({ start: prevEnd, end: totalDuration, duration: totalDuration - prevEnd });
  return { speech, totalSilence };
}

// ─── WHISPER WORD TIMESTAMPS ───────────────────────────────────────────────────
export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

export interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
  language: string;
}

export function cleanTextInclude(text: string): string {
  return text
    .replace(/<break\s+time="[\d.]+s"\s*\/>/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/[\s\n\r]+/g, " ")
    .trim();
}

export async function runWhisper(audioPath: string, initialPrompt?: string): Promise<WhisperResult | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"));
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const outPath = path.join(tmpDir, `${baseName}.json`);
  try {
    const args = [
      audioPath,
      "--model", "small",
      "--language", "es",
      "--word_timestamps", "True",
      "--output_format", "json",
      "--output_dir", tmpDir,
    ];
    if (initialPrompt) args.push("--initial_prompt", initialPrompt);
    await execFileAsync("whisper", args);
    const raw = fs.readFileSync(outPath, "utf-8");
    return JSON.parse(raw) as WhisperResult;
  } catch {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── ALIGN textInclude WORDS TO WHISPER WORD TIMESTAMPS ────────────────────────
// Matches the cleaned words from each image's textInclude to whisper's word timestamps
// using sequential greedy alignment. Returns per-image duration in seconds.
function alignWhisperToImages(
  images: { textInclude: string }[],
  whisperWords: WhisperWord[]
): number[] {
  // Clean all textInclude into a single ordered word list
  const imageWords: string[][] = [];
  for (const img of images) {
    const clean = img.textInclude
      .replace(/<break\s+time="[\d.]+s"\s*\/>/g, " ")
      .replace(/\[.*?\]/g, " ")
      .replace(/[\s\n\r]+/g, " ")
      .trim()
      .toLowerCase();
    const words = clean.split(/\s+/).filter((w) => w.length > 0);
    imageWords.push(words);
  }

  // Clean whisper words
  const wWords = whisperWords.map((w) => ({
    orig: w,
    clean: w.word.toLowerCase().replace(/[^a-záéíóúüñ0-9]/g, ""),
  }));

  const durations: number[] = [];
  let wIdx = 0;

  for (const imgWords of imageWords) {
    if (imgWords.length === 0 || wIdx >= wWords.length) {
      durations.push(0);
      continue;
    }

    const firstClean = imgWords[0].replace(/[^a-záéíóúüñ0-9]/g, "");

    // Find the first word match (skip up to 10 whisper words to find it)
    let startIdx = -1;
    for (let tries = 0; tries < 10 && wIdx + tries < wWords.length; tries++) {
      const wc = wWords[wIdx + tries].clean;
      if (firstClean.length > 0 && (wc === firstClean || wc.includes(firstClean) || firstClean.includes(wc))) {
        startIdx = wIdx + tries;
        break;
      }
    }

    if (startIdx === -1) {
      durations.push(0);
      continue;
    }

    // Greedy sequential match: walk through imgWords and wWords together
    let imgPos = 0;
    let wPos = startIdx;

    while (imgPos < imgWords.length && wPos < wWords.length) {
      const iw = imgWords[imgPos].replace(/[^a-záéíóúüñ0-9]/g, "");
      const ww = wWords[wPos].clean;

      if (iw.length > 0 && (ww === iw || ww.includes(iw) || iw.includes(ww))) {
        imgPos++;
        wPos++;
      } else {
        // Skip the unexpected whisper word (hallucination/insertion)
        wPos++;
      }
    }

    const lastIdx = Math.min(wPos - 1, wWords.length - 1);
    const startTime = wWords[startIdx].orig.start;
    const endTime = wWords[lastIdx].orig.end;
    durations.push(Math.max(endTime - startTime, 0.3));
    wIdx = lastIdx + 1;
  }

  return durations;
}

// ─── NEEDLEMAN-WUNSCH WORD ALIGNMENT ──────────────────────────────────────────
// Aligns expected words (from textInclude) to whisper word timestamps using DP,
// handling insertions, deletions, and substitutions robustly.
// Returns per-image duration in integer frames.

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function matchScore(a: string, b: string): number {
  if (a === b) return 2;
  if (a.includes(b) || b.includes(a)) return 1;
  if (a.length > 2 && b.length > 2 && levenshtein(a, b) <= 2) return 1;
  return -1;
}

export interface WordAlignment {
  wordCounts: number[];
  imageStart: (number | null)[];
  imageEnd: (number | null)[];
}

export function assignWordsToImages(
  texts: string[],
  whisperWords: WhisperWord[]
): WordAlignment {
  type WordInfo = { word: string; imageIdx: number };
  const allExpected: WordInfo[] = [];

  for (let imgIdx = 0; imgIdx < texts.length; imgIdx++) {
    const clean = texts[imgIdx].toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    for (const w of clean) {
      allExpected.push({ word: w.replace(/[^a-záéíóúüñ0-9]/g, ""), imageIdx: imgIdx });
    }
  }

  const wWords = whisperWords.map((w) =>
    w.word.toLowerCase().replace(/[^a-záéíóúüñ0-9]/g, "")
  );

  const N = allExpected.length;
  const M = wWords.length;

  const empty = {
    wordCounts: texts.map(() => 0),
    imageStart: texts.map(() => null) as (number | null)[],
    imageEnd: texts.map(() => null) as (number | null)[],
  };

  if (N === 0 || M === 0) return empty;

  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(-Infinity));
  dp[0][0] = 0;
  for (let i = 1; i <= N; i++) dp[i][0] = dp[i - 1][0] - 1;
  for (let j = 1; j <= M; j++) dp[0][j] = dp[0][j - 1] - 1;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const match = dp[i - 1][j - 1] + matchScore(allExpected[i - 1].word, wWords[j - 1]);
      const del = dp[i - 1][j] - 1;
      const ins = dp[i][j - 1] - 1;
      dp[i][j] = Math.max(match, del, ins);
    }
  }

  const expectedToWhisper: (number | null)[] = new Array(N).fill(null);
  let i = N, j = M;
  while (i > 0 && j > 0) {
    const mScore = matchScore(allExpected[i - 1].word, wWords[j - 1]);
    if (dp[i][j] === dp[i - 1][j - 1] + mScore) {
      expectedToWhisper[i - 1] = j - 1;
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j] - 1) {
      i--;
    } else {
      j--;
    }
  }

  const imageStart: (number | null)[] = new Array(texts.length).fill(null);
  const imageEnd: (number | null)[] = new Array(texts.length).fill(null);
  const wordCounts: number[] = new Array(texts.length).fill(0);

  for (let eIdx = 0; eIdx < allExpected.length; eIdx++) {
    const wIdx = expectedToWhisper[eIdx];
    if (wIdx === null) continue;
    const imgIdx = allExpected[eIdx].imageIdx;
    wordCounts[imgIdx]++;
    const wTime = whisperWords[wIdx].start;
    if (imageStart[imgIdx] === null || wTime < imageStart[imgIdx]!) {
      imageStart[imgIdx] = wTime;
    }
    const wEndTime = whisperWords[wIdx].end;
    if (imageEnd[imgIdx] === null || wEndTime > imageEnd[imgIdx]!) {
      imageEnd[imgIdx] = wEndTime;
    }
  }

  return { wordCounts, imageStart, imageEnd };
}

export function alignWordsWithDP(
  texts: string[],
  whisperWords: WhisperWord[],
  fps: number
): number[] {
  const { imageStart, imageEnd } = assignWordsToImages(texts, whisperWords);

  const wStart = whisperWords[0]?.start || 0;
  const wEnd = whisperWords[whisperWords.length - 1]?.end || 0;
  const totalChars = texts.reduce((s, t) => s + t.length, 0);
  const boundaries: number[] = new Array(texts.length + 1);
  boundaries[0] = wStart;
  boundaries[texts.length] = wEnd;

  for (let i = 1; i < texts.length; i++) {
    const prevEnd = imageEnd[i - 1];
    const currStart = imageStart[i];
    if (prevEnd !== null && currStart !== null) {
      boundaries[i] = (prevEnd + currStart) / 2;
    } else {
      const cumChars = texts.slice(0, i).reduce((s, t) => s + t.length, 0);
      boundaries[i] = totalChars > 0
        ? wStart + (wEnd - wStart) * (cumChars / totalChars)
        : wStart + (wEnd - wStart) * (i / texts.length);
    }
  }

  const result: number[] = [];
  for (let i = 0; i < texts.length; i++) {
    const durSec = Math.max(boundaries[i + 1] - boundaries[i], 0.3);
    result.push(Math.round(durSec * fps));
  }

  return result;
}

function getAssetPath(...segments: string[]): string {
  return "/" + segments.join("/");
}

function extractTrackNumber(filePath: string): number {
  const match = path.basename(filePath).match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      audioPath,
    ]);
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) throw new Error("Invalid duration");
    return duration;
  } catch {
    try {
      const { size } = fs.statSync(audioPath);
      const estimatedDuration = size / 16000;
      return Math.max(estimatedDuration, 5);
    } catch {
      return 10;
    }
  }
}

function getChapterLabel(chapterIndex: number): string {
  return `capitulo-${String(chapterIndex + 1).padStart(2, "0")}`;
}

function parseChapterTitles(videoDir: string): string[] {
  const instruccionesPath = path.join(videoDir, "INSTRUCCIONES.md");
  if (!fs.existsSync(instruccionesPath)) return [];

  const content = fs.readFileSync(instruccionesPath, "utf-8");
  const titles: string[] = [];
  const lines = content.split("\n");
  let inChaptersSection = false;

  for (const line of lines) {
    if (line.startsWith("## Capítulos del video")) {
      inChaptersSection = true;
      continue;
    }
    if (inChaptersSection) {
      const match = line.match(/^\d+\.\s+\*\*c\d+\*\*\s*—\s*(.+)/);
      if (match) {
        titles.push(match[1].trim());
      } else if (line.trim() === "" && titles.length > 0) {
        break;
      }
    }
  }

  return titles;
}

// ─── VOCAL TAGS → pause time (seconds) ────────────────────────────────────────
// These are real narration pauses a voice actor takes for dramatic effect.
const VOCAL_TAG_PAUSES: Record<string, number> = {
  "inhales deeply": 1.8,
  "exhales sharply": 1.2,
  "exhales slowly": 1.5,
  "sighs": 1.0,
  "short pause": 0.8,
  "thoughtful": 0.6,
  "whispers": 0.4,   // whispers = slower delivery, ~0.4s extra onset
  "sarcastic": 0.3,
};

// Narration WPM by vocal tag context (average real narrator pace)
// Normal dramatic narration: ~100 wpm. Whisper/thoughtful: ~75 wpm. Drama peaks: ~110 wpm.
const VOCAL_TAG_WPM: Record<string, number> = {
  "whispers":       70,
  "thoughtful":     80,
  "inhales deeply": 85,
  "exhales sharply": 90,
  "sighs":          85,
  "sarcastic":      110,
  "short pause":    90,
};
const DEFAULT_NARRATION_WPM = 100;

function parseGuionChapters(videoDir: string): {
  chapterIndex: number;
  paragraphs: string[];
  breaks: number[];       // pure <break time="Xs"/> sum per paragraph
  tagPauses: number[];    // vocal tag implicit pause per paragraph
  wpmFactors: number[];   // WPM modifier per paragraph (for duration calc)
}[] {
  const guionPath = path.join(videoDir, "guion.md");
  if (!fs.existsSync(guionPath)) return [];

  const content = fs.readFileSync(guionPath, "utf-8");
  const chapters: ReturnType<typeof parseGuionChapters> = [];

  const sections = content.split(/^#\s+c(\d+)/m);
  for (let i = 1; i < sections.length; i += 2) {
    const idx = parseInt(sections[i], 10) - 1;
    const body = sections[i + 1].trim();
    const rawParagraphs = body.split(/\n\n+/).filter((p) => p.trim().length > 0);

    const paragraphs: string[] = [];
    const breaks: number[] = [];
    const tagPauses: number[] = [];
    const wpmFactors: number[] = [];

    for (const raw of rawParagraphs) {
      let text = raw.trim();

      // 1. Extract explicit <break> seconds
      const breakMatches = [...text.matchAll(/<break\s+time="([\d.]+)s"\s*\/>/g)];
      let totalBreakTime = 0;
      for (const bm of breakMatches) totalBreakTime += parseFloat(bm[1]);
      text = text.replace(/<break\s+time="[\d.]+s"\s*\/>/g, "").trim();

      // 2. Extract vocal tags and their implicit pauses
      const tagMatches = [...text.matchAll(/\[([^\]]+)\]/g)];
      let totalTagPause = 0;
      let detectedWpm = DEFAULT_NARRATION_WPM;
      for (const tm of tagMatches) {
        const tag = tm[1].toLowerCase().trim();
        for (const [key, pause] of Object.entries(VOCAL_TAG_PAUSES)) {
          if (tag.includes(key)) {
            totalTagPause += pause;
            break;
          }
        }
        for (const [key, wpm] of Object.entries(VOCAL_TAG_WPM)) {
          if (tag.includes(key)) {
            detectedWpm = wpm;
            break;
          }
        }
      }
      text = text.replace(/\[.*?\]/g, "").trim();
      text = text.replace(/\s+/g, " ").trim();

      if (text.length > 0) {
        paragraphs.push(text);
        breaks.push(totalBreakTime);
        tagPauses.push(totalTagPause);
        wpmFactors.push(DEFAULT_NARRATION_WPM / detectedWpm); // >1 = slower delivery
      }
    }

    chapters.push({ chapterIndex: idx, paragraphs, breaks, tagPauses, wpmFactors });
  }

  chapters.sort((a, b) => a.chapterIndex - b.chapterIndex);
  return chapters;
}

const SENTIMENT_KEYWORDS: Record<Sentiment, string[]> = {
  calm: ["era", "había", "explicó", "describió", "sabía", "conocía", "recordó", "pensó", "entendió", "observó", "analizó", "sistema", "cálculo", "exacto", "precisión", "datos"],
  tension: ["de repente", "repentinamente", "trampa", "acecho", "oscuro", "acecha", "algo", "presencia", "silenciosamente", "sigiloso", "sombra", "espera", "alerta", "movimiento", "atisbo", "inquietante"],
  drama: ["traición", "pérdida", "dolor", "sacrificio", "colapso", "arder", "morir", "muerte", "sangre", "lágrimas", "destrucción", "quebrado", "roto", "abandonado", "víctima", "culpa", "redención"],
  terror: ["horror", "pesadilla", "indefenso", "grita", "sangre", "implacable", "obsceno", "monstruo", "aterrador", "pánico", "desgarrador", "cruel", "brutal", "incesante", "imparable"],
  resolution: ["renacer", "nueva", "final", "descansa", "aprendió", "despertó", "amanecer", "renovado", "esperanza", "paz", "descubrimiento", "comprender", "aceptar", "transformación"],
  mystery: ["enigma", "incógnita", "secreto", "oculto", "misterio", "desconocido", "extraño", "inexplicable", "ambiguo", "velado", "cifrado", "intriga", "sospecha", "trasfondo", "profecía"],
  rage: ["ira", "furia", "odio", "venganza", "destruir", "aniquilar", "exterminio", "violencia", "salvaje", "implacable", "ira contenida", "resentimiento", "furioso", "arrasar"],
  despair: ["desesperación", "vacío", "sin sentido", "rendirse", "abismo", "oscuridad total", "sin esperanza", "devastado", "perdido", "anulado", "nihilismo", "absurdo", "consumido"],
  triumph: ["triunfo", "victoria", "poder absoluto", "dominación", "conquista", "superioridad", "control total", "imparable", "supremacía", "exitoso", "logró", "derrotó", "venció"],
  dread: ["pavor", "anticipación", "inminente", "inevitable", "condenado", "fatalidad", "presagio", "amenaza latente", "opresivo", "asfixiante", "saber que", "pronto", "llegará"],
};

const SENTIMENT_WEIGHT: Record<Sentiment, number> = {
  calm: 1.0,
  mystery: 1.2,
  tension: 1.4,
  drama: 1.8,
  terror: 1.6,
  resolution: 1.5,
  rage: 1.7,
  despair: 1.5,
  triumph: 1.4,
  dread: 1.3,
};

const CHAPTER_PAUSE_FRAMES = 15;
const TRANSITION_FRAMES = 30;

function analyzeSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const scores: Record<Sentiment, number> = {
    calm: 0, tension: 0, drama: 0, terror: 0, resolution: 0,
    mystery: 0, rage: 0, despair: 0, triumph: 0, dread: 0,
  };

  for (const [sentiment, keywords] of Object.entries(SENTIMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[sentiment as Sentiment] += 1;
    }
  }

  const priority: Sentiment[] = ["terror", "dread", "rage", "drama", "despair", "tension", "mystery", "triumph", "resolution", "calm"];
  let best: Sentiment = "calm";
  let bestScore = 0;

  for (const s of priority) {
    if (scores[s] > bestScore) {
      bestScore = scores[s];
      best = s;
    }
  }
  return best;
}

const NEW_TRANSITIONS: TransitionType[] = ["slide-left", "slide-right", "slide-up", "slide-down", "whip", "zoom-in", "zoom-out", "pixelate"];

function pickNewTransition(seed: number): TransitionType {
  const idx = seed % NEW_TRANSITIONS.length;
  return NEW_TRANSITIONS[idx];
}

// ─── TRANSITION SELECTION ─────────────────────────────────────────────────────
// Considers: current sentiment, previous sentiment, and escalation direction.
// Escalation = going from lower to higher intensity → more aggressive transition.
// De-escalation = going from high to low → smoother transition.

const SENTIMENT_INTENSITY: Record<Sentiment, number> = {
  calm: 0,
  mystery: 0.5,
  resolution: 1,
  tension: 2,
  dread: 2.5,
  despair: 3,
  drama: 3,
  rage: 3.5,
  terror: 4,
  triumph: 4,
};

type TransitionOption = { type: TransitionType; weight: number; duration: number };

function sentimentToTransition(
  sentiment: Sentiment,
  prevSentiment: Sentiment | null,
  imageIndex: number,
  totalImages: number,
  chapterIndex: number = 0
): { type: TransitionType; duration: number } {
  const currentIntensity = SENTIMENT_INTENSITY[sentiment];
  const prevIntensity = prevSentiment ? SENTIMENT_INTENSITY[prevSentiment] : currentIntensity;
  const escalation = currentIntensity - prevIntensity; // positive = escalating, negative = de-escalating
  const isClimax = imageIndex >= Math.floor(totalImages * 0.65); // last 35% of chapter = climax zone

  let options: TransitionOption[] = [];

  // Base options per sentiment
  switch (sentiment) {
    case "calm":
      if (escalation < 0) {
        // De-escalation into calm: slow dissolve
        options = [
          { type: "crossfade", weight: 7, duration: 1.4 },
          { type: "fade", weight: 3, duration: 1.2 },
        ];
      } else {
        options = [
          { type: "fade", weight: 6, duration: 1.0 },
          { type: "crossfade", weight: 2, duration: 1.0 },
          { type: pickNewTransition(imageIndex), weight: 2, duration: 1.0 },
        ];
      }
      break;

    case "tension":
      if (escalation >= 2) {
        // Big jump into tension: radial burst
        options = [
          { type: "radial", weight: 5, duration: 0.6 },
          { type: "zoom-blur", weight: 3, duration: 0.5 },
          { type: "whip", weight: 2, duration: 0.4 },
        ];
      } else if (escalation > 0) {
        options = [
          { type: "radial", weight: 4, duration: 0.8 },
          { type: "zoom-blur", weight: 2, duration: 0.7 },
          { type: "fade", weight: 2, duration: 0.9 },
          { type: "slide-up", weight: 2, duration: 0.7 },
        ];
      } else {
        // Sustained tension: alternate radial and zoom-blur
        options = [
          { type: "radial", weight: imageIndex % 2 === 0 ? 5 : 2, duration: 0.8 },
          { type: "zoom-blur", weight: imageIndex % 2 === 0 ? 2 : 5, duration: 0.7 },
          { type: "fade", weight: 1, duration: 0.9 },
          { type: "slide-left", weight: 2, duration: 0.7 },
        ];
      }
      break;

    case "drama":
      if (escalation >= 2) {
        // Sudden dramatic peak: hard glitch or flash
        options = [
          { type: "glitch", weight: 4, duration: 0.35 },
          { type: "flash", weight: 4, duration: 0.3 },
          { type: "whip", weight: 2, duration: 0.3 },
        ];
      } else if (escalation > 0) {
        options = [
          { type: "glitch", weight: 3, duration: 0.45 },
          { type: "flash", weight: 2, duration: 0.4 },
          { type: "radial", weight: 2, duration: 0.6 },
          { type: "zoom-in", weight: 3, duration: 0.5 },
        ];
      } else if (isClimax) {
        // In climax zone even sustained drama gets aggressive
        options = [
          { type: "flash", weight: 4, duration: 0.3 },
          { type: "glitch", weight: 2, duration: 0.4 },
          { type: "radial", weight: 2, duration: 0.5 },
          { type: "whip", weight: 2, duration: 0.3 },
        ];
      } else {
        options = [
          { type: "glitch", weight: 3, duration: 0.5 },
          { type: "flash", weight: 2, duration: 0.4 },
          { type: "fade", weight: 2, duration: 0.8 },
          { type: "zoom-in", weight: 3, duration: 0.6 },
        ];
      }
      break;

    case "terror":
      if (escalation >= 1 || isClimax) {
        // Maximum impact: shatter or instant flash
        options = [
          { type: "shatter", weight: 4, duration: 0.25 },
          { type: "flash", weight: 2, duration: 0.2 },
          { type: "glitch", weight: 2, duration: 0.3 },
          { type: "pixelate", weight: 2, duration: 0.5 },
        ];
      } else {
        options = [
          { type: "shatter", weight: 3, duration: 0.3 },
          { type: "glitch", weight: 2, duration: 0.35 },
          { type: "flash", weight: 2, duration: 0.3 },
          { type: "pixelate", weight: 3, duration: 0.6 },
        ];
      }
      break;

    case "resolution":
      if (escalation < 0) {
        // Coming down: slow, cinematic crossfade
        options = [
          { type: "crossfade", weight: 6, duration: 1.5 },
          { type: "fade", weight: 2, duration: 1.2 },
        ];
      } else {
        options = [
          { type: "crossfade", weight: 5, duration: 1.2 },
          { type: "fade", weight: 3, duration: 1.0 },
          { type: "slide-down", weight: 2, duration: 0.9 },
        ];
      }
      break;

    case "mystery":
      if (escalation > 0) {
        options = [
          { type: "radial", weight: 4, duration: 0.8 },
          { type: "fade", weight: 3, duration: 1.1 },
          { type: "zoom-blur", weight: 2, duration: 0.8 },
          { type: "slide-up", weight: 1, duration: 0.9 },
        ];
      } else {
        options = [
          { type: "fade", weight: 4, duration: 1.2 },
          { type: "crossfade", weight: 3, duration: 1.3 },
          { type: "slide-right", weight: 2, duration: 1.0 },
        ];
      }
      break;

    case "rage":
      if (escalation >= 1) {
        options = [
          { type: "shatter", weight: 4, duration: 0.2 },
          { type: "glitch", weight: 3, duration: 0.3 },
          { type: "whip", weight: 2, duration: 0.25 },
          { type: "flash", weight: 1, duration: 0.3 },
        ];
      } else {
        options = [
          { type: "glitch", weight: 3, duration: 0.4 },
          { type: "flash", weight: 3, duration: 0.35 },
          { type: "radial", weight: 2, duration: 0.5 },
          { type: "zoom-in", weight: 2, duration: 0.5 },
        ];
      }
      break;

    case "despair":
      if (escalation < 0) {
        options = [
          { type: "fade", weight: 5, duration: 1.5 },
          { type: "crossfade", weight: 3, duration: 1.4 },
          { type: "slide-down", weight: 2, duration: 1.2 },
        ];
      } else {
        options = [
          { type: "fade", weight: 3, duration: 1.2 },
          { type: "crossfade", weight: 3, duration: 1.0 },
          { type: "zoom-out", weight: 2, duration: 1.1 },
          { type: "slide-down", weight: 2, duration: 1.0 },
        ];
      }
      break;

    case "triumph":
      if (escalation >= 1) {
        options = [
          { type: "zoom-in", weight: 3, duration: 0.8 },
          { type: "slide-down", weight: 2, duration: 0.8 },
          { type: "radial", weight: 2, duration: 0.7 },
        ];
      } else {
        options = [
          { type: "crossfade", weight: 3, duration: 1.2 },
          { type: "fade", weight: 3, duration: 1.0 },
          { type: "slide-right", weight: 2, duration: 0.9 },
        ];
      }
      break;

    case "dread":
      if (escalation >= 1) {
        options = [
          { type: "pixelate", weight: 4, duration: 0.5 },
          { type: "zoom-blur", weight: 3, duration: 0.5 },
          { type: "glitch", weight: 2, duration: 0.4 },
          { type: "radial", weight: 1, duration: 0.6 },
        ];
      } else {
        options = [
          { type: "fade", weight: 3, duration: 1.0 },
          { type: "radial", weight: 3, duration: 0.8 },
          { type: "slide-left", weight: 2, duration: 0.8 },
          { type: "zoom-blur", weight: 2, duration: 0.7 },
        ];
      }
      break;
  }

  // Deterministic pick based on image index + chapter position (not purely sequential)
  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  const seed = ((chapterIndex * 97 + imageIndex * 11 + totalImages * 3) % totalWeight);
  let acc = 0;
  for (const opt of options) {
    acc += opt.weight;
    if (seed < acc) return { type: opt.type, duration: opt.duration };
  }
  return { type: "fade", duration: 1.0 };
}

function sentimentToKenBurns(sentiment: Sentiment, escalation: number): { start: number; end: number } {
  const boost = Math.min(escalation * 0.02, 0.06);
  switch (sentiment) {
    case "calm":       return { start: 1.0,  end: 1.06 + boost };
    case "mystery":    return { start: 1.02, end: 1.1  + boost };
    case "tension":    return { start: 1.04, end: 1.13 + boost };
    case "dread":      return { start: 1.05, end: 1.15 + boost };
    case "drama":      return { start: 1.06, end: 1.18 + boost };
    case "despair":    return { start: 1.03, end: 1.12 + boost };
    case "rage":       return { start: 1.08, end: 1.22 + boost };
    case "terror":     return { start: 1.1,  end: 1.26 + boost };
    case "triumph":    return { start: 1.05, end: 1.14 + boost };
    case "resolution": return { start: 1.1,  end: 1.0 };
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// ─── IMAGE DURATION ASSIGNMENT ────────────────────────────────────────────────
// Duration now accounts for:
//   - word count (base duration)
//   - sentiment weight (dramatic = longer screen time)
//   - explicit <break> tags (literal silence)
//   - vocal tag implicit pauses (inhales, whispers, etc.)
//   - WPM factor (slower delivery = longer duration for same words)

function assignImagesToParagraphs(
  images: { path: string; fileType: "image" | "video" }[],
  paragraphs: string[],
  breaks: number[],
  tagPauses: number[],
  wpmFactors: number[],
  totalAudioDuration: number,
  fps: number,
  chapterIndex: number = 0
): ImageMeta[] {
  if (images.length === 0) return [];
  if (paragraphs.length === 0 || totalAudioDuration <= 0) {
    const dur = Math.max(Math.round((totalAudioDuration || 10) * fps / images.length), 60);
    return images.map((img, i) => ({
      ...img,
      durationInFrames: i === images.length - 1 ? Math.round(totalAudioDuration * fps) - dur * (images.length - 1) : dur,
      transitionType: "fade" as TransitionType,
      transitionDuration: 0.8,
      sentiment: "calm" as Sentiment,
      kenBurnsStart: 1.0,
      kenBurnsEnd: 1.08,
    }));
  }

  const wordsPerParagraph = paragraphs.map(countWords);
  const totalWords = wordsPerParagraph.reduce((a, b) => a + b, 0);

  let groupBoundaries: number[] = [];
  if (paragraphs.length <= images.length) {
    groupBoundaries = paragraphs.map((_, i) => i);
    while (groupBoundaries.length < images.length) {
      groupBoundaries.push(groupBoundaries.length);
    }
  } else {
    const wordsPerImage = totalWords / images.length;
    let cumulativeWords = 0;
    let paraIdx = 0;
    groupBoundaries.push(0);
    for (let i = 1; i < images.length && paraIdx < paragraphs.length; i++) {
      while (cumulativeWords < wordsPerImage * i && paraIdx < paragraphs.length) {
        cumulativeWords += wordsPerParagraph[paraIdx];
        paraIdx++;
      }
      groupBoundaries.push(Math.min(paraIdx, paragraphs.length - 1));
    }
  }

  const result: ImageMeta[] = [];
  const weightedData: { weightedTime: number }[] = [];
  let prevSentiment: Sentiment | null = null;

  for (let i = 0; i < images.length; i++) {
    const startPara = groupBoundaries[i];
    const endPara = i < images.length - 1 ? groupBoundaries[i + 1] : paragraphs.length;

    const groupText = paragraphs.slice(startPara, endPara).join(" ");
    const sentiment = analyzeSentiment(groupText);
    const prevIntensity = prevSentiment ? SENTIMENT_INTENSITY[prevSentiment] : SENTIMENT_INTENSITY[sentiment];
    const escalation = SENTIMENT_INTENSITY[sentiment] - prevIntensity;

    const transition = sentimentToTransition(sentiment, prevSentiment, i, images.length, chapterIndex);
    const kenBurns = sentimentToKenBurns(sentiment, escalation);
    prevSentiment = sentiment;

    // Weighted time = narration time for this group
    // = (words / WPM) * 60 * sentimentWeight + breaks + tagPauses
    let groupWeightedTime = 0;
    for (let p = startPara; p < endPara; p++) {
      const words = wordsPerParagraph[p] || 0;
      const wpm = DEFAULT_NARRATION_WPM / (wpmFactors[p] || 1); // actual WPM for this paragraph
      const speechTime = (words / wpm) * 60;
      const silences = (breaks[p] || 0) + (tagPauses[p] || 0);
      groupWeightedTime += (speechTime + silences) * SENTIMENT_WEIGHT[sentiment];
    }

    weightedData.push({ weightedTime: Math.max(groupWeightedTime, 0.1) });

    result.push({
      path: images[i].path,
      fileType: images[i].fileType,
      durationInFrames: 0,
      transitionType: transition.type,
      transitionDuration: transition.duration,
      sentiment,
      kenBurnsStart: kenBurns.start,
      kenBurnsEnd: kenBurns.end,
    });
  }

  // Scale weighted times to match real audio duration
  const totalWeightedTime = weightedData.reduce((s, d) => s + d.weightedTime, 0);
  const scaleFactor = totalAudioDuration / totalWeightedTime;

  for (let i = 0; i < result.length; i++) {
    const rawDuration = weightedData[i].weightedTime * scaleFactor;
    result[i].durationInFrames = Math.max(Math.round(rawDuration * fps), 90); // min 3s
  }

  // Clamp max 25s per image
  const MAX_FRAMES = Math.round(25 * fps);
  let overflow = true;
  while (overflow) {
    overflow = false;
    let totalClamped = 0;
    let nonClampedCount = 0;
    for (const img of result) {
      if (img.durationInFrames > MAX_FRAMES) {
        totalClamped += img.durationInFrames - MAX_FRAMES;
        img.durationInFrames = MAX_FRAMES;
        overflow = true;
      } else {
        nonClampedCount++;
      }
    }
    if (overflow && nonClampedCount > 0) {
      const extra = Math.floor(totalClamped / nonClampedCount);
      for (const img of result) {
        if (img.durationInFrames < MAX_FRAMES) img.durationInFrames += extra;
      }
    }
  }

  // Adjust last image to absorb rounding error
  const totalAssigned = result.reduce((s, img) => s + img.durationInFrames, 0);
  const targetFrames = Math.round(totalAudioDuration * fps);
  const diff = targetFrames - totalAssigned;
  // FIX: solo absorber el error de redondeo en la última imagen
  // CHAPTER_PAUSE_FRAMES se suma al total de la escena en buildScenes(), no aquí
  if (result.length > 0) result[result.length - 1].durationInFrames += diff;

  return result;
}

// ─── PARSE textInclude (raw elevenlabs text with tags) ────────────────────────
function parseTextInclude(text: string): {
  clean: string;
  breakTime: number;
  tagPause: number;
  wpmFactor: number;
} {
  let processed = text.trim();
  if (!processed) return { clean: "", breakTime: 0, tagPause: 0, wpmFactor: 1 };

  const breakMatches = [...processed.matchAll(/<break\s+time="([\d.]+)s"\s*\/>/g)];
  let totalBreakTime = 0;
  for (const bm of breakMatches) totalBreakTime += parseFloat(bm[1]);
  processed = processed.replace(/<break\s+time="[\d.]+s"\s*\/>/g, "").trim();

  const tagMatches = [...processed.matchAll(/\[([^\]]+)\]/g)];
  let totalTagPause = 0;
  let detectedWpm = DEFAULT_NARRATION_WPM;
  for (const tm of tagMatches) {
    const tag = tm[1].toLowerCase().trim();
    for (const [key, pause] of Object.entries(VOCAL_TAG_PAUSES)) {
      if (tag.includes(key)) { totalTagPause += pause; break; }
    }
    for (const [key, wpm] of Object.entries(VOCAL_TAG_WPM)) {
      if (tag.includes(key)) { detectedWpm = wpm; break; }
    }
  }
  processed = processed.replace(/\[.*?\]/g, "").trim();
  processed = processed.replace(/\s+/g, " ").trim();

  return {
    clean: processed,
    breakTime: totalBreakTime,
    tagPause: totalTagPause,
    wpmFactor: DEFAULT_NARRATION_WPM / detectedWpm,
  };
}

// ─── FRAME ASSIGNMENT from textInclude + audio silence detection ────────────────
// Uses textInclude from direccion.json and actual audio silence measurements.
// Breaks from textInclude are mapped 1:1 by order to silence gaps in the audio,
// giving exact break durations per image. Speech time is distributed by char proportion
// within each speech segment (between silences), using the measured segment durations.
async function assignFramesWithWeights(
  dirImages: DirectionImage[],
  allVisuals: { path: string; fileType: "image" | "video" }[],
  totalAudioDuration: number,
  fps: number,
  audioPath?: string
): Promise<ImageMeta[]> {
  // Parse all segments first — collect chars, breaks, tag pauses
  const segments: {
    visual: { path: string; fileType: "image" | "video" };
    chars: number;
    breakTime: number;
    tagPause: number;
    sentiment: Sentiment;
    imageIndex: number;
  }[] = [];

  for (const dirImg of dirImages) {
    const visual = allVisuals.find((v) => v.path.endsWith(dirImg.imageFile));
    if (!visual) continue;

    const parsed = parseTextInclude(dirImg.textInclude || "");
    const sentiment = parsed.clean ? analyzeSentiment(parsed.clean) : dirImg.sentiment;

    segments.push({
      visual,
      chars: parsed.clean.length,
      breakTime: parsed.breakTime,
      tagPause: parsed.tagPause,
      sentiment,
      imageIndex: segments.length,
    });
  }

  if (segments.length === 0) return [];

  // ─── WHISPER PATH (primary) ────────────────────────────────────────────────────
  // Try to get exact word timestamps from Whisper for precise per-image durations.
  let whisperDurations: number[] | null = null;
  if (audioPath) {
    try {
      const whisperResult = await runWhisper(audioPath);
      if (whisperResult && whisperResult.segments.length > 0) {
        const allWords = whisperResult.segments.flatMap((s) => s.words || []);
        if (allWords.length > 5) {
          whisperDurations = alignWhisperToImages(dirImages, allWords);
        }
      }
    } catch {
      // Whisper failed, fall through
    }
  }

  // Fallback: silence detection + char proportion
  const silences = audioPath && !whisperDurations ? await detectSilences(audioPath) : [];

  const { speech: speechSegments, totalSilence } = !whisperDurations && silences.length > 0
    ? buildSpeechSegments(totalAudioDuration, silences)
    : { speech: [], totalSilence: 0 };

  const totalChars = segments.reduce((s, seg) => s + seg.chars, 0);
  const totalParsedBreaks = segments.reduce((s, seg) => s + seg.breakTime, 0);
  const totalTagPause = segments.reduce((s, seg) => s + seg.tagPause, 0);

  const result: ImageMeta[] = [];
  let prevSentiment: Sentiment | null = null;

  if (whisperDurations) {
    // ─── WHISPER TIMING PATH ────────────────────────────────────────────────────
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segDuration = i < whisperDurations.length ? whisperDurations[i] : seg.chars / 10;

      const sentiment = seg.sentiment;
      const prevIntensity = prevSentiment ? SENTIMENT_INTENSITY[prevSentiment] : SENTIMENT_INTENSITY[sentiment];
      const escalation = SENTIMENT_INTENSITY[sentiment] - prevIntensity;
      prevSentiment = sentiment;

      const transition = sentimentToTransition(sentiment, prevSentiment, i, segments.length);
      const kenBurns = sentimentToKenBurns(sentiment, escalation);

      result.push({
        path: seg.visual.path,
        fileType: seg.visual.fileType,
        durationInFrames: Math.max(Math.round(segDuration * fps), 90),
        transitionType: transition.type,
        transitionDuration: transition.duration,
        sentiment,
        kenBurnsStart: kenBurns.start,
        kenBurnsEnd: kenBurns.end,
      });
    }
  } else if (speechSegments.length > 0 && totalSilence > 0) {
    // --- SILENCE MEASUREMENT PATH ---
    const breakList: { imageIdx: number; time: number }[] = [];
    for (const seg of segments) {
      if (seg.breakTime > 0) breakList.push({ imageIdx: seg.imageIndex, time: seg.breakTime });
    }

    const silencePerImage = new Array<number>(segments.length).fill(0);
    for (let i = 0; i < Math.min(breakList.length, silences.length); i++) {
      silencePerImage[breakList[i].imageIdx] += silences[i].duration;
    }
    if (breakList.length > silences.length) {
      const unmatchedBreaks = breakList.slice(silences.length);
      const unmatchedParsedSum = unmatchedBreaks.reduce((s, b) => s + b.time, 0);
      if (unmatchedParsedSum > 0) {
        const unmeasuredSilence = totalSilence - breakList.slice(0, silences.length).reduce((s, b) => s + b.time, 0);
        for (const ub of unmatchedBreaks) {
          silencePerImage[ub.imageIdx] += unmeasuredSilence * (ub.time / unmatchedParsedSum);
        }
      }
    }

    const totalAllocatedSilence = silencePerImage.reduce((s, v) => s + v, 0);
    const speechDuration = Math.max(0.1, totalAudioDuration - totalAllocatedSilence);
    const charRate = totalChars > 0 ? totalChars / speechDuration : 10;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const measuredSilence = silencePerImage[i];
      const segSpeechTime = totalChars > 0 ? seg.chars / charRate : 0;
      const segDuration = measuredSilence + seg.tagPause + segSpeechTime;

      const sentiment = seg.sentiment;
      const prevIntensity = prevSentiment ? SENTIMENT_INTENSITY[prevSentiment] : SENTIMENT_INTENSITY[sentiment];
      const escalation = SENTIMENT_INTENSITY[sentiment] - prevIntensity;
      prevSentiment = sentiment;

      const transition = sentimentToTransition(sentiment, prevSentiment, i, segments.length);
      const kenBurns = sentimentToKenBurns(sentiment, escalation);

      result.push({
        path: seg.visual.path,
        fileType: seg.visual.fileType,
        durationInFrames: Math.max(Math.round(segDuration * fps), 90),
        transitionType: transition.type,
        transitionDuration: transition.duration,
        sentiment,
        kenBurnsStart: kenBurns.start,
        kenBurnsEnd: kenBurns.end,
      });
    }
  } else {
    // --- CHAR PROPORTION FALLBACK ---
    const speechDuration = Math.max(0.1, totalAudioDuration - totalParsedBreaks - totalTagPause);
    const charRate = totalChars > 0 ? totalChars / speechDuration : 10;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segSpeechTime = totalChars > 0 ? seg.chars / charRate : 0;
      const segDuration = seg.breakTime + seg.tagPause + segSpeechTime;

      const sentiment = seg.sentiment;
      const prevIntensity = prevSentiment ? SENTIMENT_INTENSITY[prevSentiment] : SENTIMENT_INTENSITY[sentiment];
      const escalation = SENTIMENT_INTENSITY[sentiment] - prevIntensity;
      prevSentiment = sentiment;

      const transition = sentimentToTransition(sentiment, prevSentiment, i, segments.length);
      const kenBurns = sentimentToKenBurns(sentiment, escalation);

      result.push({
        path: seg.visual.path,
        fileType: seg.visual.fileType,
        durationInFrames: Math.max(Math.round(segDuration * fps), 90),
        transitionType: transition.type,
        transitionDuration: transition.duration,
        sentiment,
        kenBurnsStart: kenBurns.start,
        kenBurnsEnd: kenBurns.end,
      });
    }
  }

  // Clamp max 25s per image
  const MAX_FRAMES = Math.round(25 * fps);
  let overflow = true;
  while (overflow) {
    overflow = false;
    let totalClamped = 0;
    let nonClampedCount = 0;
    for (const img of result) {
      if (img.durationInFrames > MAX_FRAMES) {
        totalClamped += img.durationInFrames - MAX_FRAMES;
        img.durationInFrames = MAX_FRAMES;
        overflow = true;
      } else {
        nonClampedCount++;
      }
    }
    if (overflow && nonClampedCount > 0) {
      const extra = Math.floor(totalClamped / nonClampedCount);
      for (const img of result) {
        if (img.durationInFrames < MAX_FRAMES) img.durationInFrames += extra;
      }
    }
  }

  // Adjust rounding + CHAPTER_PAUSE_FRAMES on last image
  const totalAssigned = result.reduce((s, img) => s + img.durationInFrames, 0);
  const targetFrames = Math.round(totalAudioDuration * fps);
  const diff = targetFrames - totalAssigned;
  // FIX: solo absorber el error de redondeo en la última imagen
  // CHAPTER_PAUSE_FRAMES se suma al total de la escena en buildScenes(), no aquí
  if (result.length > 0) result[result.length - 1].durationInFrames += diff;

  return result;
}

function assignFramesFromDirections(
  dirImages: { imageFile: string; transitionToNext: TransitionType; transitionDuration: number; kenBurnsStart: number; kenBurnsEnd: number; sentiment: Sentiment }[],
  allVisuals: { path: string; fileType: "image" | "video" }[],
  totalAudioDuration: number,
  fps: number
): ImageMeta[] {
  const result: ImageMeta[] = [];

  // Map direction imageFile to actual allVisuals path
  for (let i = 0; i < dirImages.length; i++) {
    const dirImg = dirImages[i];
    const visual = allVisuals.find((v) => v.path.endsWith(dirImg.imageFile));
    if (!visual) continue;

    result.push({
      path: visual.path,
      fileType: visual.fileType,
      durationInFrames: 0,
      transitionType: dirImg.transitionToNext,
      transitionDuration: dirImg.transitionDuration,
      sentiment: dirImg.sentiment,
      kenBurnsStart: dirImg.kenBurnsStart,
      kenBurnsEnd: dirImg.kenBurnsEnd,
    });
  }

  if (result.length === 0) return [];

  // Distribute time evenly across images
  const framesPerImage = Math.floor((totalAudioDuration * fps) / result.length);
  const MAX_FRAMES = Math.round(25 * fps);

  for (let i = 0; i < result.length; i++) {
    result[i].durationInFrames = Math.min(
      Math.max(framesPerImage, 90),
      MAX_FRAMES
    );
  }

  // Redistribute clamped overflow
  const MAX_FRAMES2 = Math.round(25 * fps);
  let overflow = true;
  while (overflow) {
    overflow = false;
    let totalClamped = 0;
    let nonClampedCount = 0;
    for (const img of result) {
      if (img.durationInFrames > MAX_FRAMES2) {
        totalClamped += img.durationInFrames - MAX_FRAMES2;
        img.durationInFrames = MAX_FRAMES2;
        overflow = true;
      } else {
        nonClampedCount++;
      }
    }
    if (overflow && nonClampedCount > 0) {
      const extra = Math.floor(totalClamped / nonClampedCount);
      for (const img of result) {
        if (img.durationInFrames < MAX_FRAMES2) img.durationInFrames += extra;
      }
    }
  }

  // Adjust rounding + add CHAPTER_PAUSE_FRAMES to last image
  const totalAssigned = result.reduce((s, img) => s + img.durationInFrames, 0);
  const targetFrames = Math.round(totalAudioDuration * fps);
  const diff = targetFrames - totalAssigned;
  // FIX: solo absorber el error de redondeo en la última imagen
  // CHAPTER_PAUSE_FRAMES se suma al total de la escena en buildScenes(), no aquí
  if (result.length > 0) result[result.length - 1].durationInFrames += diff;

  return result;
}

export async function buildScenes(
  videoDir: string,
  style: ChannelStyle,
  chapterTitles: string[]
): Promise<{
  scenes: Scene[];
  introDuration: number;
  outroDuration: number;
  backgroundMusic?: string;
  introVideo?: string;
  outroVideo?: string;
  musicTracks?: MusicTrack[];
}> {
  const chapters = detectChapters(videoDir);

  if (chapters.length === 0) {
    throw new Error("No se encontraron capítulos en: " + videoDir);
  }

  const FPS = 30;
  const INTRO_FRAMES = FPS * 8;   // 8s intro for YouTube hook
  const OUTRO_FRAMES = FPS * 12;  // 12s outro with end screen zone

  const recursosDir = path.join(videoDir, "recursos");
  let backgroundMusic: string | undefined;
  let introVideo: string | undefined;
  let outroVideo: string | undefined;
  const musicTrackPaths: string[] = [];

  if (fs.existsSync(recursosDir)) {
    const recursos = fs.readdirSync(recursosDir).sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? "9999", 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? "9999", 10);
      return numA - numB;
    });
    for (const r of recursos) {
      const ext = path.extname(r).toLowerCase();
      const fullPath = path.join(recursosDir, r);
      if (ext === ".mp3" && !r.includes("narracion")) {
        musicTrackPaths.push(getAssetPath("recursos", r));
        if (!backgroundMusic) backgroundMusic = getAssetPath("recursos", r);
      } else if (VALID_VIDEO_EXTS.includes(ext) && r.toLowerCase().includes("intro")) {
        introVideo = getAssetPath("recursos", r);
      } else if (VALID_VIDEO_EXTS.includes(ext) && r.toLowerCase().includes("outro")) {
        outroVideo = getAssetPath("recursos", r);
      }
    }
  }

  const chapterTitlesFromFile = parseChapterTitles(videoDir);
  const guionData = parseGuionChapters(videoDir);

  // ─── Pre-compute music track durations for gapless distribution ──────────────
  const trackDurations: number[] = [];
  for (const mp of musicTrackPaths) {
    const fsPath = path.join(videoDir, "recursos", path.basename(mp));
    if (fs.existsSync(fsPath)) {
      trackDurations.push(await getAudioDuration(fsPath));
    } else {
      trackDurations.push(120);
    }
  }

  const scenes: Scene[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapterDir = path.join(videoDir, getChapterLabel(i));

    if (!fs.existsSync(chapterDir)) {
      console.warn(`   ⚠️  Capítulo ${i + 1}: carpeta no encontrada, saltando`);
      continue;
    }

    const files = fs.readdirSync(chapterDir);
    const audioFile = files.find((f) => VALID_AUDIO_EXTS.includes(path.extname(f).toLowerCase()));
    const images: { path: string; fileType: "image" | "video" }[] = files
      .filter((f) => VALID_IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => ({ path: getAssetPath(getChapterLabel(i), f), fileType: "image" as const }));
    const videoClips: { path: string; fileType: "image" | "video" }[] = files
      .filter((f) => VALID_VIDEO_EXTS.includes(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => ({ path: getAssetPath(getChapterLabel(i), f), fileType: "video" as const }));

    const allVisuals = [...images, ...videoClips];

    if (!audioFile) console.warn(`   ⚠️  Capítulo ${i + 1}: sin audio, usando 10s default`);
    if (allVisuals.length === 0) console.warn(`   ⚠️  Capítulo ${i + 1}: sin imágenes ni videos`);

    const audioFsPath = audioFile ? path.join(chapterDir, audioFile) : "";
    const audioPath = audioFile ? getAssetPath(getChapterLabel(i), audioFile) : "";
    const audioDuration = audioFsPath ? await getAudioDuration(audioFsPath) : 10;

    let imageMetas: ImageMeta[] = [];
    let chapterClimate: Climate | undefined;
    let chapterSilences: { startFrame: number; endFrame: number; durationInFrames: number }[] | undefined;

    if (allVisuals.length > 0) {
      // Try direction file first (generated by AI agent)
      const directionsPath = path.join(videoDir, "direccion.json");
      let useDirections = false;
      if (fs.existsSync(directionsPath)) {
        try {
          const directions = JSON.parse(fs.readFileSync(directionsPath, "utf-8"));
          const chapterDir = directions.scenes.find((s: { chapterIndex: number }) => s.chapterIndex === i);
          if (chapterDir) {
            chapterClimate = chapterDir.climate;
            chapterSilences = (chapterDir.silences || []).map((s: { startFrame: number; endFrame: number; durationInFrames: number }) => ({
              startFrame: s.startFrame,
              endFrame: s.endFrame,
              durationInFrames: s.durationInFrames,
            }));
          }
          if (chapterDir && chapterDir.images.length > 0) {
            // Check for pre-computed durations from sync-durations
            const allHaveDuration = chapterDir.images.every(
              (img: { durationInFrames?: number }) => typeof img.durationInFrames === "number" && img.durationInFrames > 0
            );
            if (allHaveDuration) {
              imageMetas = chapterDir.images.map((img: { imageFile: string; durationInFrames: number; sentiment: Sentiment; transitionToNext: TransitionType; transitionDuration: number; kenBurnsStart: number; kenBurnsEnd: number; protagonist?: string }) => {
                const visual = allVisuals.find((v) => v.path.endsWith(img.imageFile));
                return {
                  path: visual?.path || img.imageFile,
                  fileType: "image" as const,
                  durationInFrames: img.durationInFrames,
                  transitionType: img.transitionToNext,
                  transitionDuration: img.transitionDuration,
                  sentiment: img.sentiment,
                  kenBurnsStart: img.kenBurnsStart,
                  kenBurnsEnd: img.kenBurnsEnd,
                  protagonist: img.protagonist,
                };
              });
              // FIX: solo distribuir la diferencia de redondeo entre las imágenes
              // CHAPTER_PAUSE_FRAMES se suma al total de la escena en scenes.push(), no aquí
              const whisperSum = imageMetas.reduce((s: number, img: { durationInFrames: number }) => s + img.durationInFrames, 0);
              const audioFrames = Math.round(audioDuration * FPS);
              const extraFrames = Math.max(0, audioFrames - whisperSum);
              if (extraFrames > 0 && imageMetas.length > 0) {
                let distributed = 0;
                const lastIdx = imageMetas.length - 1;
                for (let i = 0; i < imageMetas.length; i++) {
                  const extra = i < lastIdx
                    ? Math.round(extraFrames * imageMetas[i].durationInFrames / whisperSum)
                    : extraFrames - distributed;
                  imageMetas[i].durationInFrames += extra;
                  distributed += extra;
                }
              }
            } else {
              const totalFrames = Math.round(audioDuration * FPS);
              const imgChars = chapterDir.images.map(
                (img: { textInclude?: string }) => cleanTextInclude(img.textInclude || "").length
              );
              const totalImgChars = imgChars.reduce((s: number, c: number) => s + c, 0);
              let sumRaw = 0;
              const rawFrames: number[] = [];
              for (let ci = 0; ci < chapterDir.images.length; ci++) {
                const raw = totalImgChars > 0
                  ? Math.round((imgChars[ci] / totalImgChars) * totalFrames)
                  : Math.floor(totalFrames / chapterDir.images.length);
                rawFrames.push(raw);
                sumRaw += raw;
              }
              if (rawFrames.length > 0) rawFrames[rawFrames.length - 1] += totalFrames - sumRaw;
              imageMetas = chapterDir.images.map((img: { imageFile: string; transitionToNext: TransitionType; transitionDuration: number; sentiment: Sentiment; kenBurnsStart: number; kenBurnsEnd: number; protagonist?: string }, idx: number) => {
                const visual = allVisuals.find((v) => v.path.endsWith(img.imageFile));
                return {
                  path: visual?.path || img.imageFile,
                  fileType: "image" as const,
                  durationInFrames: Math.max(rawFrames[idx] || 0, Math.round(FPS * 1)),
                  transitionType: img.transitionToNext,
                  transitionDuration: img.transitionDuration,
                  sentiment: img.sentiment,
                  kenBurnsStart: img.kenBurnsStart,
                  kenBurnsEnd: img.kenBurnsEnd,
                  protagonist: img.protagonist,
                };
              });
            }
            useDirections = true;
          }
        } catch (e) {
          console.warn(`   ⚠️  Error reading direccion.json for chapter ${i + 1}, falling back to algorithm`);
        }
      }

      if (!useDirections) {
        const chapterGuion = guionData.find((g) => g.chapterIndex === i);

        if (chapterGuion) {
          imageMetas = assignImagesToParagraphs(
            allVisuals,
            chapterGuion.paragraphs,
            chapterGuion.breaks,
            chapterGuion.tagPauses,
            chapterGuion.wpmFactors,
            audioDuration,
            FPS,
            i
          );
        } else {
          const equalDur = Math.round((audioDuration * FPS) / Math.max(allVisuals.length, 1));
          imageMetas = allVisuals.map((img, idx) => ({
            ...img,
            durationInFrames: idx === allVisuals.length - 1
              ? Math.round(audioDuration * FPS) - equalDur * (allVisuals.length - 1)
              : equalDur,
            transitionType: "fade" as TransitionType,
            transitionDuration: 0.8,
            sentiment: "calm" as Sentiment,
            kenBurnsStart: 1.0,
            kenBurnsEnd: 1.08,
          }));
        }
      }
    }

    const title = chapterTitlesFromFile[i] || chapterTitles[i] || `Capítulo ${i + 1}`;

    scenes.push({
      chapterIndex: i,
      title,
      audioPath,
      audioDurationSeconds: audioDuration,
      durationInFrames: imageMetas.reduce((s: number, img: { durationInFrames: number }) => s + img.durationInFrames, 0) + CHAPTER_PAUSE_FRAMES,
      images: imageMetas,
      climate: chapterClimate,
      silences: chapterSilences,
    });

    console.log(
      `   ✓ Capítulo ${i + 1}: "${title}" — ${audioDuration.toFixed(1)}s, ${allVisuals.length} visual(es), ` +
      `transiciones: ${[...new Set(imageMetas.map((m) => m.transitionType))].join(", ")}`
    );
  }

  // ─── Chapter-aligned music track distribution ──────────────────────────────
  const CROSSFADE_FRAMES = 90;
  const musicTracks: MusicTrack[] = [];

  const sequencesTotal = INTRO_FRAMES
    + scenes.reduce((sum: number, s: { durationInFrames: number }) => sum + s.durationInFrames, 0)
    + OUTRO_FRAMES;
  const interChapterTransitions = scenes.length > 1 ? (scenes.length - 1) * 1 : 0;
  const transitionsTotal = (scenes.length > 0 ? 2 : 0) * TRANSITION_FRAMES + interChapterTransitions;
  const visualTotal = sequencesTotal - transitionsTotal;

  if (musicTrackPaths.length > 0) {
    // Chapter boundaries: absolute frame where each chapter starts
    const boundaries: number[] = [INTRO_FRAMES];
    for (const s of scenes) {
      boundaries.push(boundaries[boundaries.length - 1] + s.durationInFrames);
    }

    // Build trackSchedule override map: chapterIndex → trackFilename
    const scheduleOverrides = new Map<number, string>();
    if (style.trackSchedule) {
      for (const [chStr, trackFile] of Object.entries(style.trackSchedule)) {
        const chIdx = parseInt(chStr, 10) - 1;
        if (chIdx >= 0 && chIdx < scenes.length) {
          scheduleOverrides.set(chIdx, trackFile);
        }
      }
    }

    // Sequential track pool
    const seqTracks = musicTrackPaths.map((p, i) => ({
      path: p,
      durFrames: Math.round(trackDurations[i] * FPS),
      trackNumber: extractTrackNumber(p),
    }));

    interface SegInfo {
      path: string;
      startChapter: number;
      endChapter: number;
      durFrames: number;
      trackNumber: number;
    }

    const segments: SegInfo[] = [];
    let seqIdx = 0;
    let chIdx = 0;

    while (chIdx < scenes.length) {
      let trackPath: string;
      let trackDur: number;
      let trackNum: number;

      if (scheduleOverrides.has(chIdx)) {
        const overrideFile = scheduleOverrides.get(chIdx)!;
        trackPath = getAssetPath("recursos", overrideFile);
        const fsPath = path.join(videoDir, "recursos", path.basename(overrideFile));
        const durSec = fs.existsSync(fsPath) ? await getAudioDuration(fsPath) : 120;
        trackDur = Math.round(durSec * FPS);
        trackNum = extractTrackNumber(overrideFile);
      } else {
        if (seqIdx >= seqTracks.length) {
          console.warn(`   ⚠️  Se acabaron las pistas de música secuenciales en capítulo ${chIdx + 1}`);
          break;
        }
        trackPath = seqTracks[seqIdx].path;
        trackDur = seqTracks[seqIdx].durFrames;
        trackNum = seqTracks[seqIdx].trackNumber;
        seqIdx++;
      }

      const startCH = chIdx;
      let remaining = trackDur;
      const isLastTrack = seqIdx >= seqTracks.length;

      // Cover as many full consecutive chapters as possible
      while (chIdx < scenes.length) {
        // Non-override tracks: stop before an override boundary
        if (!scheduleOverrides.has(startCH) && chIdx > startCH && scheduleOverrides.has(chIdx)) {
          break;
        }
        const chDur = scenes[chIdx].durationInFrames;
        if (isLastTrack || remaining >= chDur) {
          remaining -= chDur;
          chIdx++;
        } else {
          break;
        }
      }

      // Safety: force at least one chapter per segment
      if (chIdx === startCH) {
        chIdx = startCH + 1;
      }

      segments.push({
        path: trackPath,
        startChapter: startCH,
        endChapter: chIdx - 1,
        durFrames: trackDur,
        trackNumber: trackNum,
      });

      // If this was an override, skip any sequential tracks matching the same file
      if (scheduleOverrides.has(startCH)) {
        const overrideFile = scheduleOverrides.get(startCH)!;
        while (seqIdx < seqTracks.length && path.basename(seqTracks[seqIdx].path) === overrideFile) {
          seqIdx++;
        }
      }
    }

    // Convert segments to MusicTrack[]
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const bStart = boundaries[seg.startChapter];
      const bEnd = boundaries[seg.endChapter + 1];
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;

      const actualStart = isFirst ? 0 : bStart - CROSSFADE_FRAMES;
      const actualEnd = isLast ? visualTotal : bEnd + CROSSFADE_FRAMES;
      const dur = actualEnd - actualStart;

      musicTracks.push({
        path: seg.path,
        startFrame: Math.max(0, actualStart),
        durationInFrames: Math.max(CROSSFADE_FRAMES, dur),
        actualFrames: seg.durFrames,
        trackNumber: seg.trackNumber,
        chapterStart: seg.startChapter,
        chapterEnd: seg.endChapter,
      });
    }
  }

  // ─── Fallback: single track for entire video ──────────────────────────
  if (musicTracks.length === 0 && backgroundMusic) {
    musicTracks.push({
      path: backgroundMusic,
      startFrame: 0,
      durationInFrames: visualTotal,
      actualFrames: visualTotal,
      trackNumber: 0,
    });
  }



  return {
    scenes,
    introDuration: INTRO_FRAMES,
    outroDuration: OUTRO_FRAMES,
    backgroundMusic,
    introVideo,
    outroVideo,
    musicTracks: musicTracks.length > 0 ? musicTracks : undefined,
  };
}
