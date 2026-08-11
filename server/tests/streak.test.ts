import { applyDailyStreak, dateKey } from "../utils/streak.js";

describe("dateKey", () => {
  test("formats as YYYY-MM-DD", () => {
    expect(dateKey(Date.UTC(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(dateKey(Date.UTC(2026, 11, 31, 23))).toBe("2026-12-31");
  });
});

describe("applyDailyStreak", () => {
  test("first session starts streak at 1", () => {
    const out = applyDailyStreak({ current: 0, longest: 0, lastDay: "" }, "2026-05-21");
    expect(out).toEqual({ current: 1, longest: 1, lastDay: "2026-05-21" });
  });

  test("same-day double session is a no-op", () => {
    const prev = { current: 4, longest: 7, lastDay: "2026-05-21" };
    const out = applyDailyStreak(prev, "2026-05-21");
    expect(out).toBe(prev);
  });

  test("consecutive day increments", () => {
    const out = applyDailyStreak({ current: 3, longest: 3, lastDay: "2026-05-20" }, "2026-05-21");
    expect(out).toEqual({ current: 4, longest: 4, lastDay: "2026-05-21" });
  });

  test("missed day resets to 1 but keeps longest", () => {
    const out = applyDailyStreak({ current: 5, longest: 10, lastDay: "2026-05-18" }, "2026-05-21");
    expect(out).toEqual({ current: 1, longest: 10, lastDay: "2026-05-21" });
  });

  test("year boundary still consecutive", () => {
    const out = applyDailyStreak({ current: 5, longest: 5, lastDay: "2025-12-31" }, "2026-01-01");
    expect(out).toEqual({ current: 6, longest: 6, lastDay: "2026-01-01" });
  });

  test("longest is preserved when current drops", () => {
    const out = applyDailyStreak({ current: 8, longest: 12, lastDay: "2026-05-15" }, "2026-05-21");
    expect(out.longest).toBe(12);
    expect(out.current).toBe(1);
  });
});
