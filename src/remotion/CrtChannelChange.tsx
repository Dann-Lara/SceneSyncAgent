import { interpolate, useCurrentFrame } from "remotion";

export const CrtChannelChange: React.FC = () => {
  const frame = useCurrentFrame();
  const DURATION = 60;
  const progress = frame / DURATION;

  const staticOpacity = interpolate(progress, [0, 0.1, 0.35, 0.5], [0, 0.7, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rollOffset = interpolate(progress, [0, 0.35], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flashOpacity = interpolate(progress, [0.25, 0.3, 0.38, 0.45], [0, 0.9, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glitchBands = interpolate(progress, [0.2, 0.3, 0.5], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scanlineOpacity = interpolate(progress, [0.5, 0.7, 1], [0, 0.3, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#000000",
        overflow: "hidden",
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: staticOpacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.0' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          transform: `translateY(${rollOffset}%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: staticOpacity * 0.6,
          background: `repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(0,0,0,0.15) 2px, rgba(255,255,255,0.05) 4px, rgba(0,0,0,0.1) 6px)`,
          transform: `translateY(${rollOffset * 1.3}%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: flashOpacity,
        }}
      />

      {glitchBands > 0 && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${15 + i * 22 + Math.sin(frame * 3 + i * 7) * 8}%`,
                height: `${4 + Math.sin(frame * 5 + i * 3) * 2}px`,
                backgroundColor: i % 2 === 0 ? "#ffffff" : "#000000",
                opacity: glitchBands * 0.7,
                transform: `translateX(${Math.sin(frame * 8 + i * 5) * 4}%)`,
              }}
            />
          ))}
        </>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: scanlineOpacity,
          background: `repeating-linear-gradient(0deg, transparent 0px, rgba(0,0,0,0.2) 1px, transparent 3px, rgba(0,0,0,0.15) 4px)`,
          backgroundSize: "100% 4px",
        }}
      />
    </div>
  );
};
