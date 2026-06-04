import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Sentiment } from "../types";
import { useMemo } from "react";

interface SceneOverlaysProps {
  sentiment: Sentiment;
  color: string;
}

export const SceneOverlays: React.FC<SceneOverlaysProps> = ({ sentiment, color }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const main = (() => {
    switch (sentiment) {
      case "calm": return <DataGrid frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "mystery": return <WhisperingEcho frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "tension": return <TargetingReticle frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "dread": return <SlowGaze frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "drama": return <EMPPulse frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "despair": return <FallingAshes frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "rage": return <FractureLightning frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "terror": return <GlitchReticle frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "triumph": return <AscendingPulse frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "resolution": return <WaveformDecay frame={frame} fps={fps} width={width} height={height} color={color} />;
    }
  })();

  return (
    <>
      {main}
      <WeldingSpark frame={frame} fps={fps} width={width} height={height} color={color} />
      <TriGrid frame={frame} fps={fps} width={width} height={height} color={color} />
      <MicroPulse frame={frame} fps={fps} width={width} height={height} color={color} />
    </>
  );
};

type OverlayProps = {
  frame: number;
  fps: number;
  width: number;
  height: number;
  color: string;
};

const DataGrid: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const scanY = ((frame * 2) % height);
  const gridOpacity = interpolate(frame % 120, [0, 60, 120], [0.18, 0.35, 0.18]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="1" fill={color} opacity={0.55} />
          <circle cx="0" cy="0" r="1" fill={color} opacity={0.55} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)" opacity={gridOpacity} />
      <line x1={0} y1={scanY} x2={width} y2={scanY} stroke={color} strokeWidth={1} opacity={0.35} />
    </svg>
  );
};

const WhisperingEcho: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.sqrt(width * width + height * height) / 2;
  const rings = 3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {Array.from({ length: rings }).map((_, i) => {
        const phase = (frame * 0.3 + i * 80) % 160;
        const r = interpolate(phase, [0, 160], [0, maxR * 0.6]);
        const opacity = interpolate(phase, [0, 40, 120, 160], [0, 0.35, 0.28, 0]);
        const strokeW = interpolate(phase, [0, 80, 160], [2, 0.5, 0]);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};

const TargetingReticle: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const cx = width / 2;
  const cy = height * 0.4;
  const rotation = (frame * 0.15) % 360;
  const pulse = Math.sin(frame * 0.04) * 0.5 + 0.5;
  const ringR = 40 + pulse * 15;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <line x1={cx - 70} y1={cy} x2={cx - 20} y2={cy} stroke={color} strokeWidth={1} opacity={0.35} />
        <line x1={cx + 20} y1={cy} x2={cx + 70} y2={cy} stroke={color} strokeWidth={1} opacity={0.35} />
        <line x1={cx} y1={cy - 70} x2={cx} y2={cy - 20} stroke={color} strokeWidth={1} opacity={0.35} />
        <line x1={cx} y1={cy + 20} x2={cx} y2={cy + 70} stroke={color} strokeWidth={1} opacity={0.35} />
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color} strokeWidth={1} opacity={0.28} />
        <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.45} />
      </g>
    </svg>
  );
};

const SlowGaze: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const cx = width * 0.65;
  const cy = height * 0.35;
  const pupilR = 6 + Math.sin(frame * 0.02) * 3;
  const outerR = 25 + Math.sin(frame * 0.015) * 5;
  const gazeX = Math.sin(frame * 0.008) * 4;
  const gazeY = Math.cos(frame * 0.012) * 3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <ellipse cx={cx} cy={cy} rx={outerR} ry={outerR * 0.85} fill="none" stroke={color} strokeWidth={1.5} opacity={0.33} />
      <ellipse cx={cx} cy={cy} rx={outerR * 0.7} ry={outerR * 0.6} fill="none" stroke={color} strokeWidth={1} opacity={0.28} />
      <circle cx={cx + gazeX} cy={cy + gazeY} r={pupilR} fill={color} opacity={0.45} />
    </svg>
  );
};

interface Particle { x: number; y: number; phase: number; speed: number; }

