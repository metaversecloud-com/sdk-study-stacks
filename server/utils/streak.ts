import { VisitorStudyData } from "@shared/types/StudyStacksTypes.js";

/**
 * Format a UTC timestamp as YYYY-MM-DD. We deliberately use UTC for stability;
 * the plan note about "visitor wall clock" is more aspirational than precise —
 * UTC days are a simple, defensible default that won't get into trouble with
 * DST or timezones the SDK doesn't reliably expose.
 */
export const dateKey = (ts: number): string => {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayDiff = (a: string, b: string): number => {
  const aMs = Date.parse(a + "T00:00:00Z");
  const bMs = Date.parse(b + "T00:00:00Z");
  return Math.round((bMs - aMs) / 86_400_000);
};

/**
 * Pure: given a previous streak and today's date string, return the updated
 * streak. Same-day double-session is a no-op; consecutive day increments;
 * missed days reset to 1.
 */
export const applyDailyStreak = (prev: VisitorStudyData["streak"], today: string): VisitorStudyData["streak"] => {
  if (!prev || !prev.lastDay) {
    return { current: 1, longest: 1, lastDay: today };
  }
  if (prev.lastDay === today) return prev;

  const diff = dayDiff(prev.lastDay, today);
  let current = prev.current;
  if (diff === 1) current += 1;
  else if (diff > 1) current = 1;
  else current = prev.current; // negative diff (clock skew) — keep as-is

  const longest = Math.max(prev.longest || 0, current);
  return { current, longest, lastDay: today };
};
