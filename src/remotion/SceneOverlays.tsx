import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Sentiment, Climate } from "../types";
import { useMemo } from "react";
import { Storm, boltPoints } from "./Storm";

interface SceneOverlaysProps {
  sentiment: Sentiment;
  color: string;
  climate?: Climate;
}

export const SceneOverlays: React.FC<SceneOverlaysProps> = ({ sentiment, color, climate }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const main = (() => {
    switch (sentiment) {
      case "calm":       return <DataGrid frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "mystery":    return <NeuralPulse frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "tension":    return <TargetingReticle frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "dread":      return <SlowGaze frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "drama":      return <EMPPulse frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "despair":    return <FallingAshes frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "rage":       return <FractureLightning frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "terror":     return <GlitchReticle frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "triumph":    return <AscendingPulse frame={frame} fps={fps} width={width} height={height} color={color} />;
      case "resolution": return null;
    }
  })();

  return (
    <>
      {main}
      <WeldingSpark frame={frame} fps={fps} width={width} height={height} color={color} />
      <TriGrid frame={frame} fps={fps} width={width} height={height} color={color} />
      <MicroPulse frame={frame} fps={fps} width={width} height={height} color={color} />
      {climate && climate !== "clear" && (
        <Storm frame={frame} fps={fps} width={width} height={height} color={color} climate={climate} />
      )}
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

// ─── CALM: DataGrid con data burst ocasional ─────────────────────────────────
const DataGrid: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const scanY = ((frame * 2) % height);
  const gridOpacity = interpolate(frame % 120, [0, 60, 120], [0.3, 0.55, 0.3]);

  // Data burst: cada ~120 frames, 3-4 puntos brillan
  const burstPoints = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => ({
      x: width * ((i * 31 + 17) % 80) / 100 + 40,
      y: height * ((i * 47 + 11) % 80) / 100 + 40,
      phase: i * 28,
    })), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="40" cy="40" r="1" fill={color} opacity={0.7} />
          <circle cx="0" cy="0" r="1" fill={color} opacity={0.7} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)" opacity={gridOpacity} />
      <line x1={0} y1={scanY} x2={width} y2={scanY} stroke={color} strokeWidth={1.5} opacity={0.5} />
      {burstPoints.map((p, i) => {
        const t = (frame + p.phase) % 120;
        const burstOpacity = t < 12 ? interpolate(t, [0, 4, 12], [0, 0.9, 0]) : 0;
        return (
          <circle key={i} cx={p.x} cy={p.y} r={4 + t * 0.5} fill="none"
            stroke={color} strokeWidth={1.5} opacity={burstOpacity} />
        );
      })}
    </svg>
  );
};

// ─── MYSTERY: NeuralPulse — red neuronal con pulsos viajando ─────────────────
const NeuralPulse: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const nodes = useMemo(() => [
    { x: width * 0.15, y: height * 0.25 },
    { x: width * 0.35, y: height * 0.15 },
    { x: width * 0.60, y: height * 0.20 },
    { x: width * 0.80, y: height * 0.35 },
    { x: width * 0.75, y: height * 0.65 },
    { x: width * 0.50, y: height * 0.80 },
    { x: width * 0.22, y: height * 0.70 },
    { x: width * 0.45, y: height * 0.48 },
  ], [width, height]);

  // Conexiones entre nodos cercanos (distancia < 380px)
  const edges = useMemo(() => {
    const result: { a: number; b: number; dist: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 380) result.push({ a: i, b: j, dist });
      }
    }
    return result;
  }, [nodes]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {/* Conexiones */}
      {edges.map((e, i) => {
        const edgeOpacity = 0.22 + Math.sin(frame * 0.02 + i * 1.3) * 0.1;
        return (
          <line key={i}
            x1={nodes[e.a].x} y1={nodes[e.a].y}
            x2={nodes[e.b].x} y2={nodes[e.b].y}
            stroke={color} strokeWidth={1} opacity={edgeOpacity} />
        );
      })}

      {/* Pulsos viajando por las conexiones */}
      {edges.map((e, i) => {
        const speed = 0.4 + (i % 3) * 0.15;
        const t = ((frame * speed + i * 40) % 100) / 100;
        const px = nodes[e.a].x + (nodes[e.b].x - nodes[e.a].x) * t;
        const py = nodes[e.a].y + (nodes[e.b].y - nodes[e.a].y) * t;
        const pulseOp = interpolate(t, [0, 0.1, 0.9, 1], [0, 0.75, 0.65, 0]);
        return (
          <circle key={`p${i}`} cx={px} cy={py} r={3}
            fill={color} opacity={pulseOp} />
        );
      })}

      {/* Nodos */}
      {nodes.map((n, i) => {
        const activating = (frame + i * 23) % 150 < 20;
        const nodeOp = activating
          ? interpolate((frame + i * 23) % 150, [0, 8, 20], [0.35, 0.8, 0.35])
          : 0.35 + Math.sin(frame * 0.015 + i * 0.8) * 0.12;
        const waveOp = activating
          ? interpolate((frame + i * 23) % 150, [0, 10, 20], [0, 0.55, 0])
          : 0;
        const waveR = activating
          ? interpolate((frame + i * 23) % 150, [0, 20], [6, 28])
          : 0;
        return (
          <g key={i}>
            {activating && (
              <circle cx={n.x} cy={n.y} r={waveR} fill="none"
                stroke={color} strokeWidth={1} opacity={waveOp} />
            )}
            <circle cx={n.x} cy={n.y} r={5} fill={color} opacity={nodeOp} />
          </g>
        );
      })}
    </svg>
  );
};

