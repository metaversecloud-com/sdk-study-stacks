export const MasteryRing = ({ pct, size = 48 }: { pct: number; size?: number }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <span
      className="ss-mastery-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Mastery ${clamped}%`}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ss-bg-muted)"
          strokeWidth={4}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ss-mastery)"
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="ss-mastery-ring__label">{clamped}%</span>
    </span>
  );
};

export default MasteryRing;
