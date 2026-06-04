import * as fs from "node:fs";
import * as path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { buildScenes } from "./build-scenes";
import { detectChapters } from "./validate-content";
import type { ChannelStyle, VideoInput } from "../types";

async function renderVideo(videoDir: string, outputPath: string): Promise<void> {
  const configPath = path.join(videoDir, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`No se encontró config.json en: ${videoDir}`);
  }

  const style: ChannelStyle = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const chapters = detectChapters(videoDir);
  const chapterTitles = chapters.map((c) => c.title);

  console.log(`\n🎬 Construyendo escenas desde: ${videoDir}\n`);

  const sceneData = await buildScenes(videoDir, style, chapterTitles);

  const inputProps: VideoInput = {
    channelStyle: style,
    scenes: sceneData.scenes,
    introDuration: sceneData.introDuration,
    outroDuration: sceneData.outroDuration,
    backgroundMusic: sceneData.backgroundMusic,
    introVideo: sceneData.introVideo,
    outroVideo: sceneData.outroVideo,
    musicTracks: sceneData.musicTracks,
  };

  const totalFrames =
    inputProps.introDuration +
    inputProps.scenes.reduce((sum, s) => sum + s.durationInFrames, 0) +
    inputProps.outroDuration;

  const totalSeconds = (totalFrames / 30).toFixed(1);
  const totalMinutes = Math.floor(Number(totalSeconds) / 60);
  const remainingSeconds = (Number(totalSeconds) % 60).toFixed(1);
  const timeStr =
    totalMinutes > 0
      ? `${totalMinutes}m ${remainingSeconds}s`
      : `${remainingSeconds}s`;

  console.log(`\n📊 Resumen:`);
  console.log(`   Canción de fondo: ${inputProps.backgroundMusic || "ninguna"}`);
  console.log(`   Pistas de música: ${sceneData.musicTracks?.length || 1}`);
  console.log(`   Intro: ${inputProps.introVideo || "generada"}`);
  console.log(`   Outro: ${inputProps.outroVideo || "generado"}`);
  console.log(`   Duración total: ${timeStr}`);
  console.log(`   Frames totales: ${totalFrames}`);

  console.log(`\n🔨 Preparando bundle...`);

  const bundleLocation = await bundle({
    entryPoint: path.resolve("src/remotion/Root.tsx"),
    webpackOverride: (config) => ({
      ...config,
      cache: false,
    }),
  });

  // Copy chapter assets (capitulo-*/ and recursos/) into the bundle's public/
  // so staticFile() can resolve them during render
  const bundlePublicDir = path.join(bundleLocation, "public");
  if (!fs.existsSync(bundlePublicDir)) {
    fs.mkdirSync(bundlePublicDir, { recursive: true });
  }
  const chapterAssets = fs.readdirSync(videoDir).filter((e) => {
    const full = path.join(videoDir, e);
    return fs.statSync(full).isDirectory() && (e.startsWith("capitulo-") || e === "recursos");
  });
  for (const dir of chapterAssets) {
    await fs.promises.cp(path.join(videoDir, dir), path.join(bundlePublicDir, dir), { recursive: true });
  }

  console.log(`   ✅ Bundle creado en ${path.basename(bundleLocation)}`);
  console.log(`   📦 Assets copiados al bundle public/`);

  console.log(`   Obteniendo composiciones...`);
  const compositions = await getCompositions(bundleLocation, {
    inputProps: inputProps as unknown as Record<string, unknown>,
  });
  const composition = compositions.find((c) => c.id === "Main");

  if (!composition) {
    throw new Error("No se encontró la composición 'Main'");
  }

  console.log(`\n🎥 Renderizando ${totalFrames} frames (${timeStr})...`);

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    serveUrl: bundleLocation,
    codec: "h264",
    inputProps: inputProps as unknown as Record<string, unknown>,
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl: "angle",
    },
  });

  const outputSize = fs.existsSync(outputPath)
    ? (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)
    : "?";
  console.log(`\n✅ Video renderizado: ${outputPath}`);
  console.log(`   Tamaño: ${outputSize} MB`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

if (process.argv[1]?.endsWith("render-video.ts")) {
  const args = process.argv.slice(2);
  const videoDir = args[0];

  if (!videoDir) {
    console.error("❌ Uso: npx tsx src/scripts/render-video.ts <directorio-del-video> [output.mp4]");
    console.error("   Ej: npx tsx src/scripts/render-video.ts content/academia-de-villanos/2026-05-29_mi-video");
    process.exit(1);
  }

  if (!fs.existsSync(videoDir)) {
    console.error(`❌ El directorio no existe: ${videoDir}`);
    process.exit(1);
  }

  let defaultOutput: string;
  const configPath = path.join(videoDir, "config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const slug = slugify(config.videoTitle || "");
    defaultOutput = path.join(videoDir, `${slug}.mp4`);
  } else {
    const videoName = path.basename(videoDir).replace(/^\d{4}-\d{2}-\d{2}_/, "");
    defaultOutput = path.resolve(videoDir, `${videoName}.mp4`);
  }

  const outputPath = args[1] || defaultOutput;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  renderVideo(videoDir, outputPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error:", err.message);
      process.exit(1);
    });
}

export { renderVideo };
