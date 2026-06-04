import * as fs from "node:fs";
import * as path from "node:path";
import { inferStyle, parseCanalMd } from "./infer-style";
import type { ChannelStyle } from "../types";

interface CreateStructureArgs {
  baseContentDir: string;
  channelName: string;
  videoTitle: string;
  scriptText: string;
}

function parseChapters(scriptText: string): { index: number; title: string }[] {
  const lines = scriptText.split("\n");
  const chapters: { index: number; title: string }[] = [];
  let chapterCounter = 0;

  const chapterRegex = /^#{1,3}\s+.*?(?:cap[ií]tulo|parte|secci[oó]n)\s+(\d+|[ivxlcdm]+)[.:]?\s*(.*)$/i;

  for (const line of lines) {
    const match = line.match(chapterRegex);
    if (match) {
      chapterCounter++;
      chapters.push({
        index: chapterCounter - 1,
        title: match[2]?.trim() || `Capítulo ${chapterCounter}`,
      });
    }
  }

  if (chapters.length === 0) {
    chapters.push({ index: 0, title: "Único Capítulo" });
  }

  return chapters;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function listChannels(contentDir: string): string[] {
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir).filter((d) => {
    const canalMd = path.join(contentDir, d, "canal.md");
    return fs.statSync(path.join(contentDir, d)).isDirectory() && fs.existsSync(canalMd);
  });
}

function createCanalMd(channelDir: string, style: ChannelStyle): void {
  const md = `# ${style.channelName}

## Descripción
Canal de tipo ${style.mood.toLowerCase()}.

## Estilo visual
- **Color primario:** ${style.primaryColor}
- **Color secundario:** ${style.secondaryColor}
- **Color de fondo:** ${style.backgroundColor}
- **Tipografía:** ${style.fontFamily}
- **Transición:** ${style.transitionType}
- **Duración de transición:** ${style.transitionDuration} segundos
- **Ambiente:** ${style.mood}

## Configuración de video
- **Intro:** 5 segundos
- **Outro:** 5 segundos
- **Resolución:** 1920×1080
- **FPS:** 30

## Narrativa
_Describe aquí el estilo narrativo del canal._
`;
  fs.writeFileSync(path.join(channelDir, "canal.md"), md, "utf-8");
}

function createContentStructure(args: CreateStructureArgs): {
  dir: string;
  style: ChannelStyle;
  chapterDirs: string[];
} {
  const { baseContentDir, channelName, videoTitle, scriptText } = args;
  const date = new Date().toISOString().split("T")[0];
  const videoSlug = slugify(videoTitle);
  const videoDirName = `${date}_${videoSlug}`;
  const channelDir = path.join(baseContentDir, channelName);
  const videoDir = path.join(channelDir, videoDirName);

  const chapters = parseChapters(scriptText);

  fs.mkdirSync(channelDir, { recursive: true });

  const canalMdPath = path.join(channelDir, "canal.md");
  let style: ChannelStyle;

  if (fs.existsSync(canalMdPath)) {
    const parsed = parseCanalMd(canalMdPath);
    style = {
      channelName: parsed.channelName || channelName,
      videoTitle,
      primaryColor: parsed.primaryColor || "#e0e0e0",
      secondaryColor: parsed.secondaryColor || "#1a1a2e",
      backgroundColor: parsed.backgroundColor || "#0d0d0d",
      fontFamily: parsed.fontFamily || "Inter, sans-serif",
      transitionType: parsed.transitionType || "fade",
      transitionDuration: parsed.transitionDuration || 0.5,
      mood: parsed.mood || "Documental",
    };
    console.log(`   📖 Leyendo estilo desde ${canalMdPath}`);
  } else {
    style = inferStyle(channelName, videoTitle);
    createCanalMd(channelDir, style);
    console.log(`   ✨ Creado canal nuevo: ${canalMdPath}`);
  }

  if (fs.existsSync(videoDir)) {
    throw new Error(`Ya existe un video con ese título: ${videoDir}`);
  }

  fs.mkdirSync(videoDir, { recursive: true });

  fs.writeFileSync(path.join(videoDir, "guion.md"), scriptText, "utf-8");

  fs.writeFileSync(
    path.join(videoDir, "config.json"),
    JSON.stringify(style, null, 2),
    "utf-8"
  );

  const chapterDirs: string[] = [];

  for (const chapter of chapters) {
    const chapterLabel = `capitulo-${String(chapter.index + 1).padStart(2, "0")}`;
    const chapterDir = path.join(videoDir, chapterLabel);
    fs.mkdirSync(chapterDir, { recursive: true });
    chapterDirs.push(chapterDir);
  }

  fs.writeFileSync(
    path.join(videoDir, "INSTRUCCIONES.md"),
    generateInstructions(chapters, style),
    "utf-8"
  );

  const recursosDir = path.join(videoDir, "recursos");
  fs.mkdirSync(recursosDir, { recursive: true });

  console.log(`\n✅ Estructura creada: ${videoDir}\n`);
  console.log(`📁 Video: ${videoDir}`);
  console.log(`📄 Guion: capítulos detectados: ${chapters.length}`);
  console.log(`⚙️  Estilo: ${style.primaryColor} | ${style.transitionType} | ${style.mood}`);
  console.log(`📖 Instrucciones: ${path.join(videoDir, "INSTRUCCIONES.md")}\n`);

  for (const chapter of chapters) {
    const dir = `capitulo-${String(chapter.index + 1).padStart(2, "0")}`;
    console.log(`   📂 ${dir}/  → narracion.mp3 + imágenes`);
  }
  console.log(`   📂 recursos/  → intro/outro/música (opcional)`);

  return { dir: videoDir, style, chapterDirs };
}

