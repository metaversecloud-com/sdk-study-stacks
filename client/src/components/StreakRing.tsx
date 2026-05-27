import { useEffect, useState } from "react";

export const StreakRing = ({ current, longest }: { current: number; longest: number }) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <span
      className={`ss-streak-pill${pulse ? " ss-streak-pill--pulse" : ""}`}
      aria-label={`Current streak ${current} days, longest ${longest} days`}
      role="status"
    >
      <span className="ss-streak-pill__icon" aria-hidden="true">🔥</span>
      <span>{current}-day streak</span>
    </span>
  );
};

export default StreakRing;
