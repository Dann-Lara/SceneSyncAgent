import * as fs from "node:fs";
import type { ChannelStyle } from "../types";

const styleDatabase: Record<string, Partial<ChannelStyle>> = {
  villanos: {
    primaryColor: "#1a3a5c",
    secondaryColor: "#6b7280",
    backgroundColor: "#0d0d0d",
    fontFamily: "Cinzel, 'Trajan Pro', serif",
    transitionType: "fade",
    transitionDuration: 0.8,
    mood: "",
  },
  tecnología: {
    primaryColor: "#00d4ff",
    secondaryColor: "#0a1628",
    backgroundColor: "#050a18",
    fontFamily: "Inter, sans-serif",
    transitionType: "fade",
    transitionDuration: 0.4,
    mood: "Tecnología · Innovación · Futuro",
  },
  historia: {
    primaryColor: "#c9a84c",
    secondaryColor: "#2c1810",
    backgroundColor: "#1a0f0a",
    fontFamily: "Georgia, serif",
    transitionType: "fade",
    transitionDuration: 0.6,
    mood: "Historia · Misterio · Pasado",
  },
  educación: {
    primaryColor: "#4ade80",
    secondaryColor: "#0f1a14",
    backgroundColor: "#0a0f0c",
    fontFamily: "Inter, sans-serif",
    transitionType: "fade",
    transitionDuration: 0.3,
    mood: "Educación · Aprendizaje · Conocimiento",
  },
  crímenes: {
    primaryColor: "#dc2626",
    secondaryColor: "#1a0f0f",
    backgroundColor: "#0a0505",
    fontFamily: "Georgia, serif",
    transitionType: "fade",
    transitionDuration: 0.7,
    mood: "Misterio · Suspenso · Investigación",
  },
  ciencia: {
    primaryColor: "#22d3ee",
    secondaryColor: "#0a1628",
    backgroundColor: "#050a18",
    fontFamily: "Inter, sans-serif",
    transitionType: "fade",
    transitionDuration: 0.4,
    mood: "Ciencia · Descubrimientos · Innovación",
  },
};

export function inferStyle(
  channelName: string,
  videoTitle: string
): ChannelStyle {
  const lower = channelName.toLowerCase();

  let base: Partial<ChannelStyle> = {};

  for (const [key, style] of Object.entries(styleDatabase)) {
    if (lower.includes(key)) {
      base = { ...style };
      break;
    }
  }

  if (!base.primaryColor) {
    base = {
      primaryColor: "#e0e0e0",
      secondaryColor: "#1a1a2e",
      backgroundColor: "#0d0d0d",
      fontFamily: "Inter, sans-serif",
      transitionType: "fade",
      transitionDuration: 0.5,
      mood: "Documental",
    };
  }

  return {
    channelName,
    videoTitle,
    primaryColor: base.primaryColor || "#e0e0e0",
    secondaryColor: base.secondaryColor || "#1a1a2e",
    backgroundColor: base.backgroundColor || "#0d0d0d",
    fontFamily: base.fontFamily || "Inter, sans-serif",
    transitionType: (base.transitionType as ChannelStyle["transitionType"]) || "fade",
    transitionDuration: base.transitionDuration || 0.5,
    mood: base.mood || "Documental",
  };
}

export function parseCanalMd(mdPath: string): Partial<ChannelStyle> {
  const content = fs.readFileSync(mdPath, "utf-8");
  const lines = content.split("\n");
  const result: Partial<ChannelStyle> = {};

  const nameLine = lines.find((l) => l.startsWith("# ") && l.length > 2);
  if (nameLine) {
    result.channelName = nameLine.replace(/^#\s*/, "").trim();
  }

  const fieldMap: Record<string, keyof ChannelStyle> = {
    "color primario": "primaryColor",
    "color secundario": "secondaryColor",
    "color de fondo": "backgroundColor",
    "tipograf": "fontFamily",
    "transici": "transitionType",
    "duraci.n de transici.n": "transitionDuration",
    "ambiente": "mood",
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const mdMatch = trimmed.match(/^\*\*([^*]+):\*\*\s*(.*)/);
    if (mdMatch) {
      const key = mdMatch[1].toLowerCase().trim();
      const value = mdMatch[2].trim();
      for (const [pattern, field] of Object.entries(fieldMap)) {
        if (key.includes(pattern)) {
          if (field === "transitionDuration") {
            const num = parseFloat(value);
            if (!isNaN(num)) (result as any)[field] = num;
          } else if (field === "transitionType") {
            const v = value.toLowerCase();
            if (v.includes("radial")) (result as any)[field] = "radial";
            else if (v.includes("glitch")) (result as any)[field] = "glitch";
            else if (v.includes("flash")) (result as any)[field] = "flash";
            else if (v.includes("shatter")) (result as any)[field] = "shatter";
            else if (v.includes("crossfade")) (result as any)[field] = "crossfade";
            else (result as any)[field] = "fade";
          } else {
            (result as any)[field] = value;
          }
          break;
        }
      }
    }
  }

  return result;
}
