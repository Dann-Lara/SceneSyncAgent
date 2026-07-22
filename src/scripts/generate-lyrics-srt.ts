import * as fs from "node:fs";
import * as path from "node:path";

/** Only filter segments whose text is ENTIRELY or STARTS WITH garbage.
 *  Avoid matching lyrics that happen to contain these words. */
const GARBAGE_SEGMENTS = [
  "música",
  "musica",
  "suscríbete al",
  "suscribete al",
  "subtítulos",
  "subtitle",
];

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")},${String(cs).padStart(3, "0")}`;
}

function clean(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-záéíóúüñ0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** What fraction of lyric words appear in the segment text */
function wordRecall(lyric: string, whisperText: string): number {
  const wa = clean(lyric).split(/\s+/).filter(Boolean);
  const wb = clean(whisperText).split(/\s+/).filter(Boolean);
  if (wa.length === 0) return 0;
  if (wb.length === 0) return 0;
  let matches = 0;
  for (const w of wa) {
    if (wb.includes(w)) matches++;
  }
  return matches / wa.length;
}

function generateLyricsSrt(videoDir: string): void {
  const autoriaDir = path.join(videoDir, "autoria");
  if (!fs.existsSync(autoriaDir)) {
    console.error("❌ No se encontró autoria/");
    process.exit(1);
  }

  // Find Whisper JSON
  const jsonFile = fs.readdirSync(autoriaDir).find(
    (f) => f.endsWith(".json") && f !== "letra.txt"
  );
  if (!jsonFile) {
    console.error("❌ No se encontró archivo JSON de Whisper en autoria/");
    process.exit(1);
  }

  // Read lyrics
  const lyricsPath = path.join(autoriaDir, "letra.txt");
  if (!fs.existsSync(lyricsPath)) {
    console.error("❌ No se encontró autoria/letra.txt — pon ahí la letra (1 línea por entrada)");
    process.exit(1);
  }

  // ─── Read inputs ────────────────────────────────────────────────────────────
  const whisper: WhisperResult = JSON.parse(
    fs.readFileSync(path.join(autoriaDir, jsonFile), "utf-8")
  );
  const lyricsRaw = fs.readFileSync(lyricsPath, "utf-8").trim();
  const lyricLines = lyricsRaw.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lyricLines.length === 0) {
    console.error("❌ letra.txt está vacío");
    process.exit(1);
  }

  console.log(`   Whisper: ${whisper.segments.length} segmentos`);
  console.log(`   Letra: ${lyricLines.length} líneas`);

  // ─── Filter garbage segments ────────────────────────────────────────────────
  const cleanSegments: WhisperSegment[] = whisper.segments.filter((s) => {
    const t = s.text.toLowerCase().trim();
    if (t.length < 3) return false;
    // Only remove if the ENTIRE segment IS the garbage, or starts with it
    // (e.g. "Música", "Suscríbete al canal!", "Subtítulos de...")
    return !GARBAGE_SEGMENTS.some((p) => t === p || t.startsWith(p));
  });

  const removedCount = whisper.segments.length - cleanSegments.length;
  if (removedCount > 0) {
    console.log(`   🗑️ Filtrados ${removedCount} segmentos basura`);
  }

  if (cleanSegments.length === 0) {
    console.error("❌ No quedan segmentos después de filtrar");
    process.exit(1);
  }

  const numSegs = cleanSegments.length;
  const numLines = lyricLines.length;

  // ─── Word-recall matching ───────────────────────────────────────────────────
  // Build a score matrix: score[lineIdx][segIdx] = wordRecall
  const scores: number[][] = lyricLines.map((line) =>
    cleanSegments.map((seg) => wordRecall(line, seg.text))
  );

  // Proportional initial guess, then refine within ±5 window.
  const WINDOW = 5;
  const assignment: number[] = new Array(numLines).fill(0);
  for (let i = 0; i < numLines; i++) {
    assignment[i] = Math.round(i * (numSegs - 1) / (numLines - 1));
  }
  for (let i = 1; i < numLines; i++) {
    if (assignment[i] < assignment[i - 1]) assignment[i] = assignment[i - 1];
  }

  for (let i = 0; i < numLines; i++) {
    const cur = assignment[i];
    const prev = i > 0 ? assignment[i - 1] : -1;
    const lo = Math.max(0, prev, cur - WINDOW);
    const hi = Math.min(numSegs - 1, cur + WINDOW);
    if (lo > hi) continue;

    let bestSeg = -1;
    let bestScore = -1;
    for (let n = lo; n <= hi; n++) {
      if (scores[i][n] > bestScore) {
        bestScore = scores[i][n];
        bestSeg = n;
      }
    }
    if (bestSeg >= 0) assignment[i] = bestSeg;
  }

  // ─── Build SRT ──────────────────────────────────────────────────────────────
  // Group lines sharing the same segment, then subdivide time
  const segGroups: number[][] = Array.from({ length: numSegs }, () => []);
  for (let i = 0; i < numLines; i++) segGroups[assignment[i]].push(i);

  const srtTimes: { start: number; end: number }[] = new Array(numLines);
  for (let segIdx = 0; segIdx < numSegs; segIdx++) {
    const group = segGroups[segIdx];
    if (group.length === 0) continue;
    const seg = cleanSegments[segIdx];
    const lineDuration = (seg.end - seg.start) / group.length;
    for (let j = 0; j < group.length; j++) {
      const li = group[j];
      srtTimes[li] = {
        start: seg.start + j * lineDuration,
        end: seg.start + (j + 1) * lineDuration,
      };
    }
  }

  // Clamp minimum 1.5s and fix boundaries
  for (let i = 0; i < numLines; i++) {
    if (srtTimes[i].end - srtTimes[i].start < 1.5) {
      srtTimes[i].end = srtTimes[i].start + 1.5;
    }
  }
  for (let i = 0; i < numLines - 1; i++) {
    if (assignment[i] !== assignment[i + 1] && srtTimes[i].end > srtTimes[i + 1].start) {
      srtTimes[i].end = srtTimes[i + 1].start;
    }
  }

  // ─── Write ──────────────────────────────────────────────────────────────────
  const srtLines: string[] = [];
  for (let i = 0; i < numLines; i++) {
    const t = srtTimes[i];
    srtLines.push(`${i + 1}`);
    srtLines.push(`${formatSrtTime(t.start)} --> ${formatSrtTime(t.end)}`);
    srtLines.push(lyricLines[i]);
    srtLines.push("");
  }

  const srtPath = path.join(autoriaDir, "letra.srt");
  fs.writeFileSync(srtPath, srtLines.join("\n"), "utf-8");
  console.log(`   ✅ letra.srt generado: ${srtPath}`);
  console.log(`   ${numLines} líneas`);

  // Debug: show assignments
  console.log("   Asignaciones:");
  for (let i = 0; i < numLines; i++) {
    const seg = cleanSegments[assignment[i]];
    const score = scores[i][assignment[i]];
    console.log(`     L${i + 1} -> S${assignment[i]} (${seg.start.toFixed(2)}-${seg.end.toFixed(2)}s, recall:${score.toFixed(2)})`);
  }
}

const videoDir = process.argv[2];
if (!videoDir) {
  console.error("Uso: npx tsx src/scripts/generate-lyrics-srt.ts <directorio-del-video>");
  console.error("Requiere: autoria/*.json (Whisper) + autoria/letra.txt (letra, 1 línea por entrada)");
  process.exit(1);
}
generateLyricsSrt(videoDir);
