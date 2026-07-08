import { interpolate } from "remotion";

interface ProgressBarProps {
  frame: number;
  totalFrames: number;
  style?: React.CSSProperties;
  color?: string;
  chapterIndex?: number;
  totalChapters?: number;
  displayIndex?: number;
  displayTotal?: number;
  show?: "always" | "during-chapter";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  frame,
  totalFrames,
  style,
  color = "#1a3a5c",
  chapterIndex,
  totalChapters,
  displayIndex,
  displayTotal,
  show = "during-chapter",
}) => {
  const progress = totalFrames > 0 ? frame / totalFrames : 0;

  const opacity = show === "always"
    ? 1
    : interpolate(progress, [0, 0.02, 0.95, 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const totalWidth = 400;
  const filledWidth = interpolate(progress, [0, 1], [0, totalWidth], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 42,
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
            fontSize: 36,
            letterSpacing: 6,
            fontFamily: "'Courier New', monospace",
            fontWeight: 400,
            minWidth: 180,
            textAlign: "right",
          }}
        >
          {displayIndex !== undefined ? String(displayIndex).padStart(2, "0") : String(chapterIndex + 1).padStart(2, "0")}/{displayTotal !== undefined ? String(displayTotal).padStart(2, "0") : String(totalChapters).padStart(2, "0")}
        </div>
      )}

      <div
        style={{
          width: totalWidth,
          height: 6,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 3,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: filledWidth,
            backgroundColor: color,
            borderRadius: 3,
            boxShadow: `0 0 18px ${color}66`,
            transition: "none",
          }}
        />
      </div>
    </div>
  );
};
