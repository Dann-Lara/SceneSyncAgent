import { interpolate, spring, useVideoConfig } from "remotion";

interface PunchTextProps {
  text: string;
  frame: number;
  startFrame: number;
  duration?: number;
  color?: string;
  backgroundColor?: string;
  size?: number;
  shake?: boolean;
  glitch?: boolean;
  style?: React.CSSProperties;
}

export const PunchText: React.FC<PunchTextProps> = ({
  text,
  frame,
  startFrame,
  duration = 30,
  color = "#ffffff",
  backgroundColor = "rgba(0,0,0,0.8)",
  size = 64,
  shake = true,
  glitch = true,
  style,
}) => {
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - startFrame);

  if (localFrame > duration) return null;

  const progress = localFrame / duration;

  const opacity = interpolate(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const revealScale = spring({
    frame: localFrame,
    fps,
    from: 0.2,
    to: 1,
    config: { damping: 6, mass: 0.6, stiffness: 300 },
  });

  const shakeX = shake
    ? interpolate(progress, [0, 0.05, 0.1, 0.15, 0.2], [0, 4, -3, 2, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const rotate = glitch
    ? interpolate(progress, [0, 0.03, 0.06, 0.1], [0, -2, 1.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
        pointerEvents: "none",
        ...style,
      }}
    >
      <div
        style={{
          padding: "20px 48px",
          backgroundColor,
          borderRadius: 8,
          border: `2px solid rgba(255,255,255,0.2)`,
          opacity,
          transform: `scale(${revealScale}) translateX(${shakeX}px) rotate(${rotate}deg)`,
          boxShadow: `0 0 60px rgba(0,0,0,0.6)`,
        }}
      >
        <div
          style={{
            color,
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.2,
            textAlign: "center",
            textShadow: `0 2px 20px rgba(0,0,0,0.8)`,
            fontFamily: "'Courier New', monospace",
            letterSpacing: -1,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
