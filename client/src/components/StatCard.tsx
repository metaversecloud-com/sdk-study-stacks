import type { ReactNode } from "react";

/**
 * A small stat tile: a large number with its label sitting next to it,
 * bottom-aligned to the number's baseline.
 */
export const StatCard = ({ value, label }: { value: ReactNode; label: string }) => (
  <div className="card ss-stat-card">
    <span className="ss-stat-card__value">{value}</span>
    <span className="ss-stat-card__label">{label}</span>
  </div>
);

export default StatCard;