const EMPPulse: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const maxR = Math.sqrt(width * width + height * height) / 2;
  const particles: Particle[] = useMemo(() =>
    Array.from({ length: 6 }).map((_, i) => ({
      x: width * (0.2 + ((i * 17) % 60) / 100),
      y: height * (0.2 + ((i * 31) % 60) / 100),
      phase: i * 25,
      speed: 0.6 + (i % 3) * 0.2,
    })), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {particles.map((p, i) => {
        const localFrame = frame * p.speed + p.phase;
        const r = interpolate(localFrame % 120, [0, 120], [0, maxR * 0.4]);
        const opacity = interpolate(localFrame % 120, [0, 30, 90, 120], [0, 0.35, 0.28, 0]);
        return <circle key={i} cx={p.x} cy={p.y} r={r} fill="none" stroke={color} strokeWidth={1} opacity={opacity} />;
      })}
    </svg>
  );
};

const FallingAshes: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const particles: { x: number; size: number; speed: number; drift: number }[] = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      x: ((i * 37 + 13) % 100) / 100,
      size: 2 + ((i * 7) % 3),
      speed: 0.3 + (i % 5) * 0.08,
      drift: ((i * 11) % 60) / 100 - 0.3,
    })), []);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {particles.map((p, i) => {
        const y = ((frame * p.speed + i * 50) % 120) / 120 * height;
        const x = p.x * width + Math.sin(frame * 0.02 + i) * p.drift * 40;
        const opacity = interpolate(y, [0, height * 0.1, height * 0.8, height], [0, 0.33, 0.28, 0]);
        return <circle key={i} cx={x} cy={y} r={p.size} fill={color} opacity={opacity} />;
      })}
    </svg>
  );
};

