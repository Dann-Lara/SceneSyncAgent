import { interpolate } from "remotion";

interface PulseOptions {
  frequency?: number;
  min?: number;
  max?: number;
  startFrame?: number;
}

export function usePulse(
  frame: number,
  options: PulseOptions = {}
): number {
  const {
    frequency = 0.08,
    min = 0.5,
    max = 1,
    startFrame = 0,
  } = options;

  const localFrame = Math.max(0, frame - startFrame);
  const raw = Math.sin(localFrame * frequency * Math.PI * 2);
  const normalized = (raw + 1) / 2;
  return interpolate(normalized, [0, 1], [min, max]);
}

export function usePulseRange(
  frame: number,
  rangeStart: number,
  rangeEnd: number,
  pulseValue: number
): number {
  const clamped = Math.max(0, Math.min(1, (frame - rangeStart) / (rangeEnd - rangeStart)));
  return clamped * pulseValue;
}
