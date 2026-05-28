import { Deck, StudyMode } from "@shared/types/StudyStacksTypes";
import { useClickOnce } from "@/utils";

export const ModePicker = ({
  deck,
  onPick,
  onCancel,
  onEdit,
}: {
  deck: Deck;
  onPick: (mode: StudyMode) => void;
  onCancel: () => void;
  /** Render an Edit button next to Back. Caller decides eligibility (e.g. only
   * the deck's creator). */
  onEdit?: () => void;
}) => {
  const canQuiz = deck.cards.length >= 1;
  const canSprint = deck.cards.length >= 1;
  // Once any action is picked, lock the screen so a rage-click can't start two
  // sessions (or fire a navigation twice) before this view transitions out.
  const { disabled: busy, guard } = useClickOnce();
  return (
    <div>
      <div className="ss-header-row">
        <div>
          <h2 className="ss-text-light">{deck.title}</h2>
          <p className="p3 ss-text-light">
            {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} · {deck.difficulty}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {onEdit && (
            <button className="btn btn-outline" onClick={guard(onEdit)} disabled={busy}>
              ✎ Edit
            </button>
          )}
          <button className="btn btn-outline" onClick={guard(onCancel)} disabled={busy}>
            Back
          </button>
        </div>
      </div>

      <h3 className="ss-section-label">Choose a study mode</h3>
      <div className="ss-mode-grid mt-2">
        <button className="ss-mode-card ss-mode-card--flip" onClick={guard(() => onPick("flip"))} disabled={busy}>
          <div className="ss-mode-card__title">🔁 Flip</div>
          <div className="ss-mode-card__desc">See the prompt, recall the answer, tap to flip, rate yourself.</div>
        </button>
        <button
          className="ss-mode-card ss-mode-card--quiz"
          onClick={guard(() => onPick("quiz"))}
          disabled={busy || !canQuiz}
        >
          <div className="ss-mode-card__title">❓ Quiz</div>
          <div className="ss-mode-card__desc">Pick the right answer from four options.</div>
        </button>
        <button
          className="ss-mode-card ss-mode-card--sprint"
          onClick={guard(() => onPick("sprint"))}
          disabled={busy || !canSprint}
        >
          <div className="ss-mode-card__title">⚡ Sprint</div>
          <div className="ss-mode-card__desc">60-second timed challenge — go fast!</div>
        </button>
      </div>
    </div>
  );
};

export default ModePicker;