// ─── TENSION: TargetingReticle con jitter y modo LOCK ────────────────────────
const TargetingReticle: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const cx = width / 2;
  const cy = height * 0.4;

  const jitter = Math.sin(frame * 0.8) * 2 + Math.cos(frame * 1.3) * 1.5;
  const rotation = (frame * 0.15 + jitter) % 360;
  const pulse = Math.sin(frame * 0.04) * 0.5 + 0.5;
  const ringR = 40 + pulse * 15;

  // Modo LOCK cada 90 frames durante 12 frames
  const lockCycle = frame % 90;
  const isLocked = lockCycle < 12;
  const lockOpacity = isLocked ? interpolate(lockCycle, [0, 3, 9, 12], [0, 0.9, 0.9, 0]) : 0;

  // Segundo reticle orbitante
  const orbitAngle = (frame * 0.4) * (Math.PI / 180);
  const orbitR = 90;
  const ox = cx + Math.cos(orbitAngle) * orbitR;
  const oy = cy + Math.sin(orbitAngle) * orbitR * 0.5;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {/* Reticle principal */}
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <line x1={cx - 70} y1={cy} x2={cx - 20} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.5} />
        <line x1={cx + 20} y1={cy} x2={cx + 70} y2={cy} stroke={color} strokeWidth={1.5} opacity={0.5} />
        <line x1={cx} y1={cy - 70} x2={cx} y2={cy - 20} stroke={color} strokeWidth={1.5} opacity={0.5} />
        <line x1={cx} y1={cy + 20} x2={cx} y2={cy + 70} stroke={color} strokeWidth={1.5} opacity={0.5} />
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={color} strokeWidth={1.5} opacity={0.45} />
        <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.65} />
      </g>

      {/* Reticle secundario orbitante */}
      <g transform={`rotate(${-rotation * 0.7} ${ox} ${oy})`}>
        <circle cx={ox} cy={oy} r={16} fill="none" stroke={color} strokeWidth={1.2} opacity={0.35} />
        <line x1={ox - 22} y1={oy} x2={ox - 8} y2={oy} stroke={color} strokeWidth={1.2} opacity={0.35} />
        <line x1={ox + 8} y1={oy} x2={ox + 22} y2={oy} stroke={color} strokeWidth={1.2} opacity={0.35} />
      </g>

      {/* Indicador LOCKED */}
      {isLocked && (
        <text x={cx + 54} y={cy - 54} fill={color} fontSize={11}
          fontFamily="'Courier New', monospace" letterSpacing={3}
          opacity={lockOpacity} textAnchor="start">
          LOCKED
        </text>
      )}
    </svg>
  );
};

