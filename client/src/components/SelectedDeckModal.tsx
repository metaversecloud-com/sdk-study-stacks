import { useContext, useEffect, useState } from "react";
import { DeckType, StudyModeType, isCardComplete } from "@shared/types/StudyStacksTypes";
import { ConfirmationModal, IconButton } from "@/components";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { ErrorType, SET_DECKS } from "@/context/types";
import { backendAPI, setErrorMessage, useClickOnce } from "@/utils";

export const SelectedDeckModal = ({
  deck,
  onPick,
  onCancel,
  onViewAnalytics,
  onEdit,
  onDelete,
}: {
  deck: DeckType;
  onPick: (mode: StudyModeType) => void;
  onCancel: () => void;
  /** Render an Analytics icon. Caller decides eligibility (admin + ecosystem
   * scope) and supplies the click handler — usually `openResultsInNewTab(deck)`,
   * which pops a printable per-student leaderboard in a new browser tab. */
  onViewAnalytics?: () => void;
  /** Render an Edit icon. Caller decides eligibility
   * (e.g. only the deck's creator). */
  onEdit?: () => void;
  /** Render a Delete icon. Same eligibility gate as Edit — when the
   * confirmation succeeds, SelectedDeckModal fires the DELETE + dispatches the
   * SET_DECKS update itself, then calls this callback so the parent can
   * dismiss the picker. */
  onDelete?: () => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks, userDecks } = useContext(GlobalStateContext);
  // Quiz mode needs 4 multiple-choice options per question (1 correct + 3
  // distractors). Distractors are drawn from other cards' backs server-side
  // (see `computeNextCards`), where matches to the correct answer are
  // deduped case-insensitively. So the effective gate is:
  //   1. At least 4 complete cards (front + back filled), AND
  //   2. At least 4 *distinct* backs (normalized). A True/False-only deck
  //      would otherwise render every question as "True: False /
  //      False: Different answer" via QuizCard's true-false fallback.
  const completeCards = deck.cards.filter(isCardComplete);
  const uniqueBacks = new Set(completeCards.map((c) => c.back.trim().toLowerCase()));
  const hasEnoughCards = completeCards.length >= 4;
  const hasEnoughDistinctAnswers = uniqueBacks.size >= 4;
  const canQuiz = hasEnoughCards && hasEnoughDistinctAnswers;
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
            <h2 className="ss-text-light">{deck.title}</h2>

            <p className="p2 ss-text-light" style={{ marginTop: 4 }}>
              {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} · {deck.difficulty}
            </p>
            <div className="flex gap-3 pt-2">
              {onViewAnalytics && (
                <IconButton label="Analytics" icon="info" isTextBtn={true} onClick={onViewAnalytics} />
              )}
              {onEdit && <IconButton label="Edit" icon="edit" isTextBtn={true} onClick={onEdit} />}
              {onDelete && (
                <IconButton label="Delete" icon="delete" isTextBtn={true} onClick={() => setConfirmingDelete(true)} />
              )}
            </div>
          </div>
          <a className="pt-2 cursor-pointer" onClick={onCancel} aria-label="Close" title="Close">
            <img src="https://sdk-style.s3.amazonaws.com/icons/x.svg" alt="" aria-hidden="true" />
          </a>
        </div>

        <h3 className="ss-section-label" style={{ marginTop: 0 }}>
          Choose a study mode
        </h3>
        <div className="ss-mode-grid mt-2">
          <button
            type="button"
            className="ss-mode-card ss-mode-card--flip"
            onClick={guard(() => onPick("flip"))}
            disabled={busy}
          >
            <h4 className="ss-mode-card__title">🔁 Flip</h4>
            <p className="ss-mode-card__desc">See the prompt, recall the answer, tap to flip, rate yourself.</p>
          </button>
          <button
            type="button"
            className="ss-mode-card ss-mode-card--quiz"
            onClick={guard(() => onPick("quiz"))}
            disabled={busy || !canQuiz}
            aria-disabled={busy || !canQuiz}
          >
            <h4 className="ss-mode-card__title">❓ Quiz</h4>
            <p className="ss-mode-card__desc">
              {canQuiz
                ? "Pick the right answer from four options."
                : !hasEnoughCards
                  ? "Add at least 4 complete cards to unlock Quiz mode."
                  : "Add cards with more distinct back answers to unlock Quiz mode."}
            </p>
          </button>
          <button
            type="button"
            className="ss-mode-card ss-mode-card--sprint"
            onClick={guard(() => onPick("sprint"))}
            disabled={busy || !canSprint}
          >
            <h4 className="ss-mode-card__title">⚡ Sprint</h4>
            <p className="ss-mode-card__desc">60-second timed challenge — go fast!</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectedDeckModal;
