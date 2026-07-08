import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface MusicVideoTitleBarProps {
  title: string;
  authorName: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  fadeInStart: number;
  fadeInEnd: number;
  fadeOutStart: number;
  fadeOutEnd: number;
}

export const MusicVideoTitleBar: React.FC<MusicVideoTitleBarProps> = ({
  title,
  authorName,
  primaryColor,
  secondaryColor,
  fontFamily,
  fadeInStart,
  fadeInEnd,
  fadeOutStart,
  fadeOutEnd,
}) => {
  const frame = useCurrentFrame();

  const opacity = frame < fadeInStart
    ? 0
    : frame < fadeInEnd
      ? interpolate(frame, [fadeInStart, fadeInEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : frame < fadeOutStart
        ? 1
        : interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const slideX = frame < fadeInStart
    ? -20
    : frame < fadeInEnd
      ? interpolate(frame, [fadeInStart, fadeInEnd], [-20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : frame < fadeOutStart
        ? 0
        : interpolate(frame, [fadeOutStart, fadeOutEnd], [0, -20], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 50,
        left: 30,
        zIndex: 25,
        pointerEvents: "none",
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(10,10,15,0.85)",
          border: `1px solid ${primaryColor}55`,
          borderRadius: 8,
          padding: "12px 32px",
          textAlign: "center",
          fontFamily,
          backdropFilter: "blur(4px)",
          boxShadow: `0 4px 30px rgba(0,0,0,0.6), 0 0 20px ${primaryColor}22`,
        }}
      >
        <div
          style={{
            color: primaryColor,
            fontSize: 29,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            lineHeight: 1.4,
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 40,
            height: 1,
            backgroundColor: secondaryColor,
            margin: "6px auto",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            color: secondaryColor,
            fontSize: 18,
            letterSpacing: 5,
            textTransform: "uppercase",
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {authorName}
        </div>
      </div>
    </div>
  );
};