// ─── DREAD: SlowGaze con párpado, iris y ojos secundarios ────────────────────
const SlowGaze: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const eyes = useMemo(() => [
    { cx: width * 0.65, cy: height * 0.35, scale: 1.0, opacity: 0.55 },
    { cx: width * 0.18, cy: height * 0.22, scale: 0.45, opacity: 0.3 },
    { cx: width * 0.82, cy: height * 0.72, scale: 0.35, opacity: 0.25 },
  ], [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {eyes.map((eye, ei) => {
        const outerR = (25 + Math.sin(frame * 0.015) * 5) * eye.scale;
        const irisR = outerR * 0.65;
        const pupilR = (6 + Math.sin(frame * 0.02) * 3) * eye.scale;
        const gazeX = Math.sin(frame * 0.008 + ei) * 4 * eye.scale;
        const gazeY = Math.cos(frame * 0.012 + ei) * 3 * eye.scale;

        // Párpado: arco superior que se cierra lentamente cada 180 frames
        const blinkCycle = (frame + ei * 60) % 180;
        const lidClose = blinkCycle < 20
          ? interpolate(blinkCycle, [0, 10, 20], [0, outerR * 0.9, 0])
          : 0;

        return (
          <g key={ei} opacity={eye.opacity}>
            {/* Esclerótica */}
            <ellipse cx={eye.cx} cy={eye.cy} rx={outerR} ry={outerR * 0.85}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.9} />
            {/* Iris */}
            <circle cx={eye.cx} cy={eye.cy} r={irisR}
              fill="none" stroke={color} strokeWidth={1} opacity={0.7} />
            {/* Pupila */}
            <ellipse cx={eye.cx + gazeX} cy={eye.cy + gazeY}
              rx={pupilR} ry={pupilR * (1.2 + Math.sin(frame * 0.03) * 0.3)}
              fill={color} opacity={0.8} />
            {/* Párpado superior */}
            {lidClose > 0 && (
              <path
                d={`M ${eye.cx - outerR} ${eye.cy} A ${outerR} ${outerR * 0.85} 0 0 1 ${eye.cx + outerR} ${eye.cy}`}
                fill={color} opacity={Math.min(lidClose / outerR, 0.9)}
                transform={`translate(0, ${-outerR * 0.85 + lidClose})`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── DRAMA: EMPPulse (original, funcionaba bien) ─────────────────────────────
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
        const opacity = interpolate(localFrame % 120, [0, 30, 90, 120], [0, 0.5, 0.4, 0]);
        return <circle key={i} cx={p.x} cy={p.y} r={r} fill="none"
          stroke={color} strokeWidth={1.5} opacity={opacity} />;
      })}
    </svg>
  );
};

// ─── DESPAIR: FallingAshes con polígonos irregulares y rotación ──────────────
const FallingAshes: React.FC<OverlayProps> = ({ frame, width, height, color }) => {
  const ashes = useMemo(() =>
    Array.from({ length: 18 }).map((_, i) => ({
      xBase: ((i * 37 + 13) % 100) / 100,
      size: 2 + ((i * 7) % 4),
      speed: 0.25 + (i % 5) * 0.07,
      drift: ((i * 11) % 60) / 100 - 0.3,
      rotSpeed: ((i * 17) % 20 - 10) * 0.8,
      phase: i * 37,
      // Forma del polígono: 3-5 vértices con ángulos irregulares
      angles: Array.from({ length: 3 + (i % 3) }, (_, v) => {
        const base = (v / (3 + (i % 3))) * Math.PI * 2;
        return base + ((i * v * 7) % 30 - 15) * (Math.PI / 180);
      }),
      radii: Array.from({ length: 3 + (i % 3) }, (_, v) =>
        0.6 + ((i * v * 13 + 7) % 40) / 100
      ),
    })), []);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {ashes.map((a, i) => {
        const y = ((frame * a.speed + a.phase) % 130) / 130 * (height + 40) - 20;
        const x = a.xBase * width + Math.sin(frame * 0.018 + i * 0.7) * a.drift * 50;
        const rotation = (frame * a.rotSpeed + a.phase) % 360;
        const opacity = interpolate(y,
          [0, height * 0.08, height * 0.82, height],
          [0, 0.55, 0.45, 0]);

        const pts = a.angles.map((angle, v) => {
          const r = a.size * a.radii[v];
          return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
        }).join(" ");

        return (
          <polygon
            key={i}
            points={pts}
            fill={color}
            opacity={opacity}
            transform={`translate(${x}, ${y}) rotate(${rotation})`}
          />
        );
      })}
    </svg>
  );
};

// ─── RAGE: FractureLightning con zigzag real y ramificaciones ────────────────

const FractureLightning: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const boltCount = 3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {Array.from({ length: boltCount }).map((_, b) => {
        // Flasheo irregular: no constante, sino basado en número primo
        const flashCycle = (frame * 0.5 + b * 43) % 100;
        const visible = flashCycle < 14;
        const opacity = visible ? interpolate(flashCycle, [0, 4, 14], [0, 0.6, 0]) : 0;

        const startX = width * (0.18 + b * 0.32);
        const endX = width * (0.12 + b * 0.38) + Math.sin(frame * 0.07 + b) * 25;
        const seed = b * 31 + Math.floor(frame / 8) * 7; // cambia cada 8 frames

        // Rayo principal
        const mainPts = boltPoints(startX, 0, endX, height, seed);

        // Ramificación desde punto medio
        const midX = startX + (endX - startX) * 0.45 + Math.sin(seed * 1.7) * 18;
        const midY = height * 0.48;
        const branchEndX = midX + Math.sin(seed * 2.3) * 60;
        const branchPts = boltPoints(midX, midY, branchEndX, height * 0.75, seed + 5);

        return (
          <g key={b}>
            <polyline points={mainPts} fill="none"
              stroke={color} strokeWidth={2} opacity={opacity} />
            <polyline points={branchPts} fill="none"
              stroke={color} strokeWidth={1.2} opacity={opacity * 0.55} />
            {/* Resplandor del rayo */}
            <polyline points={mainPts} fill="none"
              stroke={color} strokeWidth={5} opacity={opacity * 0.15}
              strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
};

// ─── TERROR: GlitchReticle (original, funciona bien) ─────────────────────────
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
          <rect key={i} x={0} y={bandY} width={width} height={bandH}
            fill={i % 2 === 0 ? color : "none"}
            opacity={glitchIntensity * 0.4} />
        );
      })}
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={50} fill="none" stroke={color} strokeWidth={1.5} opacity={0.35} />
        <circle cx={cx + rOffset} cy={cy} r={3} fill="#ff0000" opacity={0.4} />
        <circle cx={cx + bOffset} cy={cy} r={3} fill="#0000ff" opacity={0.4} />
      </g>
    </svg>
  );
};

