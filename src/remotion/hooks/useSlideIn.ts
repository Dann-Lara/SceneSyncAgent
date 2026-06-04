import { interpolate, Easing } from "remotion";

interface SlideInOptions {
  startFrame: number;
  duration: number;
  direction?: "left" | "right" | "up" | "down";
  distance?: number;
  fade?: boolean;
  easing?: (t: number) => number;
  overshoot?: boolean;
}

const defaultEasing = Easing.bezier(0.16, 1, 0.3, 1);

const overshootEasing = Easing.bezier(0.34, 1.56, 0.64, 1);

export function useSlideIn(
  frame: number,
  options: SlideInOptions
): { opacity: number; transform: string; progress: number } {
  const {
    startFrame,
    duration,
    direction = "up",
    distance = 30,
    fade = true,
    easing = defaultEasing,
    overshoot = false,
  } = options;

  const localFrame = Math.max(0, frame - startFrame);
  const progress = duration > 0
    ? interpolate(localFrame, [0, duration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: overshoot ? overshootEasing : easing,
      })
    : 1;

  const opacity = fade
    ? interpolate(progress, [0, 0.15, 1], [0, 1, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const offset = overshoot
    ? interpolate(progress, [0, 1], [distance, distance * -0.15])
    : interpolate(progress, [0, 1], [distance, 0]);

  let transform: string;
  switch (direction) {
    case "left":
      transform = `translateX(${-offset}px)`;
      break;
    case "right":
      transform = `translateX(${offset}px)`;
      break;
    case "up":
      transform = `translateY(${offset}px)`;
      break;
    case "down":
      transform = `translateY(${-offset}px)`;
      break;
  }

  return { opacity, transform, progress };
}
