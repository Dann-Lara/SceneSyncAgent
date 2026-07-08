import type { ChannelStyle } from "../types";

interface SubtitleOverlayProps {
  subtitles?: { start: number; end: number; text: string }[];
  currentFrame: number;
  fps: number;
  style: ChannelStyle;
  primaryColor?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  subtitles,
  currentFrame,
  fps,
  style,
  primaryColor: propPrimary,
}) => {
  if (!subtitles || subtitles.length === 0) return null;

  const currentTime = currentFrame / fps;

  const activeSubtitle = subtitles.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  if (!activeSubtitle) return null;

  const accentColor = propPrimary ?? style.primaryColor;

  return (
    <div style={subtitleContainer}>
      <div
        style={{
          ...subtitleBox,
          color: "#fff",
          borderBottom: `3px solid ${accentColor}`,
        }}
      >
        {activeSubtitle.text}
      </div>
    </div>
  );
};

const subtitleContainer: React.CSSProperties = {
  position: "absolute",
  bottom: 160,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
};

const subtitleBox: React.CSSProperties = {
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  padding: "12px 28px",
  borderRadius: 8,
  fontSize: 28,
  fontWeight: 500,
  textAlign: "center",
  maxWidth: "80%",
  lineHeight: 1.4,
  backdropFilter: "blur(4px)",
};
