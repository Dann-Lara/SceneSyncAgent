import { interpolate } from "remotion";
import { useMemo } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  phaseX: number;
  phaseY: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

interface ParticleOverlayProps {
  frame: number;
  count?: number;
  color?: string;
  speed?: number;
  sizeRange?: [number, number];
  opacityRange?: [number, number];
  spread?: number;
}

export const ParticleOverlay: React.FC<ParticleOverlayProps> = ({
  frame,
  count = 20,
  color = "#ffffff",
  speed = 0.5,
  sizeRange = [2, 6],
  opacityRange = [0.1, 0.4],
  spread = 1,
}) => {
  const particles = useMemo(() => {
    const result: Particle[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        x: ((i * 37 + 13) % 100) / 100,
        y: ((i * 53 + 7) % 100) / 100,
        size: sizeRange[0] + ((i * 29) % 100) / 100 * (sizeRange[1] - sizeRange[0]),
        phaseX: (i * 41) % 360,
        phaseY: (i * 67) % 360,
        speedX: 0.3 + (i % 10) * 0.07,
        speedY: 0.2 + (i % 8) * 0.09,
        opacity: opacityRange[0] + ((i * 19) % 100) / 100 * (opacityRange[1] - opacityRange[0]),
      });
    }
    return result;
  }, [count]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((p, i) => {
        const x = (p.x + Math.sin((frame * p.speedX + p.phaseX) * 0.02) * 0.15) * 100;
        const y = (p.y + Math.cos((frame * p.speedY + p.phaseY) * 0.02) * 0.15) * 100;
        const flicker = Math.sin(frame * (0.05 + i * 0.003)) * 0.3 + 0.7;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x * spread}%`,
              top: `${y * spread}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: p.opacity * flicker,
              transform: `translate(-50%, -50%)`,
            }}
          />
        );
      })}
    </div>
  );
};
