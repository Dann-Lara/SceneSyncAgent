import { interpolate, useCurrentFrame } from "remotion";
import type { ChannelStyle } from "../types";
import { BlueLightLeak } from "./BlueLightLeak";

interface OutroProps {
  duration: number;
  channelStyle: ChannelStyle;
  videoPath?: string;
}

export const Outro: React.FC<OutroProps> = ({ duration, channelStyle }) => {
  // FIX: usar useCurrentFrame() directamente, no prop externo
  const frame = useCurrentFrame();
  const progress = duration > 0 ? frame / duration : 0;

  const masterFadeIn = interpolate(progress, [0, 0.12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // FIX: glitch de entrada en primeros 15 frames
  const glitchEntry = frame < 15;
  const glitchX = glitchEntry ? Math.sin(frame * 11.7) * (1 - frame / 15) * 8 : 0;
  const glitchSat = glitchEntry ? `saturate(${frame % 4 < 2 ? 2.5 : 0.1})` : "saturate(1)";

  const glowPulse = Math.sin(frame * 0.08) * 0.3 + 0.7;
  const glowOpacity = interpolate(progress, [0.05, 0.2, 0.9, 1], [0, 0.5, 0.3, 0.1]) * glowPulse;

  const titleIn = interpolate(progress, [0.1, 0.28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(progress, [0.1, 0.28], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const channelIn = interpolate(progress, [0.22, 0.38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineGrow = interpolate(progress, [0.2, 0.36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardsIn = interpolate(progress, [0.42, 0.60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardsY = interpolate(progress, [0.42, 0.60], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const btnPulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.92, 1.04]);
  const btnGlow = Math.sin(frame * 0.12) * 0.5 + 0.5;

  const scanY = ((frame * 1.4) % 110) - 5;

  const bracketOpacity = interpolate(progress, [0.18, 0.35], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const noiseFlicker = frame % 7 < 1 ? 0.035 : 0.015;

  // Estado "ACTIVO" parpadeante para el cierre narrativo
  const statusBlink = Math.sin(frame * 0.25) > 0;
  const statusIn = interpolate(progress, [0.12, 0.28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade-out final propio (últimos 20 frames)
  const finalFade = interpolate(progress, [0.88, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        opacity: masterFadeIn * finalFade,
        position: "relative",
        overflow: "hidden",
        transform: `translateX(${glitchX}px)`,
        filter: glitchSat,
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

      {/* Hex data stream de fondo */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.035, pointerEvents: "none" }}>
        <div
          style={{
            transform: `translateY(-${(frame * 0.25) % 540}px)`,
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: channelStyle.primaryColor,
            lineHeight: "18px",
            letterSpacing: "2px",
            padding: "0 8px",
          }}
        >
          {Array.from({ length: 34 }, (_, r) =>
            Array.from({ length: 54 }, (_, c) =>
              "0123456789ABCDEF"[(r * 7 + c * 13 + 17) % 16]
            ).join(" ")
          ).map((row, i) => <div key={i}>{row}</div>)}
        </div>
      </div>

      {/* Glow central */}
      <div
        style={{
          position: "absolute",
          width: "80%",
          height: "60%",
          top: "20%",
          left: "10%",
          background: `radial-gradient(ellipse at center, ${channelStyle.primaryColor}18 0%, transparent 65%)`,
          opacity: glowOpacity,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 35%, ${channelStyle.backgroundColor}bb 70%, ${channelStyle.backgroundColor} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0, height: 1,
          top: `${scanY}%`,
          background: `linear-gradient(to right, transparent 0%, ${channelStyle.primaryColor}22 30%, ${channelStyle.primaryColor}44 50%, ${channelStyle.primaryColor}22 70%, transparent 100%)`,
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />

      {/* Corner brackets */}
      {[
        { top: "8%", left: "4%", borderTop: true, borderLeft: true },
        { top: "8%", right: "4%", borderTop: true, borderRight: true },
        { bottom: "8%", left: "4%", borderBottom: true, borderLeft: true },
        { bottom: "8%", right: "4%", borderBottom: true, borderRight: true },
      ].map((corner, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 24, height: 24,
            opacity: bracketOpacity,
            ...corner,
            borderTop: corner.borderTop ? `2px solid ${channelStyle.primaryColor}66` : "none",
            borderBottom: corner.borderBottom ? `2px solid ${channelStyle.primaryColor}66` : "none",
            borderLeft: corner.borderLeft ? `2px solid ${channelStyle.primaryColor}66` : "none",
            borderRight: corner.borderRight ? `2px solid ${channelStyle.primaryColor}66` : "none",
          }}
        />
      ))}

      {/* Indicador de caso activo */}
      <div
        style={{
          position: "absolute",
          top: "14%",
          right: "6%",
          opacity: statusIn,
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 4,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: statusBlink ? channelStyle.primaryColor : "transparent",
            border: `1.5px solid ${channelStyle.primaryColor}`,
            boxShadow: statusBlink ? `0 0 8px ${channelStyle.primaryColor}` : "none",
            transition: "none",
          }}
        />
        <div
          style={{
            color: channelStyle.primaryColor,
            fontSize: 11,
            letterSpacing: 4,
            fontFamily: "'Courier New', monospace",
            fontWeight: 500,
            opacity: 0.85,
          }}
        >
          CASO: {channelStyle.videoTitle?.toUpperCase().slice(0, 18) ?? "ARCHIVO"} — ACTIVO
        </div>
      </div>

      {/* Título + canal */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 3,
          marginBottom: 48,
        }}
      >
        <div
          style={{
            opacity: titleIn,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 13,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontFamily: "'Limelight', serif",
              fontWeight: 500,
              marginBottom: 10,
              textShadow: `0 0 20px ${channelStyle.primaryColor}88`,
            }}
          >
            FIN DEL ARCHIVO
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)",
              padding: "16px 36px",
              borderRadius: 8,
              border: `1px solid ${channelStyle.primaryColor}22`,
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: -0.5,
                fontFamily: "'Limelight', serif",
                textShadow: `0 2px 30px rgba(0,0,0,0.7), 0 0 50px ${channelStyle.primaryColor}22`,
                lineHeight: 1.2,
              }}
            >
              El expediente continúa.
            </div>
          </div>
        </div>

        <div
          style={{
            width: `${lineGrow * 140}px`,
            height: 1,
            backgroundColor: channelStyle.primaryColor,
            opacity: 0.5,
            marginBottom: 14,
            boxShadow: `0 0 8px ${channelStyle.primaryColor}44`,
          }}
        />

        <div
          style={{
            opacity: channelIn,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 16,
              letterSpacing: 7,
              textTransform: "uppercase",
              fontWeight: 500,
              fontFamily: "'Limelight', serif",
              textShadow: `0 0 30px ${channelStyle.primaryColor}aa, 0 2px 4px rgba(0,0,0,0.8)`,
            }}
          >
            {channelStyle.channelName}
          </div>
          <div
            style={{
              color: `${channelStyle.primaryColor}99`,
              fontSize: 11,
              letterSpacing: 3,
              fontFamily: "'Courier New', monospace",
              textTransform: "uppercase",
            }}
          >
            ACADEMIA DE ANÁLISIS CLASIFICADO
          </div>
        </div>
      </div>

      {/* Cards: suscripción + próximo */}
      <div
        style={{
          opacity: cardsIn,
          transform: `translateY(${cardsY}px)`,
          display: "flex",
          gap: 28,
          zIndex: 4,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: "16px 44px",
              border: `2px solid ${channelStyle.primaryColor}`,
              borderRadius: 6,
              backgroundColor: `${channelStyle.primaryColor}22`,
              transform: `scale(${btnPulse})`,
              boxShadow: `0 0 ${24 * btnGlow}px ${channelStyle.primaryColor}44, 0 4px 20px rgba(0,0,0,0.5)`,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              SUSCRIBIRSE
            </div>
            <div
              style={{
                color: `${channelStyle.primaryColor}cc`,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                textAlign: "center",
                marginTop: 4,
                fontFamily: "'Courier New', monospace",
              }}
            >
              {channelStyle.channelName}
            </div>
          </div>
          <div
            style={{
              color: `rgba(255,255,255,0.4)`,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Activar la campana
          </div>
        </div>

        <div
          style={{
            width: 1,
            backgroundColor: `${channelStyle.primaryColor}33`,
            alignSelf: "stretch",
            margin: "4px 0",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 220,
              height: 72,
              border: `1px solid ${channelStyle.primaryColor}44`,
              borderRadius: 6,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "14px solid transparent",
                borderBottom: "14px solid transparent",
                borderLeft: `22px solid ${channelStyle.primaryColor}`,
                opacity: 0.7,
              }}
            />
            <div
              style={{
                color: `rgba(255,255,255,0.3)`,
                fontSize: 10,
                letterSpacing: 2,
                fontFamily: "'Courier New', monospace",
                textTransform: "uppercase",
              }}
            >
              EN PRODUCCIÓN
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at center, ${channelStyle.primaryColor}11 0%, transparent 70%)`,
              }}
            />
          </div>
          <div
            style={{
              color: `rgba(255,255,255,0.4)`,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Próximo análisis
          </div>
        </div>
      </div>

      {/* BlueLightLeak */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(progress, [0, 0.1, 0.6, 1], [0.8, 0.4, 0.3, 0]),
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <BlueLightLeak durationInFrames={Math.floor(duration * 0.5)} seed={2} color={channelStyle.primaryColor} />
      </div>

      {/* Watermark canal */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 32,
          opacity: interpolate(progress, [0.3, 0.5, 0.9, 1], [0, 0.35, 0.35, 0]),
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 3,
        }}
      >
        <div style={{ width: 2, height: 24, backgroundColor: channelStyle.primaryColor }} />
        <div
          style={{
            color: "#ffffff",
            fontSize: 13,
            letterSpacing: 3,
            fontFamily: "'Special Elite', 'Courier New', monospace",
            fontWeight: 500,
            textShadow: `0 0 20px ${channelStyle.primaryColor}88`,
          }}
        >
          {channelStyle.channelName}
        </div>
      </div>
    </div>
  );
};
