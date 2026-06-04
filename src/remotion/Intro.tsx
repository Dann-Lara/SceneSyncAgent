import { interpolate, useCurrentFrame } from "remotion";
import { useMemo } from "react";
import type { ChannelStyle } from "../types";
import { KineticText } from "./KineticText";
import { ParticleOverlay } from "./ParticleOverlay";
import { BlueLightLeak } from "./BlueLightLeak";

interface IntroProps {
  duration: number;
  channelStyle: ChannelStyle;
  videoPath?: string;
}

const HEX_CHARS = "0123456789ABCDEF";

function RedactedLines({ color, opacity }: { color: string; opacity: number }) {
  const lines = [
    { w: "62%", y: "19%", indent: "8%", redacted: false },
    { w: "78%", y: "23%", indent: "8%", redacted: false },
    { w: "45%", y: "27%", indent: "8%", redacted: true },
    { w: "70%", y: "31%", indent: "8%", redacted: false },
    { w: "55%", y: "35%", indent: "8%", redacted: true },
  ];
  return (
    <>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: l.y,
            left: l.indent,
            width: l.w,
            height: 2,
            backgroundColor: l.redacted ? color : `${color}44`,
            opacity: l.redacted ? opacity * 0.9 : opacity * 0.35,
            borderRadius: 1,
          }}
        />
      ))}
    </>
  );
}

// Secuencia de acceso tipo terminal
function AccessSequence({ progress, color }: { progress: number; color: string }) {
  const lines = [
    "INICIANDO PROTOCOLO DE ACCESO...",
    "NIVEL: MÁXIMO CLASIFICADO",
    "VERIFICANDO... ████████████ 100%",
    "ACCESO CONCEDIDO",
  ];
  const visibleLines = Math.floor(progress * (lines.length + 1));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "0 12%",
        opacity: interpolate(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {lines.slice(0, visibleLines).map((line, i) => (
        <div
          key={i}
          style={{
            color: i === lines.length - 1 ? "#ffffff" : `${color}cc`,
            fontSize: i === lines.length - 1 ? 16 : 13,
            fontFamily: "'Courier New', monospace",
            letterSpacing: i === lines.length - 1 ? 6 : 3,
            fontWeight: i === lines.length - 1 ? 700 : 400,
            marginBottom: 10,
            textShadow: `0 0 20px ${color}88`,
            textTransform: "uppercase",
          }}
        >
          {i === lines.length - 1 ? "▶ " : "  "}{line}
        </div>
      ))}
    </div>
  );
}

