import * as fs from "node:fs";
import * as path from "node:path";
import { buildScenes } from "./build-scenes";
import { detectChapters } from "./validate-content";
import type { ChannelStyle } from "../types";

async function validateTiming(videoDir: string): Promise<void> {
  const configPath = path.join(videoDir, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`No se encontró config.json en: ${videoDir}`);
  }

  const style: ChannelStyle = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const chapters = detectChapters(videoDir);
  const chapterTitles = chapters.map((c) => c.title);

  console.log(`\n📋 Validando timing desde: ${videoDir}\n`);

  const sceneData = await buildScenes(videoDir, style, chapterTitles);

  const outputPath = path.join(videoDir, "timing-validation.md");
  const lines: string[] = [];

  lines.push(`# Validación de Timing — ${style.videoTitle}`);
  lines.push(``);
  lines.push(`**Canal:** ${style.channelName}`);
  lines.push(`**Duración total:** ${(sceneData.scenes.reduce((s, sc) => s + sc.durationInFrames, 0) / 30).toFixed(1)}s`);
  lines.push(`**Pistas de música:** ${sceneData.musicTracks?.length || 0}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  for (const scene of sceneData.scenes) {
    const totalFrames = scene.durationInFrames;
    const totalSecs = (totalFrames / 30).toFixed(1);
    const audioSecs = scene.audioDurationSeconds.toFixed(1);

    lines.push(`## Capítulo ${scene.chapterIndex + 1}: "${scene.title}"`);
    lines.push(``);
    lines.push(`| # | Imagen | Transición | Sentimiento | Duración | Frame inicio | Notas |`);
    lines.push(`|---|--------|-----------|-------------|----------|-------------|-------|`);

    let accFrames = 0;
    for (let i = 0; i < scene.images.length; i++) {
      const img = scene.images[i];
      const durSecs = (img.durationInFrames / 30).toFixed(1);
      const startFrame = accFrames;
      const sentiment = img.sentiment;
      const notes = img.durationInFrames >= 750 ? "⚠️ Max (25s)" : "";

      lines.push(
        `| ${i + 1} | \`${path.basename(img.path)}\` | ${img.transitionType} | ${sentiment} | ${durSecs}s (${img.durationInFrames}f) | ${startFrame} | ${notes} |`
      );

      accFrames += img.durationInFrames;
    }

    const diff = Math.abs(totalFrames - accFrames);
    const match = diff <= 1 ? "✓" : `✗ (diferencia: ${diff}f)`;

    lines.push(`| **Total** | **${scene.images.length} imágenes** | | | **${totalSecs}s (${totalFrames}f)** | ${match} |`);
    lines.push(``);
    lines.push(`**Audio:** ${audioSecs}s — **Asignado:** ${totalSecs}s — ${Math.abs(parseFloat(audioSecs) - parseFloat(totalSecs)) < 0.5 ? "✅ Coincide" : "⚠️ Diferencia: " + (parseFloat(totalSecs) - parseFloat(audioSecs)).toFixed(1) + "s"}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  lines.push(`## Resumen General`);
  lines.push(``);
  const totalAudio = sceneData.scenes.reduce((s, sc) => s + sc.audioDurationSeconds, 0);
  const totalVideo = sceneData.scenes.reduce((s, sc) => s + sc.durationInFrames / 30, 0);
  lines.push(`- **Audio total:** ${totalAudio.toFixed(1)}s`);
  lines.push(`- **Video total:** ${totalVideo.toFixed(1)}s`);
  lines.push(`- **Diferencia:** ${(totalVideo - totalAudio).toFixed(1)}s`);
  lines.push(`- **Estado:** ${Math.abs(totalVideo - totalAudio) < 1 ? "✅ Correcto" : "⚠️ Revisar"}`);
  lines.push(``);
  lines.push(`*Generado el ${new Date().toISOString().split("T")[0]}*`);

  const content = lines.join("\n");
  fs.writeFileSync(outputPath, content, "utf-8");

  console.log(`   ✅ Validación guardada en: ${outputPath}`);

  // Quick summary per chapter
  for (const scene of sceneData.scenes) {
    const secs = (scene.durationInFrames / 30).toFixed(1);
    const imgCount = scene.images.length;
    const sentiments = [...new Set(scene.images.map((i) => i.sentiment))];
    const transitions = [...new Set(scene.images.map((i) => i.transitionType))];
    console.log(
      `   ${String(scene.chapterIndex + 1).padStart(2)}: "${scene.title}" → ${secs}s, ${imgCount}img, ` +
      `[${sentiments.join(", ")}], [${transitions.join(", ")}]`
    );
  }
}

const args = process.argv.slice(2);
const videoDir = args[0];

if (!videoDir) {
  console.error("❌ Uso: npx tsx src/scripts/validate-timing.ts <directorio-del-video>");
  console.error("   Ej: npx tsx src/scripts/validate-timing.ts content/academia-de-villanos/2026-05-29_mi-video");
  process.exit(1);
}

if (!fs.existsSync(videoDir)) {
  console.error(`❌ El directorio no existe: ${videoDir}`);
  process.exit(1);
}

validateTiming(videoDir)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  });
