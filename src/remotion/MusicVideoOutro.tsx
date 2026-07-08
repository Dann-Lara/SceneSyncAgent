import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface MusicVideoOutroProps {
  channelName: string;
  songTitle: string;
  authorName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
}

export const MusicVideoOutro: React.FC<MusicVideoOutroProps> = ({
  channelName,
  songTitle,
  authorName,
  primaryColor,
  secondaryColor,
  backgroundColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15, 55, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleUp = interpolate(frame, [0, 20], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const authorOpacity = interpolate(frame, [20, 35, 85, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subscribeOpacity = interpolate(frame, [60, 75, 110, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subscribePulse = interpolate(frame, [75, 90, 105, 120], [1, 1.08, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowIntensity = interpolate(frame, [30, 60, 90, 120], [0, 1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        position: "relative",
        overflow: "hidden",
        fontFamily,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Song title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleUp}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: primaryColor,
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: 4,
            lineHeight: 1.3,
            textShadow: `0 4px 30px rgba(0,0,0,0.8)`,
          }}
        >
          {songTitle}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 80,
          height: 2,
          backgroundColor: primaryColor,
          margin: "24px auto",
          opacity: titleOpacity,
        }}
      />

      {/* Author */}
      <div
        style={{
          opacity: authorOpacity,
          color: "#ffffff",
          fontSize: 40,
          letterSpacing: 4,
          textAlign: "center",
        }}
      >
        Una composición de
        <div
          style={{
            color: secondaryColor,
            fontSize: 47,
            fontWeight: 600,
            marginTop: 6,
            letterSpacing: 6,
          }}
        >
          {authorName}
        </div>
      </div>

      {/* Glow ring */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: `1px solid ${primaryColor}`,
          opacity: glowIntensity * 0.15,
          transform: `scale(${glowIntensity})`,
          pointerEvents: "none",
        }}
      />

      {/* Subscribe */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          opacity: subscribeOpacity,
          transform: `scale(${subscribePulse})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "24px 60px",
            border: `1px solid ${primaryColor}66`,
            borderRadius: 4,
            backgroundColor: `${backgroundColor}cc`,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: secondaryColor,
              boxShadow: `0 0 10px ${secondaryColor}`,
            }}
          />
          <span
            style={{
              color: "#ffffff",
              fontSize: 38,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Suscríbete — {channelName}
          </span>
        </div>
      </div>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