// ─── TRIUMPH: AscendingPulse con 3 pulsos escalonados y explosión ─────────────
const AscendingPulse: React.FC<OverlayProps> = ({ frame, fps, width, height, color }) => {
  const pulses = [
    { cx: width / 2,       phaseOffset: 0,  intensity: 1.0 },
    { cx: width / 2 - 120, phaseOffset: 20, intensity: 0.65 },
    { cx: width / 2 + 120, phaseOffset: 40, intensity: 0.65 },
  ];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={overlayStyle}>
      {pulses.map((p, pi) => {
        const progress = ((frame + p.phaseOffset) % 90) / 90;
        const y = interpolate(progress, [0, 1], [height * 0.82, height * 0.1]);
        const r = interpolate(progress, [0, 0.25, 0.8, 1], [4, 18, 12, 4]);
        const opacity = interpolate(progress, [0, 0.08, 0.9, 1], [0, 0.55, 0.45, 0]) * p.intensity;

        // Explosión al llegar al tope (progress > 0.88)
        const exploding = progress > 0.88;
        const explodeT = exploding ? (progress - 0.88) / 0.12 : 0;

        return (
          <g key={pi}>
            <circle cx={p.cx} cy={y} r={r} fill="none"
              stroke={color} strokeWidth={2} opacity={opacity} />
            <circle cx={p.cx} cy={y} r={r * 0.5}
              fill={color} opacity={opacity * 0.7} />
            <line x1={p.cx - r * 2} y1={y} x2={p.cx + r * 2} y2={y}
              stroke={color} strokeWidth={1.5} opacity={opacity * 0.6} />

            {/* Líneas de explosión radiales */}
            {exploding && Array.from({ length: 4 }, (_, k) => {
              const angle = (k / 4) * Math.PI * 2 + pi * 0.5;
              const len = explodeT * 35;
              return (
                <line key={k}
                  x1={p.cx + Math.cos(angle) * r}
                  y1={y + Math.sin(angle) * r}
                  x2={p.cx + Math.cos(angle) * (r + len)}
                  y2={y + Math.sin(angle) * (r + len)}
                  stroke={color} strokeWidth={1}
                  opacity={(1 - explodeT) * 0.45 * p.intensity} />
              );
            })}
          </g>
        );
      })}

      {/* Línea horizontal de barrido cuando el pulso central llega al tope */}
      {(() => {
        const progress = (frame % 90) / 90;
        if (progress < 0.85 || progress > 0.98) return null;
        const sweepT = (progress - 0.85) / 0.13;
        const sweepX = sweepT * width;
        const sweepY = height * 0.1;
        return (
          <line x1={0} y1={sweepY} x2={sweepX} y2={sweepY}
            stroke={color} strokeWidth={1}
            opacity={interpolate(sweepT, [0, 0.5, 1], [0, 0.35, 0])} />
        );
      })()}
    </svg>
  );
};

// ─── GLOBALES (sin cambios) ───────────────────────────────────────────────────
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
        const sparkOpacity = interpolate(progress, [0, 0.1, 0.6, 1], [0.6, 0.7, 0.5, 0]);
        return (
          <g key={i}>
            <line x1={trailEndX} y1={trailEndY} x2={x} y2={y}
              stroke={color} strokeWidth={0.8} opacity={sparkOpacity * 0.6} />
            <circle cx={x} cy={y} r={2} fill={color} opacity={sparkOpacity} />
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
        const opacity = 0.25 + Math.sin(frame * 0.02 + i * 1.5) * 0.15;
        return (
          <polygon key={i} points={points} fill="none"
            stroke={color} strokeWidth={1.2} opacity={opacity}
            transform={`translate(${t.x + offsetX}, ${t.y + offsetY}) rotate(${rot})`} />
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
        const opacity = interpolate(progress, [0, 0.3, 1], [0.5, 0.45, 0]);
        return (
          <circle key={i} cx={p.cx} cy={p.cy} r={r} fill="none"
            stroke={color} strokeWidth={0.8} opacity={opacity} />
        );
      })}
    </svg>
  );
};

// ─── STORM ahora importado de ./Storm ──────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
};
