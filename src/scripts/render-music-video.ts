import * as fs from "node:fs";
import * as path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { buildMusicVideoScenes } from "./build-music-video-scenes";
import type { VideoInput } from "../types";

async function renderMusicVideo(videoDir: string, outputPath?: string): Promise<void> {
  console.log(`\n🎵 Construyendo video musical desde: ${videoDir}\n`);

  const data = await buildMusicVideoScenes(videoDir);

  const totalSeconds = (data.totalFrames / 30).toFixed(1);
  const totalMinutes = Math.floor(Number(totalSeconds) / 60);
  const remainingSeconds = (Number(totalSeconds) % 60).toFixed(1);
  const timeStr = totalMinutes > 0
    ? `${totalMinutes}m ${remainingSeconds}s`
    : `${remainingSeconds}s`;

  const totalImages = data.scenes.reduce((sum, s) => sum + s.images.length, 0);

  console.log(`📊 Resumen:`);
  console.log(`   Canción: ${data.songPath}`);
  console.log(`   Capítulos: ${data.scenes.length}`);
  console.log(`   Imágenes: ${totalImages}`);
  console.log(`   Intro: ${data.introDuration / 30}s`);
  console.log(`   Outro: ${data.outroDuration / 30}s`);
  console.log(`   Duración: ${timeStr}`);
  console.log(`   Frames: ${data.totalFrames}`);

  const inputProps: VideoInput = {
    channelStyle: data.channelStyle,
    scenes: data.scenes,
    introDuration: data.introDuration,
    outroDuration: data.outroDuration,
    musicTracks: [],
    subtitles: data.subtitles,
    authorName: data.authorName,
  };

  console.log(`\n🔨 Preparando bundle...`);

  const bundleLocation = await bundle({
    entryPoint: path.resolve("src/remotion/MusicRoot.tsx"),
    webpackOverride: (config) => ({
      ...config,
      cache: false,
    }),
  });

  // Copy chapter assets + autoria into the bundle's public/
  const bundlePublicDir = path.join(bundleLocation, "public");
  if (!fs.existsSync(bundlePublicDir)) {
    fs.mkdirSync(bundlePublicDir, { recursive: true });
  }

  const chapterAssets = fs.readdirSync(videoDir).filter((e) => {
    const full = path.join(videoDir, e);
    return fs.statSync(full).isDirectory() && (
      e.startsWith("capitulo-") || e === "recursos" || e === "autoria"
    );
  });
  for (const dir of chapterAssets) {
    await fs.promises.cp(path.join(videoDir, dir), path.join(bundlePublicDir, dir), { recursive: true });
  }

  console.log(`   ✅ Bundle creado en ${path.basename(bundleLocation)}`);
  console.log(`   📦 Assets copiados al bundle public/`);

  console.log(`   Obteniendo composiciones...`);
  const compositions = await getCompositions(bundleLocation, {
    inputProps: {
      ...inputProps,
      songPath: data.songPath,
      totalFrames: data.totalFrames,
    } as unknown as Record<string, unknown>,
  });
  const composition = compositions.find((c) => c.id === "MusicVideo");

  if (!composition) {
    throw new Error("No se encontró la composición 'MusicVideo'");
  }

  const songName = path.basename(data.songPath, path.extname(data.songPath));
  const defaultOutput = path.join(videoDir, `${songName}.mp4`);
  const outputLocation = outputPath || defaultOutput;

  console.log(`\n🎥 Renderizando ${data.totalFrames} frames (${timeStr})...`);

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: data.totalFrames,
      fps: 30,
      width: 1920,
      height: 1080,
    },
    serveUrl: bundleLocation,
    codec: "h264",
    inputProps: {
      ...inputProps,
      songPath: data.songPath,
      totalFrames: data.totalFrames,
      authorName: data.authorName,
    } as unknown as Record<string, unknown>,
    outputLocation,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
      gl: "angle",
    },
  });

  const outputSize = fs.existsSync(outputLocation)
    ? (fs.statSync(outputLocation).size / 1024 / 1024).toFixed(1)
    : "?";
  console.log(`\n✅ Video musical renderizado: ${outputLocation}`);
  console.log(`   Tamaño: ${outputSize} MB`);
}

if (process.argv[1]?.endsWith("render-music-video.ts")) {
  const videoDir = process.argv[2];
  const outputPath = process.argv[3];

  if (!videoDir) {
    console.error("❌ Uso: npx tsx src/scripts/render-music-video.ts <directorio-del-video> [output.mp4]");
    process.exit(1);
  }

  if (!fs.existsSync(videoDir)) {
    console.error(`❌ El directorio no existe: ${videoDir}`);
    process.exit(1);
  }

  renderMusicVideo(videoDir, outputPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error:", err.message);
      process.exit(1);
    });
}

export { renderMusicVideo };