const FractureLightning: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const boltCount = 3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {Array.from({ length: boltCount }).map((_, b) => {
        const flashPhase = (frame * 0.5 + b * 40) % 100;
        const visible = flashPhase < 15;
        const opacity = visible ? interpolate(flashPhase, [0, 5, 15], [0, 0.4, 0]) : 0;
        const startX = width * (0.2 + b * 0.3);
        const startY = 0;
        const endX = width * (0.15 + b * 0.35) + Math.sin(frame * 0.1 + b) * 30;
        const endY = height;
        const midX = startX + (endX - startX) * 0.4 + Math.sin(frame * 0.15 + b * 2) * 20;
        const midY = height * 0.5 + Math.sin(frame * 0.12 + b * 3) * 15;
        return (
          <path
            key={b}
            d={`M${startX},${startY} Q${midX},${midY} ${endX},${endY}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
};

const GlitchReticle: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const cx = width / 2;
  const cy = height / 2;
  const glitchIntensity = Math.sin(frame * 0.3) * 0.5 + 0.5;
  const rOffset = Math.sin(frame * 0.7) * glitchIntensity * 3;
  const bOffset = Math.sin(frame * 0.5 + 1) * glitchIntensity * 3;
  const rotation = (frame * 0.3) % 360;
  const bands = 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {Array.from({ length: bands }).map((_, i) => {
        const bandY = height * (0.2 + i * 0.2) + Math.sin(frame * 0.2 + i * 3) * 10;
        const bandH = 3 + Math.sin(frame * 0.4 + i * 2) * 2;
        return (
          <rect
            key={i}
            x={0}
            y={bandY}
            width={width}
            height={bandH}
            fill={i % 2 === 0 ? color : "none"}
            opacity={glitchIntensity * 0.28}
          />
        );
      })}
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={50} fill="none" stroke={color} strokeWidth={1} opacity={0.22} />
        <circle cx={cx + rOffset} cy={cy} r={3} fill="#ff0000" opacity={0.28} />
        <circle cx={cx + bOffset} cy={cy} r={3} fill="#0000ff" opacity={0.28} />
      </g>
    </svg>
  );
};

const AscendingPulse: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const cx = width / 2;
  const progress = (frame % 90) / 90;
  const y = interpolate(progress, [0, 1], [height * 0.8, height * 0.1]);
  const r = interpolate(progress, [0, 0.3, 1], [5, 20, 5]);
  const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 0.35, 0.28, 0]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <circle cx={cx} cy={y} r={r} fill="none" stroke={color} strokeWidth={1.5} opacity={opacity} />
      <circle cx={cx} cy={y} r={r * 0.5} fill={color} opacity={opacity * 0.6} />
      <line x1={cx - r * 2} y1={y} x2={cx + r * 2} y2={y} stroke={color} strokeWidth={1} opacity={opacity * 0.5} />
    </svg>
  );
};

const WaveformDecay: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const amplitude = interpolate(frame, [0, fps * 5], [15, 2]);
  const points = Array.from({ length: 80 }).map((_, i) => {
    const x = (i / 80) * width;
    const t = frame * 0.05 + i * 0.08;
    const y = height - 80 + Math.sin(t) * amplitude * Math.max(0, 1 - frame / (fps * 6));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} opacity={0.28} />
    </svg>
  );
};

const WeldingSpark: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const sparks = useMemo(() =>
    Array.from({ length: 8 }).map((_, i) => ({
      x: width * (0.1 + ((i * 29 + 7) % 80) / 100),
      y: height * (0.1 + ((i * 43 + 13) % 80) / 100),
      phase: i * 17,
      speedX: ((i * 11) % 20 - 10) * 0.3,
      speedY: -((i * 7) % 15 + 3) * 0.4,
      life: 20 + (i % 5) * 6,
    })), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {sparks.map((s, i) => {
        const localFrame = (frame + s.phase) % s.life;
        const progress = localFrame / s.life;
        const x = s.x + s.speedX * progress * 15;
        const y = s.y + s.speedY * progress * 15 + 20 * progress * progress;
        const trailEndX = s.x + s.speedX * Math.max(0, progress - 0.2) * 10;
        const trailEndY = s.y + s.speedY * Math.max(0, progress - 0.2) * 10 + 20 * Math.max(0, progress - 0.2) * Math.max(0, progress - 0.2);
        const sparkOpacity = interpolate(progress, [0, 0.1, 0.6, 1], [0.4, 0.5, 0.3, 0]);
        return (
          <g key={i}>
            <line x1={trailEndX} y1={trailEndY} x2={x} y2={y} stroke={color} strokeWidth={0.5} opacity={sparkOpacity * 0.5} />
            <circle cx={x} cy={y} r={1.5} fill={color} opacity={sparkOpacity} />
          </g>
        );
      })}
    </svg>
  );
};

const TriGrid: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const tris = useMemo(() =>
    Array.from({ length: 6 }).map((_, i) => ({
      x: width * (0.05 + ((i * 31 + 5) % 90) / 100),
      y: height * (0.05 + ((i * 47 + 17) % 90) / 100),
      size: 6 + (i % 4) * 4,
      rotationPhase: i * 40,
      driftX: ((i * 13) % 20 - 10) * 0.15,
      driftY: ((i * 19) % 20 - 10) * 0.15,
    })), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {tris.map((t, i) => {
        const rot = (frame * 0.5 + t.rotationPhase) % 360;
        const offsetX = Math.sin(frame * 0.01 + i * 2) * t.driftX * 20;
        const offsetY = Math.cos(frame * 0.015 + i * 3) * t.driftY * 20;
        const h = t.size * Math.sqrt(3) / 2;
        const points = `0,${-h} ${-t.size / 2},${h / 2} ${t.size / 2},${h / 2}`;
        const opacity = 0.15 + Math.sin(frame * 0.02 + i * 1.5) * 0.1;
        return (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={0.8}
            opacity={opacity}
            transform={`translate(${t.x + offsetX}, ${t.y + offsetY}) rotate(${rot})`}
          />
        );
      })}
    </svg>
  );
};

const MicroPulse: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const pulses = useMemo(() =>
    Array.from({ length: 5 }).map((_, i) => ({
      cx: width * (0.1 + ((i * 41 + 3) % 80) / 100),
      cy: height * (0.1 + ((i * 59 + 19) % 80) / 100),
      phase: i * 35,
      maxR: 8 + (i % 4) * 6,
    })), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {pulses.map((p, i) => {
        const t = (frame * 0.8 + p.phase) % 60;
        const progress = t / 60;
        const r = interpolate(progress, [0, 1], [1, p.maxR]);
        const opacity = interpolate(progress, [0, 0.3, 1], [0.35, 0.3, 0]);
        return (
          <circle key={i} cx={p.cx} cy={p.cy} r={r} fill="none" stroke={color} strokeWidth={0.5} opacity={opacity} />
        );
      })}
    </svg>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
};