export const Intro: React.FC<IntroProps> = ({ duration, channelStyle }) => {
  const frame = useCurrentFrame();
  const progress = duration > 0 ? frame / duration : 0;

  // Access sequence cubre primeros 25% del Intro
  const accessProgress = interpolate(progress, [0, 0.22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showAccessSeq = progress < 0.26;

  const hookFlash = interpolate(frame, [0, 3, 8], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleReveal = interpolate(progress, [0.22, 0.36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleFadeOut = interpolate(progress, [0.82, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = Math.min(titleReveal, titleFadeOut);

  const scrambleProgress = interpolate(progress, [0.22, 0.38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitchX = scrambleProgress < 0.8
    ? Math.sin(frame * 11.3) * (1 - scrambleProgress) * 6
    : 0;

  const channelReveal = interpolate(progress, [0.38, 0.54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const channelFade = interpolate(progress, [0.80, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const channelY = interpolate(progress, [0.38, 0.54], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineGrow = interpolate(progress, [0.34, 0.52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vignetteOpacity = interpolate(progress, [0, 0.08, 0.85, 1], [0.9, 0.5, 0.5, 0.9]);

  const glowPulse = Math.sin(frame * 0.12) * 0.5 + 0.5;
  const glowOpacity = interpolate(progress, [0.15, 0.3, 0.8, 1], [0, 0.6, 0.4, 0]) * glowPulse;

  const scanY = ((frame * 1.8) % 110) - 5;

  const stampOpacity = interpolate(progress, [0.0, 0.04, 0.12, 0.18], [0, 0.85, 0.85, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stampScale = interpolate(progress, [0.0, 0.05], [1.4, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bracketOpacity = interpolate(progress, [0.24, 0.36], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const noiseFlicker = frame % 5 < 1 ? 0.04 : 0.02;

  // Hex data stream grid — determinista, sin Math.random()
  const hexGrid = Array.from({ length: 32 }, (_, r) =>
    Array.from({ length: 52 }, (_, c) =>
      HEX_CHARS[(r * 7 + c * 13 + 42) % 16]
    ).join(" ")
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: channelStyle.backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: channelStyle.fontFamily,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: noiseFlicker,
          mixBlendMode: "overlay",
        }}
      />

      {/* HEX DATA STREAM — fondo animado */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          opacity: 0.04,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            transform: `translateY(-${(frame * 0.3) % 540}px)`,
            fontFamily: "'Courier New', monospace",
            fontSize: 11,
            color: channelStyle.primaryColor,
            lineHeight: "20px",
            letterSpacing: "2px",
            padding: "0 4px",
          }}
        >
          {hexGrid.map((row, i) => <div key={i}>{row}</div>)}
        </div>
      </div>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: vignetteOpacity,
          background: `radial-gradient(ellipse at center, transparent 38%, ${channelStyle.backgroundColor}cc 75%, ${channelStyle.backgroundColor} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 1,
          top: `${scanY}%`,
          background: `linear-gradient(to right, transparent 0%, ${channelStyle.primaryColor}33 30%, ${channelStyle.primaryColor}55 50%, ${channelStyle.primaryColor}33 70%, transparent 100%)`,
          pointerEvents: "none",
          opacity: 0.5,
        }}
      />

      <ParticleOverlay
        frame={frame}
        count={30}
        color={channelStyle.primaryColor}
        speed={0.8}
        sizeRange={[1, 4]}
        opacityRange={[0.04, 0.15]}
      />

      <RedactedLines
        color={channelStyle.primaryColor}
        opacity={interpolate(progress, [0.2, 0.4, 0.8, 1], [0, 0.8, 0.8, 0])}
      />

      {/* Secuencia de acceso terminal */}
      {showAccessSeq && (
        <AccessSequence progress={accessProgress} color={channelStyle.primaryColor} />
      )}

      {/* Sello CLASIFICADO */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(-12deg) scale(${stampScale})`,
          opacity: stampOpacity,
          border: `5px solid ${channelStyle.primaryColor}`,
          padding: "10px 28px",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: 10,
            textTransform: "uppercase",
            fontFamily: "'Limelight', serif",
            textShadow: `0 0 30px ${channelStyle.primaryColor}aa, 0 2px 4px rgba(0,0,0,0.8)`,
          }}
        >
          CLASIFICADO
        </div>
      </div>

      {/* Corner brackets */}
      {[
        { top: "18%", left: "6%", borderTop: true, borderLeft: true },
        { top: "18%", right: "6%", borderTop: true, borderRight: true },
        { bottom: "18%", left: "6%", borderBottom: true, borderLeft: true },
        { bottom: "18%", right: "6%", borderBottom: true, borderRight: true },
      ].map((corner, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 28,
            height: 28,
            opacity: bracketOpacity,
            ...corner,
            borderTop: corner.borderTop ? `2px solid ${channelStyle.primaryColor}88` : "none",
            borderBottom: corner.borderBottom ? `2px solid ${channelStyle.primaryColor}88` : "none",
            borderLeft: corner.borderLeft ? `2px solid ${channelStyle.primaryColor}88` : "none",
            borderRight: corner.borderRight ? `2px solid ${channelStyle.primaryColor}88` : "none",
          }}
        />
      ))}

      {/* Glow radial */}
      <div
        style={{
          position: "absolute",
          width: "70%",
          height: "30%",
          top: "35%",
          left: "15%",
          background: `radial-gradient(ellipse at center, ${channelStyle.primaryColor}22 0%, transparent 70%)`,
          opacity: glowOpacity,
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />

      {/* TÍTULO con backdrop */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${glitchX}px), -50%)`,
          opacity: titleOpacity,
          zIndex: 3,
          width: "88%",
          textAlign: "center",
        }}
      >
        {/* Backdrop semitransparente — mejora legibilidad sobre cualquier imagen de fondo */}
        <div
          style={{
            display: "inline-block",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(12px)",
            padding: "28px 48px",
            borderRadius: 8,
            border: `1px solid ${channelStyle.primaryColor}22`,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -1,
              fontFamily: channelStyle.fontFamily,
              textShadow: `0 4px 40px rgba(0,0,0,0.8), 0 0 80px ${channelStyle.primaryColor}22`,
              position: "relative",
              zIndex: 2,
            }}
          >
            <KineticText
              text={channelStyle.videoTitle}
              frame={frame}
              startFrame={Math.floor(duration * 0.22)}
              wordsPerSecond={3}
              animation="pop"
              style={{ justifyContent: "center" }}
            />
          </div>
        </div>
      </div>

      {/* Línea divisora */}
      <div
        style={{
          position: "absolute",
          top: "calc(50% + 54px)",
          left: `${50 - 18 * lineGrow}%`,
          width: `${36 * lineGrow}%`,
          height: 1,
          backgroundColor: channelStyle.primaryColor,
          opacity: 0.6 * Math.min(channelReveal, channelFade),
        }}
      />

      {/* Nombre del canal */}
      <div
        style={{
          position: "absolute",
          top: "calc(50% + 72px)",
          left: "50%",
          transform: `translate(-50%, ${channelY}px)`,
          opacity: Math.min(channelReveal, channelFade),
          zIndex: 3,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 18,
            letterSpacing: 8,
            textTransform: "uppercase",
            fontWeight: 500,
            fontFamily: channelStyle.fontFamily,
            textShadow: `0 0 30px ${channelStyle.primaryColor}aa, 0 2px 4px rgba(0,0,0,0.8)`,
          }}
        >
          {channelStyle.channelName}
        </div>
      </div>

      {/* BlueLightLeak entrada */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(progress, [0, 0.02, 0.15, 1], [1, 1, 0, 0]),
          zIndex: 12,
          pointerEvents: "none",
        }}
      >
        <BlueLightLeak durationInFrames={Math.floor(duration * 0.15)} seed={0} color={channelStyle.primaryColor} />
      </div>

      {/* BlueLightLeak salida */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(progress, [0, 0.7, 0.85, 1], [0, 0, 0.6, 0]),
          zIndex: 12,
          pointerEvents: "none",
        }}
      >
        <BlueLightLeak durationInFrames={Math.floor(duration * 0.3)} seed={3} color={channelStyle.primaryColor} />
      </div>

      {/* Hook flash inicial */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: hookFlash,
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      {/* Fade-out final */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: channelStyle.backgroundColor,
          opacity: interpolate(progress, [0.88, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          pointerEvents: "none",
          zIndex: 15,
        }}
      />
    </div>
  );
};
