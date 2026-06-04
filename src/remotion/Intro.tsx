import { interpolate, useCurrentFrame } from "remotion";
import type { ChannelStyle } from "../types";
import { KineticText } from "./KineticText";
import { ParticleOverlay } from "./ParticleOverlay";
import { BlueLightLeak } from "./BlueLightLeak";

interface IntroProps {
  duration: number;
  channelStyle: ChannelStyle;
  videoPath?: string;
}

function RedactedLines({ color, opacity }: { color: string; opacity: number }) {
  const lines = [
    { w: "62%", y: "19%", indent: "8%" },
    { w: "78%", y: "23%", indent: "8%" },
    { w: "45%", y: "27%", indent: "8%", redacted: true },
    { w: "70%", y: "31%", indent: "8%" },
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

export const Intro: React.FC<IntroProps> = ({ duration, channelStyle }) => {
  const frame = useCurrentFrame();
  const progress = duration > 0 ? frame / duration : 0;
  const FPS = 30;

  const hookFlash = interpolate(frame, [0, 3, 8], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleReveal = interpolate(progress, [0.05, 0.18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleFadeOut = interpolate(progress, [0.82, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = Math.min(titleReveal, titleFadeOut);

  const scrambleProgress = interpolate(progress, [0.05, 0.22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitchX = scrambleProgress < 0.8
    ? Math.sin(frame * 11.3) * (1 - scrambleProgress) * 6
    : 0;

  const channelReveal = interpolate(progress, [0.32, 0.52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const channelFade = interpolate(progress, [0.80, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const channelY = interpolate(progress, [0.32, 0.52], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineGrow = interpolate(progress, [0.28, 0.48], [0, 1], {
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

  const bracketOpacity = interpolate(progress, [0.18, 0.32], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const noiseFlicker = frame % 5 < 1 ? 0.04 : 0.02;

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          opacity: noiseFlicker,
          mixBlendMode: "overlay",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: vignetteOpacity,
          background: `radial-gradient(ellipse at center, transparent 38%, ${channelStyle.backgroundColor}cc 75%, ${channelStyle.backgroundColor} 100%)`,
          pointerEvents: "none",
        }}
      />

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
        <div
          style={{
            color: "#ffffff",
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: -1,
            fontFamily: "'Limelight', serif",
            textShadow: `0 2px 40px rgba(0,0,0,0.8), 0 0 60px ${channelStyle.primaryColor}33`,
            position: "relative",
            zIndex: 2,
          }}
        >
          <KineticText
            text={channelStyle.videoTitle}
            frame={frame}
            startFrame={Math.floor(duration * 0.05)}
            wordsPerSecond={3}
            animation="pop"
            style={{ justifyContent: "center" }}
          />
        </div>
      </div>

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
            fontFamily: "'Limelight', serif",
            textShadow: `0 0 30px ${channelStyle.primaryColor}aa, 0 2px 4px rgba(0,0,0,0.8)`,
          }}
        >
          {channelStyle.channelName}
        </div>
      </div>

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
