import { interpolate } from "remotion";

interface ProgressBarProps {
  frame: number;
  totalFrames: number;
  style?: React.CSSProperties;
  color?: string;
  chapterIndex?: number;
  totalChapters?: number;
  show?: "always" | "during-chapter";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  frame,
  totalFrames,
  style,
  color = "#1a3a5c",
  chapterIndex,
  totalChapters,
  show = "during-chapter",
}) => {
  const progress = totalFrames > 0 ? frame / totalFrames : 0;

  const opacity = show === "always"
    ? 1
    : interpolate(progress, [0, 0.02, 0.95, 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const totalWidth = 300;
  const filledWidth = interpolate(progress, [0, 1], [0, totalWidth], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        zIndex: 40,
        pointerEvents: "none",
        ...style,
      }}
    >
      {chapterIndex !== undefined && totalChapters !== undefined && (
        <div
          style={{
            color: `${color}cc`,
            fontSize: 12,
            letterSpacing: 2,
            fontFamily: "'Courier New', monospace",
            fontWeight: 400,
            minWidth: 60,
            textAlign: "right",
          }}
        >
          {String(chapterIndex + 1).padStart(2, "0")}/{String(totalChapters).padStart(2, "0")}
        </div>
      )}

      <div
        style={{
          width: totalWidth,
          height: 2,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: filledWidth,
            backgroundColor: color,
            borderRadius: 1,
            boxShadow: `0 0 6px ${color}66`,
            transition: "none",
          }}
        />
      </div>
    </div>
  );
};
