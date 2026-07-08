import { interpolate, Easing } from "remotion";
import type { TransitionType } from "../types";

export function applyTransition(
  progress: number,
  type: TransitionType,
  intensity: number = 1
): number {
  switch (type) {
    case "fade":
      return interpolate(progress, [0, 1], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    case "radial":
      return interpolate(progress, [0, 0.3, 1], [0, 0.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.45, 0, 0.55, 1),
      });
    case "glitch":
      return interpolate(progress, [0, 0.1, 0.2, 0.4, 0.6, 1], [0, 1, 0.2, 0.8, 0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    case "flash":
      return interpolate(progress, [0, 0.15, 0.25, 1], [0, 1, 0.7, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    case "zoom-blur":
      return interpolate(progress, [0, 0.2, 1], [0, 0.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 0, 0.67, 0.67),
      });
    case "shatter":
      return interpolate(progress, [0, 0.1, 0.3, 0.7, 1], [0, 0.6, 0.1, 0.7, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    case "crossfade":
    case "slide-left":
    case "slide-right":
    case "slide-up":
    case "slide-down":
      return interpolate(progress, [0, 1], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.45, 0, 0.55, 1),
      });
    case "whip":
      return interpolate(progress, [0, 0.1, 0.3, 1], [0, 1, 0.95, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 0, 0.67, 0.33),
      });
    case "zoom-in":
      return interpolate(progress, [0, 0.3, 1], [0, 0.4, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 0, 0.67, 0.33),
      });
    case "zoom-out":
      return interpolate(progress, [0, 0.15, 1], [0, 0.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
    case "pixelate":
      return interpolate(progress, [0, 0.3, 1], [0, 0.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 0, 0.67, 0.67),
      });
  }
}

export function getTransitionTransform(
  progress: number,
  type: TransitionType,
  direction: "left" | "right" | "up" | "down" = "left"
): string {
  switch (type) {
    case "fade":
    case "crossfade":
    case "pixelate":
      return "none";
    case "radial":
      const scale = interpolate(progress, [0, 1], [1.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.45, 0, 0.55, 1),
      });
      return `scale(${scale})`;
    case "glitch":
      if (progress > 0 && progress < 0.5) {
        const intensity = interpolate(progress, [0, 0.5], [2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = Math.sin(progress * 60) * intensity;
        const y = Math.cos(progress * 43) * intensity * 0.5;
        return `translate(${x}px, ${y}px)`;
      }
      return "none";
    case "flash":
    case "shatter":
      const sx = interpolate(progress, [0, 1], [1, 1.02], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const sy = interpolate(progress, [0, 1], [1, 1.02], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return `scale(${sx}, ${sy})`;
    case "zoom-blur":
      const z = interpolate(progress, [0, 0.5, 1], [1, 1.1, 1.05], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return `scale(${z})`;
    case "slide-left":
      const sl = interpolate(progress, [0, 1], [80, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `translateX(${sl}px)`;
    case "slide-right":
      const sr = interpolate(progress, [0, 1], [-80, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `translateX(${sr}px)`;
    case "slide-up":
      const su = interpolate(progress, [0, 1], [60, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `translateY(${su}px)`;
    case "slide-down":
      const sd = interpolate(progress, [0, 1], [-60, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `translateY(${sd}px)`;
    case "whip":
      if (progress < 0.3) {
        const wp = interpolate(progress, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.67, 0, 0.33, 0.67),
        });
        const wpx = interpolate(wp, [0, 1], [150, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const blur = interpolate(progress, [0, 0.3], [20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return `translateX(${wpx}px)`;
      }
      return "none";
    case "zoom-in":
      const zi = interpolate(progress, [0, 1], [0.3, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `scale(${zi})`;
    case "zoom-out":
      const zo = interpolate(progress, [0, 1], [1.5, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return `scale(${zo})`;
  }
}

export function getTransitionOverlay(
  progress: number,
  type: TransitionType,
  primaryColor: string
): React.CSSProperties | null {
  switch (type) {
    case "glitch":
      const glitchOpacity = progress < 0.3
        ? interpolate(progress, [0, 0.3], [0, 0.1])
        : interpolate(progress, [0.3, 1], [0.1, 0]);
      const rOffset = progress < 0.4 ? Math.sin(progress * 80) * 2 : 0;
      const bOffset = progress < 0.4 ? Math.sin(progress * 70 + 1) * 2 : 0;
      return {
        position: "absolute" as const,
        inset: 0,
        opacity: glitchOpacity,
        pointerEvents: "none" as const,
        boxShadow: `inset ${rOffset}px 0 0 rgba(255,0,0,0.3), inset ${bOffset}px 0 0 rgba(0,0,255,0.3)`,
      };
    case "flash":
      const flashOpacity = interpolate(progress, [0, 0.08, 0.15, 1], [0, 0.3, 0, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        position: "absolute" as const,
        inset: 0,
        opacity: flashOpacity,
        backgroundColor: "#ffffff",
        pointerEvents: "none" as const,
      };
    case "shatter":
      if (progress < 0.2) {
        return {
          position: "absolute" as const,
          inset: 0,
          opacity: interpolate(progress, [0, 0.2], [0, 0.2]),
          background: `radial-gradient(ellipse at 50% 50%, transparent 30%, ${primaryColor}66 100%)`,
          pointerEvents: "none" as const,
        };
      }
      return null;
    case "radial":
      const radialProgress = interpolate(progress, [0, 1], [0, 1]);
      const r = 50 * (1 - radialProgress);
      const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.15, 0]);
      return {
        position: "absolute" as const,
        inset: 0,
        opacity,
        background: `radial-gradient(circle at 50% 50%, transparent ${r}%, ${primaryColor}22 100%)`,
        pointerEvents: "none" as const,
      };
    case "whip":
      const whipOpacity = interpolate(progress, [0, 0.1, 0.3, 1], [0, 0.15, 0, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        position: "absolute" as const,
        inset: 0,
        opacity: whipOpacity,
        background: `linear-gradient(to right, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)`,
        pointerEvents: "none" as const,
      };
    case "pixelate":
      const blur = interpolate(progress, [0, 1], [12, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 0, 0.67, 0.67),
      });
      const pixelOpacity = interpolate(progress, [0, 1], [0.6, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        position: "absolute" as const,
        inset: 0,
        opacity: pixelOpacity,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        pointerEvents: "none" as const,
      };
    default:
      return null;
  }
}

export function getShatterClipPath(progress: number, index: number, total: number): string {
  if (progress <= 0) return "inset(0%)";
  if (progress >= 1) return "inset(0%)";

  const cols = 4;
  const rows = 4;
  const totalPieces = cols * rows;
  const pieceIndex = index % totalPieces;
  const col = pieceIndex % cols;
  const row = Math.floor(pieceIndex / cols);

  const staggerDelay = ((row + col) / (rows + cols)) * 0.6;
  const localProgress = Math.max(0, Math.min(1, (progress - staggerDelay) / (1 - staggerDelay)));

  const offset = interpolate(localProgress, [0, 1], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return `inset(${row * 25 - offset * (row + 1) * 0.25}% ${100 - col * 25 + offset * (cols - col) * 0.25}% ${100 - row * 25 + offset * (rows - row) * 0.25}% ${col * 25 - offset * (col + 1) * 0.25}%)`;
}
