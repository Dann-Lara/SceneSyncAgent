import { interpolate, spring, useVideoConfig, Easing } from "remotion";
import { useMemo } from "react";

type KineticAnimation = "pop" | "slide-left" | "slide-up" | "scale" | "typewriter";

interface KineticTextProps {
  text: string;
  frame: number;
  startFrame?: number;
  wordsPerSecond?: number;
  charsPerSecond?: number;
  animation?: KineticAnimation;
  style?: React.CSSProperties;
  wordStyle?: React.CSSProperties;
  activeWordStyle?: React.CSSProperties;
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  frame,
  startFrame = 0,
  wordsPerSecond = 3,
  charsPerSecond = 12,
  animation = "pop",
  style,
  wordStyle,
  activeWordStyle,
}) => {
  const { fps } = useVideoConfig();

  // Typewriter: string slicing per skill recommendation (no per-character opacity)
  if (animation === "typewriter") {
    const localFrame = Math.max(0, frame - startFrame);
    const charsPerFrame = charsPerSecond / fps;
    const charCount = Math.min(text.length, Math.floor(localFrame * charsPerFrame));
    const visibleText = text.slice(0, charCount);
    const cursorOpacity = interpolate(
      localFrame % 16,
      [0, 8, 16],
      [1, 0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    return (
      <div style={{ ...container, ...style }}>
        <span style={{ ...baseWord, ...wordStyle }}>
          {visibleText}
          {charCount < text.length && (
            <span style={{ opacity: cursorOpacity }}>▌</span>
          )}
        </span>
      </div>
    );
  }

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const localFrame = Math.max(0, frame - startFrame);
  const framesPerWord = fps / wordsPerSecond;
  const revealDuration = 6;

  const getWordStyle = (index: number): React.CSSProperties => {
    const wordStartFrame = index * framesPerWord;
    const wordEndFrame = wordStartFrame + framesPerWord;
    const revealStart = wordStartFrame;
    const isActive = localFrame >= wordStartFrame && localFrame < wordEndFrame;
    const isRevealed = localFrame >= wordEndFrame;
    const progressInWord = isActive
      ? (localFrame - revealStart) / revealDuration
      : isRevealed ? 1 : 0;

    if (!isRevealed && !isActive) {
      return { ...baseWord, opacity: 0, ...wordStyle };
    }

    let opacity = 1;
    let transform = "none";

    switch (animation) {
      case "pop":
        const popScale = spring({
          frame: localFrame - revealStart,
          fps,
          from: 0,
          to: 1,
          config: { damping: 8, mass: 0.5, stiffness: 200 },
        });
        opacity = interpolate(popScale, [0, 0.5, 1], [0, 1, 1]);
        transform = `scale(${popScale})`;
        break;

      case "slide-left":
        const slX = interpolate(progressInWord, [0, 1], [-20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        opacity = interpolate(progressInWord, [0, 0.2, 1], [0, 1, 1]);
        transform = `translateX(${slX}px)`;
        break;

      case "slide-up":
        const suY = interpolate(progressInWord, [0, 1], [20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        opacity = interpolate(progressInWord, [0, 0.2, 1], [0, 1, 1]);
        transform = `translateY(${suY}px)`;
        break;

      case "scale":
        const sc = interpolate(progressInWord, [0, 1], [0.3, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        opacity = interpolate(sc, [0.3, 0.6], [0, 1]);
        transform = `scale(${sc})`;
        break;

    }

    return {
      ...baseWord,
      opacity,
      transform,
      ...wordStyle,
      ...(isActive ? activeWordStyle : {}),
    };
  };

  return (
    <div style={{ ...container, ...style }}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} style={getWordStyle(i)}>
          {word}
          {i < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </div>
  );
};

const container: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
};

const baseWord: React.CSSProperties = {
  display: "inline-block",
  whiteSpace: "pre-wrap",
  transition: "none",
};
