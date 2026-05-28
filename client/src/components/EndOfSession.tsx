import { useContext } from "react";
import type { SessionSummary } from "@shared/types/StudyStacksTypes";
import { GlobalStateContext } from "@context/GlobalContext";
import { useClickOnce } from "@/utils";
import Confetti from "./Confetti";

export const EndOfSession = ({
  summary,
  onStudyAgain,
  onLibrary,
}: {
  summary: SessionSummary;
  onStudyAgain: () => void;
  onLibrary: () => void;
}) => {
  const { badges } = useContext(GlobalStateContext);
  // Lock both buttons after the first click so a rage-click can't fire both
  // navigations.
  const { disabled: busy, guard } = useClickOnce();
  const mastered = Object.values(summary.masteryDeltas).filter((v) => v > 0).length;
  const revisit = Object.values(summary.masteryDeltas).filter((v) => v < 0).length;
  const accuracy = summary.cardsStudied > 0 ? Math.round((summary.correctCount / summary.cardsStudied) * 100) : 0;

  return (
    <>
      <Confetti />
      <div className="ss-end-card grid gap-2">
        <h2 className="h2">Nice work!</h2>
        <p>
          <span className="ss-end-stat">{summary.correctCount}</span> / {summary.cardsStudied} correct
          <span className="ml-2" style={{ color: "var(--ss-text-dim)" }}>
            ({accuracy}%)
          </span>
        </p>
        <p className="p2" style={{ color: "var(--ss-text-dim)" }}>
          {mastered} mastered{revisit > 0 ? `, ${revisit} to revisit` : ""}
        </p>

        <div className="mt-2" role="status">
          🔥 You're on a {summary.streakAfter.current}-day streak (longest: {summary.streakAfter.longest})
        </div>

        {summary.newBadges.length > 0 && (
          <div className="mt-4 mb-2">
            <h3 className="h4 mb-2">New badges</h3>
            <ul className="ss-badge-grid">
              {summary.newBadges.map((name) => {
                const b = badges[name];
                return (
                  <li key={name} className="ss-badge-tile">
                    {b?.icon ? (
                      <img src={b.icon} alt="" className="ss-badge-tile__img" />
                    ) : (
                      <div className="ss-badge-tile__placeholder" aria-hidden="true">
                        🏅
                      </div>
                    )}
                    <span className="p3" style={{ fontWeight: 600 }}>
                      {b?.name || name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-center">
          <button className="btn" onClick={guard(onStudyAgain)} disabled={busy}>
            Study again
          </button>
          <button className="btn btn-outline" onClick={guard(onLibrary)} disabled={busy}>
            Back to Library
          </button>
        </div>
      </div>
    </>
  );
};

export default EndOfSession;
