import { interpolate } from "remotion";
import type { Climate } from "../types";
import { useMemo } from "react";

type OverlayProps = {
  frame: number;
  fps: number;
  width: number;
  height: number;
  color: string;
};

export function boltPoints(
  startX: number, startY: number,
  endX: number, endY: number,
  seed: number
): string {
  const steps = 9;
  const pts: [number, number][] = [[startX, startY]];
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const bx = startX + (endX - startX) * t;
    const by = startY + (endY - startY) * t;
    const jitter = Math.sin(s * 3.7 + seed * 7.3) * 22 * (1 - t * 0.5);
    pts.push([bx + jitter, by]);
  }
  pts.push([endX, endY]);
  return pts.map(p => p.join(",")).join(" ");
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
};

export const Storm: React.FC<OverlayProps & { climate: Climate }> = ({ frame, width, height, color, climate }) => {
  const isStorm = climate === "storm";

  const drops = useMemo(() => {
    if (isStorm) {
      return Array.from({ length: 100 }, (_, i) => ({
        x: width * ((i * 31 + 7) % 97) / 100,
        speed: 30 + ((i * 7) % 50),
        length: 20 + ((i * 13) % 21),
        opacity: 0.25 + ((i * 11) % 30) / 100,
        phase: (i * 23) % 100,
      }));
    }
    return Array.from({ length: 65 }, (_, i) => ({
      x: width * ((i * 31 + 7) % 97) / 100,
      speed: 12 + ((i * 7) % 19),
      length: 14 + ((i * 13) % 15),
      opacity: 0.2 + ((i * 11) % 21) / 100,
      phase: (i * 23) % 200,
    }));
  }, [width, isStorm]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {drops.map((d, i) => {
        const y = ((frame * d.speed + d.phase) % (height + d.length)) - d.length;
        return (
          <line key={i}
            x1={d.x} y1={y}
            x2={d.x} y2={y + d.length}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={isStorm ? 1.5 : 1.2}
            opacity={d.opacity}
            strokeLinecap="round"
          />
        );
      })}

      {isStorm && Array.from({ length: 2 }, (_, b) => {
        const interval = 80 + b * 30;
        const flashCycle = (frame + b * 47) % interval;
        const visible = flashCycle < 6;
        const op = visible ? interpolate(flashCycle, [0, 2, 6], [0, 0.4, 0]) : 0;

        const startX = width * (0.15 + b * 0.55) + Math.sin(frame * 0.05 + b * 13) * 30;
        const endX = startX + Math.sin(frame * 0.04 + b * 7) * 100;
        const seed = b * 31 + Math.floor(frame / 6) * 7;

        const mainPts = boltPoints(startX, 0, endX, height, seed);

        const branchMidX = startX + (endX - startX) * 0.45 + Math.sin(seed * 1.7) * 18;
        const branchMidY = height * 0.48;
        const branchEndX = branchMidX + Math.sin(seed * 2.3) * 60;
        const branchPts = boltPoints(branchMidX, branchMidY, branchEndX, height * 0.75, seed + 5);

        return (
          <g key={b}>
            {visible && (
              <rect x={0} y={0} width={width} height={height}
                fill="white" opacity={interpolate(flashCycle, [0, 1, 6], [0, 0.12, 0])} />
            )}
            <polyline points={mainPts} fill="none"
              stroke={color} strokeWidth={2} opacity={op} />
            <polyline points={branchPts} fill="none"
              stroke={color} strokeWidth={1.2} opacity={op * 0.55} />
            <polyline points={mainPts} fill="none"
              stroke={color} strokeWidth={5} opacity={op * 0.12}
              strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
};
