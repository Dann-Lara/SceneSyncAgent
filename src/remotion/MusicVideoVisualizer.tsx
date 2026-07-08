import React from "react";
import { useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

interface MusicVideoVisualizerProps {
  songPath: string;
  barCount?: number;
  colorA?: string;
  colorB?: string;
}

export const MusicVideoVisualizer: React.FC<MusicVideoVisualizerProps> = ({
  songPath,
  barCount = 32,
  colorA = "#c9a84c",
  colorB = "#1a8a7a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(songPath));

  const FFT_BINS = 128;

  const rawFrequencies = audioData
    ? visualizeAudio({ audioData, frame, fps, numberOfSamples: FFT_BINS })
    : new Array(FFT_BINS).fill(0);

  const barRanges = React.useMemo(() => {
    const r = 1.12;
    const geo = Array.from({ length: barCount }, (_, i) => Math.pow(r, i));
    const sum = geo.reduce((a, b) => a + b, 0);
    const frac = geo.map(g => g / sum);
    let acc = 0;
    const ranges: [number, number][] = [];
    for (let i = 0; i < barCount; i++) {
      const cnt = Math.max(1, Math.round(frac[i] * FFT_BINS));
      ranges.push([acc, Math.min(acc + cnt - 1, FFT_BINS - 1)]);
      acc += cnt;
    }
    return ranges;
  }, [barCount]);

  const rms = Math.sqrt(rawFrequencies.reduce((s, v) => s + v * v, 0) / 128);
  const loudness = Math.min(1, rms * 4 + 0.05);

  const barValues = barRanges.map(([start, end]) => {
    let maxVal = 0;
    for (let j = start; j <= end && j < rawFrequencies.length; j++) {
      if (rawFrequencies[j] > maxVal) maxVal = rawFrequencies[j];
    }
    return maxVal;
  });

  const frequencies = barValues.map((value, i) => {
    const t = i / (barCount - 1);
    const profile = Math.pow(1 - t * 0.7, 1.5) + Math.pow(t, 3) * 0.4;
    return Math.min(1, loudness * profile * (0.3 + value * 0.7) + value * 0.3);
  });

  const BAR_MAX_HEIGHT = 100;
  const BAR_WIDTH = 12;
  const BAR_GAP = 4;
  const totalWidth = barCount * (BAR_WIDTH + BAR_GAP);
  const startX = (1920 - totalWidth) / 2;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 30,
        left: 0,
        right: 0,
        height: BAR_MAX_HEIGHT + 40,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
          zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <svg
        width={totalWidth}
        height={BAR_MAX_HEIGHT + 20}
        style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.8))" }}
      >
        <defs>
          <linearGradient id="barGradient" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorA} />
            <stop offset="50%" stopColor={colorB} />
            <stop offset="100%" stopColor={colorA} />
          </linearGradient>
        </defs>
        {frequencies.map((value, i) => {
          const height = Math.max(2, value * BAR_MAX_HEIGHT);
          const x = i * (BAR_WIDTH + BAR_GAP);
          const y = BAR_MAX_HEIGHT + 10 - height;

          const t = i / (barCount - 1);
          const mid = 0.5;
          const color = t < mid
            ? lerpColor(colorA, colorB, t / mid)
            : lerpColor(colorB, colorA, (t - mid) / mid);

          const opacity = 0.25 + value * 0.25;

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={height}
              rx={BAR_WIDTH / 2}
              ry={BAR_WIDTH / 2}
              fill={color}
              opacity={opacity}
            />
          );
        })}
      </svg>
    </div>
  );
};

function lerpColor(cA: string, cB: string, t: number): string {
  const a = hexToRgb(cA);
  const b = hexToRgb(cB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
