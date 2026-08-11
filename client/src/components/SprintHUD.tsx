export const SprintHUD = ({
  remainingMs,
  score,
}: {
  remainingMs: number;
  score: number;
}) => {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const danger = seconds <= 10;
  return (
    <div className="ss-sprint-hud">
      <span>Score: {score}</span>
      <span
        className={`ss-sprint-timer${danger ? " ss-sprint-timer--danger" : ""}`}
        aria-live="polite"
        aria-label={`${seconds} seconds remaining`}
      >
        ⏱ {seconds}s
      </span>
    </div>
  );
};

export default SprintHUD;
