import { useContext, useEffect, useState } from "react";
import { DeckType, StudyModeType } from "@shared/types/StudyStacksTypes";
import { ConfirmationModal } from "@/components";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { ErrorType, SET_DECKS } from "@/context/types";
import { backendAPI, setErrorMessage, useClickOnce } from "@/utils";

/**
 * "Choose a study mode" picker rendered as a modal so it overlays the Library
 * instead of replacing the page. Portal-mounted to escape any parent
 * stacking context.
 */
export const ModePicker = ({
  deck,
  onPick,
  onCancel,
  onEdit,
  onDelete,
}: {
  deck: DeckType;
  onPick: (mode: StudyModeType) => void;
  onCancel: () => void;
  /** Render an Edit button. Caller decides eligibility
   * (e.g. only the deck's creator). */
  onEdit?: () => void;
  /** Render a Delete button. Same eligibility gate as Edit — when the
   * confirmation succeeds, ModePicker fires the DELETE + dispatches the
   * SET_DECKS update itself (matches DecksList's pattern), then calls
   * this callback so the parent can dismiss the picker. */
  onDelete?: () => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks, userDecks } = useContext(GlobalStateContext);
  const canQuiz = deck.cards.length >= 1;
  const canSprint = deck.cards.length >= 1;
  // Once any action is picked, lock the modal so a rage-click can't start
  // two sessions (or fire a navigation twice) before this view transitions out.
  const { disabled: busy, guard } = useClickOnce();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await backendAPI.delete(`/decks/${deck.id}`, { params: { scope: deck.scope } });
      if (deck.scope === "ecosystem") {
        dispatch!({
          type: SET_DECKS,
          payload: { ecosystemDecks: ecosystemDecks.filter((d) => d.id !== deck.id) },
        });
      } else {
        dispatch!({
          type: SET_DECKS,
          payload: { userDecks: userDecks.filter((d) => d.id !== deck.id) },
        });
      }
      onDelete?.();
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    } finally {
      setConfirmingDelete(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  if (confirmingDelete) {
    return (
      <ConfirmationModal
        title="Delete deck?"
        message={`This will permanently delete "${deck.title}".`}
        handleOnConfirm={handleDelete}
        handleToggleShowConfirmationModal={() => setConfirmingDelete(false)}
      />
    );
  }

  return (
    <div
      className="modal-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ss-mode-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className={`modal ss-bg--${deck.subject}`}>
        <div className="modal-header text-left">
          <div>
            <h2 id="ss-text-light">{deck.title}</h2>
            <p className="p2 ss-text-light" style={{ marginTop: 4 }}>
              {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} · {deck.difficulty}
            </p>
          </div>
          <a className="pt-2 cursor-pointer" onClick={guard(onCancel)} aria-label="Close" title="Close">
            <img src="https://sdk-style.s3.amazonaws.com/icons/x.svg" alt="" aria-hidden="true" />
          </a>
        </div>

        <h3 className="ss-section-label mt-2">Choose a study mode</h3>
        <div className="ss-mode-grid mt-2">
          <button
            type="button"
            className="ss-mode-card ss-mode-card--flip"
            onClick={guard(() => onPick("flip"))}
            disabled={busy}
          >
            <div className="ss-mode-card__title">🔁 Flip</div>
            <div className="ss-mode-card__desc">See the prompt, recall the answer, tap to flip, rate yourself.</div>
          </button>
          <button
            type="button"
            className="ss-mode-card ss-mode-card--quiz"
            onClick={guard(() => onPick("quiz"))}
            disabled={busy || !canQuiz}
          >
            <div className="ss-mode-card__title">❓ Quiz</div>
            <div className="ss-mode-card__desc">Pick the right answer from four options.</div>
          </button>
          <button
            type="button"
            className="ss-mode-card ss-mode-card--sprint"
            onClick={guard(() => onPick("sprint"))}
            disabled={busy || !canSprint}
          >
            <div className="ss-mode-card__title">⚡ Sprint</div>
            <div className="ss-mode-card__desc">60-second timed challenge — go fast!</div>
          </button>
        </div>
        <div className="actions">
          {onEdit && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={guard(onEdit)}
              disabled={busy}
              aria-label="Edit deck"
              title="Edit deck"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              aria-label="Delete deck"
              title="Delete deck"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModePicker;