function generateInstructions(
  chapters: { index: number; title: string }[],
  style: ChannelStyle
): string {
  return `# Instrucciones para llenar el contenido del video

## Estilo del canal
- **Canal:** ${style.channelName}
- **Tema:** ${style.videoTitle}
- **Paleta:** ${style.primaryColor} | ${style.secondaryColor} | ${style.backgroundColor}
- **Transiciones:** ${style.transitionType}
- **Ambiente:** ${style.mood}

## Estructura de carpetas

Cada capítulo tiene su propia carpeta \`capitulo-NN/\`. Debes llenar cada una así:

### Por capitulo (obligatorio):
- \`narracion.mp3\` — Audio de narración del capítulo (MP3, 1 archivo)
- \`img-01.jpg\`, \`img-02.jpg\`, ... — Imágenes para el slideshow (al menos 1)

### Por capitulo (opcional):
- \`clip.mp4\` — Video clip para insertar en el capítulo

### Recursos globales (opcional):
- \`recursos/intro.mp4\` — Video de introducción
- \`recursos/outro.mp4\` — Video de cierre
- \`recursos/musica.mp3\` — Música de fondo

## Reglas
1. El audio debe durar EXACTAMENTE lo que quieras que dure el capítulo
2. Las imágenes se mostrarán en orden alfabético
3. Si pones videos, pueden tener su propio audio
4. Una vez lleno todo, ejecuta el agente nuevamente para validar y renderizar
`;
}

if (process.argv[1]?.endsWith("create-structure.ts")) {
  const args = process.argv.slice(2);
  let channelName = "";
  let videoTitle = "";
  let scriptText = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--canal") channelName = args[++i];
    else if (args[i] === "--titulo" || args[i] === "--tema") videoTitle = args[++i];
    else if (args[i] === "--guion") scriptText = args[++i];
  }

  const run = async () => {
    if (!channelName || !videoTitle) {
      const readline = await import("node:readline/promises");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      try {
        const channels = listChannels(path.resolve(process.cwd(), "content"));
        if (channels.length > 0) {
          console.log("\nCanales disponibles:");
          channels.forEach((c, i) => {
            const canalMd = path.join(process.cwd(), "content", c, "canal.md");
            let mood = "";
            if (fs.existsSync(canalMd)) {
              const parsed = parseCanalMd(canalMd);
              mood = parsed.mood ? ` (${parsed.mood})` : "";
            }
            console.log(`  ${i + 1}. ${c}${mood}`);
          });
          console.log("  n. Nuevo canal");
          const answer = await rl.question("\nElige un canal (número) o 'n' para nuevo: ");
          if (answer.toLowerCase() === "n") {
            channelName = await rl.question("Nombre del nuevo canal: ");
          } else {
            const idx = parseInt(answer, 10) - 1;
            if (idx >= 0 && idx < channels.length) {
              channelName = channels[idx];
            } else {
              channelName = await rl.question("Nombre del canal: ");
            }
          }
        } else {
          channelName = await rl.question("Nombre del canal: ");
        }
        videoTitle = await rl.question("Título del video: ");
        console.log("Pega el guion (## para capítulos, Ctrl+Z luego Enter para terminar):");
        const lines: string[] = [];
        for await (const line of rl) {
          lines.push(line);
        }
        scriptText = lines.join("\n");

        if (!scriptText.trim()) {
          const defaultScript = `# ${videoTitle}\n\n## Capítulo 1: Introducción\n\nContenido del capítulo 1...\n\n## Capítulo 2: Desarrollo\n\nContenido del capítulo 2...\n`;
          console.log("Usando guion por defecto.");
          scriptText = defaultScript;
        }
      } finally {
        rl.close();
      }
    }

    createContentStructure({
      baseContentDir: path.resolve(process.cwd(), "content"),
      channelName,
      videoTitle,
      scriptText,
    });
  };

  run().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  });
}

export { createContentStructure, parseChapters, generateInstructions, listChannels, parseCanalMd, createCanalMd };
