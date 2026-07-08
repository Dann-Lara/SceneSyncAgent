import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface SubtitleLine {
  startFrame: number;
  endFrame: number;
  text: string;
}

interface LyricsOverlayProps {
  subtitles: SubtitleLine[];
  fontFamily: string;
  primaryColor: string;
}

export const LyricsOverlay: React.FC<LyricsOverlayProps> = ({
  subtitles,
  fontFamily,
  primaryColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeIdx = subtitles.findIndex(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );
  const active = activeIdx >= 0 ? subtitles[activeIdx] : null;

  if (!active) return null;

  const lineFadeFrames = Math.max(1, Math.round(0.12 * fps));
  const distFromStart = frame - active.startFrame;
  const distFromEnd = active.endFrame - frame;
  const fadeIn = interpolate(distFromStart, [0, lineFadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(distFromEnd, [0, lineFadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "16px 40px",
          background: "rgba(0,0,0,0.75)",
          borderRadius: 14,
          opacity,
          fontFamily,
          fontSize: 52,
          fontWeight: 800,
          color: primaryColor,
          textAlign: "center",
          maxWidth: "85%",
          textShadow: "0 0 20px rgba(0,0,0,0.95), 0 0 60px rgba(0,0,0,0.5)",
          lineHeight: 1.3,
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
