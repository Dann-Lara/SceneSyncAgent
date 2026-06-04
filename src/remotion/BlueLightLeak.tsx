import { interpolate, useCurrentFrame } from "remotion";

interface BlueLightLeakProps {
  durationInFrames: number;
  seed: number;
  color: string;
}

export const BlueLightLeak: React.FC<BlueLightLeakProps> = ({ durationInFrames, seed, color }) => {
  const frame = useCurrentFrame();
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;

  const driftX = (Math.sin(frame * 0.008 + seed * 1.7) * 0.5 + 0.5) * 100;
  const driftY = (Math.cos(frame * 0.006 + seed * 3.1) * 0.5 + 0.5) * 60;
  const pulse = Math.sin(frame * 0.03 + seed * 5.3) * 0.3 + 0.7;
  const opacity = interpolate(progress, [0, 0.05, 0.8, 1], [0, 0.6, 0.35, 0]);

  const bandOpacity = Math.sin(frame * 0.02 + seed * 2.9) * 0.15 + 0.25;
  const bandY = (Math.sin(frame * 0.01 + seed * 4.7) * 0.5 + 0.5) * 100;

  return (
    <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={`leak-glow-${seed}`} cx="50%" cy="30%">
          <stop offset="0%" stopColor={color} stopOpacity={0.4 * pulse * opacity} />
          <stop offset="40%" stopColor={color} stopOpacity={0.15 * pulse * opacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`leak-band-${seed}`} x1="0%" y1={`${bandY}%`} x2="100%" y2={`${bandY + 8}%`}>
          <stop offset="0%" stopColor={color} stopOpacity={0} />
          <stop offset="30%" stopColor={color} stopOpacity={0.3 * bandOpacity * opacity} />
          <stop offset="50%" stopColor={color} stopOpacity={0.5 * bandOpacity * opacity} />
          <stop offset="70%" stopColor={color} stopOpacity={0.3 * bandOpacity * opacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`leak-blur-${seed}`}>
          <feGaussianBlur stdDeviation="60" />
        </filter>
        <filter id={`leak-band-blur-${seed}`}>
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>

      <rect
        x={`${-200 + driftX}`}
        y={`${-100 + driftY}`}
        width={`${600 + driftX}`}
        height={`${400 + driftY}`}
        fill={`url(#leak-glow-${seed})`}
        filter={`url(#leak-blur-${seed})`}
      />
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill={`url(#leak-band-${seed})`}
        filter={`url(#leak-band-blur-${seed})`}
      />
    </svg>
  );
};
