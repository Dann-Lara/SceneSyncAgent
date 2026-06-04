import { spring, useVideoConfig } from "remotion";

interface SpringConfig {
  damping?: number;
  mass?: number;
  stiffness?: number;
  overshootClamping?: boolean;
}

interface SpringEffectOptions {
  from?: number;
  to?: number;
  config?: SpringConfig;
  startFrame?: number;
  durationInFrames?: number;
}

export function useSpringEffect(
  frame: number,
  options: SpringEffectOptions = {}
): number {
  const { fps } = useVideoConfig();

  const {
    from = 0,
    to = 1,
    config = {},
    startFrame = 0,
    durationInFrames,
  } = options;

  const localFrame = Math.max(0, frame - startFrame);

  return spring({
    frame: localFrame,
    fps,
    from,
    to,
    durationInFrames,
    config: {
      damping: config.damping ?? 10,
      mass: config.mass ?? 1,
      stiffness: config.stiffness ?? 100,
      overshootClamping: config.overshootClamping ?? false,
    },
  });
}
