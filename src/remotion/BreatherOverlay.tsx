import { interpolate } from "remotion";

interface BreatherOverlayProps {
  frame: number;
  startFrame: number;
  duration?: number;
  opacity?: number;
  children?: React.ReactNode;
}

export const BreatherOverlay: React.FC<BreatherOverlayProps> = ({
  frame,
  startFrame,
  duration = 90,
  opacity = 0.7,
  children,
}) => {
  const localFrame = Math.max(0, frame - startFrame);

  if (localFrame > duration) return null;

  const progress = localFrame / duration;

  const overlayOpacity = interpolate(progress, [0, 0.15, 0.85, 1], [0, opacity, opacity, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const contentOpacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideUp = interpolate(progress, [0, 0.2], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: `rgba(13,13,13,${overlayOpacity * 0.8})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 25,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: contentOpacity,
          transform: `translateY(${slideUp}px)`,
          maxWidth: "70%",
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
};
