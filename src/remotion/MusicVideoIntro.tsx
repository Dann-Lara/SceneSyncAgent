import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface MusicVideoIntroProps {
  channelName: string;
  songTitle: string;
  authorName: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
}

export const MusicVideoIntro: React.FC<MusicVideoIntroProps> = ({
  channelName,
  songTitle,
  authorName,
  primaryColor,
  secondaryColor,
  backgroundColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();

  const lightningOpacity = interpolate(frame, [0, 3, 5, 8, 12, 15, 30, 33, 36, 40], [0, 1, 0, 0.8, 0, 0.6, 0, 0.9, 0, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flashOpacity = interpolate(frame, [3, 5, 33, 35], [0, 0.6, 0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const channelOpacity = interpolate(frame, [45, 55, 85, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const channelGlitch = frame >= 50 && frame <= 75
    ? Math.sin(frame * 0.7) * 5
    : 0;

  const titleOpacity = interpolate(frame, [85, 95, 130, 140], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSlide = interpolate(frame, [85, 105], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleShake = frame >= 95 && frame <= 115
    ? Math.sin(frame * 1.3) * 3
    : 0;

  const authorOpacity = interpolate(frame, [125, 135, 145, 150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rainDrops = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 67 + 13) % 1920,
    delay: (i * 7) % 45,
    speed: 4 + (i % 3) * 2,
    length: 10 + (i % 5) * 5,
  }));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor,
        position: "relative",
        overflow: "hidden",
        fontFamily,
      }}
    >
      {/* Rain */}
      {rainDrops.map((drop, i) => {
        const rainY = ((frame - drop.delay) * drop.speed) % 1080;
        const rainOpacity = interpolate(
          frame,
          [drop.delay, drop.delay + 5, 145, 150],
          [0, 0.15, 0.15, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: drop.x,
              top: rainY,
              width: 1.5,
              height: drop.length,
              backgroundColor: secondaryColor,
              opacity: rainOpacity,
              borderRadius: 1,
            }}
          />
        );
      })}

      {/* Lightning bolt */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: lightningOpacity,
        }}
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
      >
        <polyline
          points="960,0 1060,300 820,350 1100,700 900,750 1150,1080"
          stroke={primaryColor}
          strokeWidth={3}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <polyline
          points="960,0 920,200 1050,250 890,500 1020,550 850,800"
          stroke={primaryColor}
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.6}
        />
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Flash */}
      {flashOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#ffffff",
            opacity: flashOpacity * 0.15,
          }}
        />
      )}

      {/* Channel name */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          transform: `translateX(-50%) translateX(${channelGlitch}px)`,
          opacity: channelOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: primaryColor,
            fontSize: 51,
            letterSpacing: 12,
            textTransform: "uppercase",
            fontWeight: 700,
            textShadow: `0 0 30px ${primaryColor}44, 0 0 60px ${primaryColor}22`,
          }}
        >
          {channelName}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 30,
            letterSpacing: 6,
            marginTop: 8,
            opacity: 0.6,
            textTransform: "uppercase",
          }}
        >
          presents
        </div>
      </div>

      {/* Song title */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) translateX(${titleShake}px) translateY(${titleSlide}px)`,
          opacity: titleOpacity,
          textAlign: "center",
          width: "90%",
        }}
      >
        <div
          style={{
            color: primaryColor,
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: 4,
            lineHeight: 1.3,
            textShadow: `0 4px 40px rgba(0,0,0,0.8), 0 0 80px ${primaryColor}33`,
            fontFamily,
          }}
        >
          {songTitle}
        </div>
        <div
          style={{
            width: 120,
            height: 2,
            backgroundColor: primaryColor,
            margin: "20px auto",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            color: secondaryColor,
            fontSize: 38,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 400,
          }}
        >
          {authorName}
        </div>
      </div>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
