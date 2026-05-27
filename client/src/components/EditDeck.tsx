import { useContext, useState } from "react";
import type { Card, Deck, DeckScope, Grade, Subject } from "@shared/types/StudyStacksTypes";
import { MAX_CARDS_PER_DECK } from "@shared/types/StudyStacksTypes";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { backendAPI, setErrorMessage } from "@/utils";
import { ErrorType, SET_DECKS } from "@/context/types";
import { ConfirmationModal, CardEditor, ImportCardsModal } from "@/components";

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "math", label: "Math" },
  { value: "ela", label: "English / Language Arts" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "language", label: "World Languages" },
  { value: "art", label: "Art" },
  { value: "other", label: "Other" },
];

const ALL_GRADES: Grade[] = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const DIFFICULTIES: Deck["difficulty"][] = ["easy", "medium", "hard"];

const blankCard = (): Card => ({
  id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  front: "",
  back: "",
});

export const EditDeck = ({ initial, onClose }: { initial: Deck; onClose: () => void }) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks, userDecks, isAdmin } = useContext(GlobalStateContext);

  const [deck, setDeck] = useState<Deck>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmingCardRemoval, setConfirmingCardRemoval] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const [showImport, setShowImport] = useState(false);

  const updateField = <K extends keyof Deck>(key: K, value: Deck[K]) => {
    setDeck((d) => ({ ...d, [key]: value }));
  };

  const toggleGrade = (g: Grade) => {
    setDeck((d) => {
      const has = d.grades.includes(g);
      return { ...d, grades: has ? d.grades.filter((x) => x !== g) : [...d.grades, g] };
    });
  };

  const setScope = (scope: DeckScope) => setDeck((d) => ({ ...d, scope }));

  const addCard = () => {
    if (deck.cards.length >= MAX_CARDS_PER_DECK) {
      setValidationError(`Decks are limited to ${MAX_CARDS_PER_DECK} cards.`);
      return;
    }
    setDeck((d) => ({ ...d, cards: [...d.cards, blankCard()] }));
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= deck.cards.length) return;
    setDeck((d) => {
      const cards = [...d.cards];
      const tmp = cards[idx];
      cards[idx] = cards[next];
      cards[next] = tmp;
      return { ...d, cards };
    });
  };

  const updateCard = (idx: number, next: Card) => {
    setDeck((d) => {
      const cards = [...d.cards];
      cards[idx] = next;
      return { ...d, cards };
    });
  };

  const deleteCard = (idx: number) => {
    setDeck((d) => ({ ...d, cards: d.cards.filter((_, i) => i !== idx) }));
    setConfirmingCardRemoval(null);
  };

  const allGradesSelected = deck.grades.length === ALL_GRADES.length;

  const isEcosystemDeck = deck.scope === "ecosystem";

  const isEditingExistingDeck =
    ecosystemDecks.some((d) => d.id === initial.id) || userDecks.some((d) => d.id === initial.id);

  // Once a deck has been published it can't be reverted to a draft from here —
  // editing a published deck only lets you re-publish your changes.
  const isAlreadyPublished = isEditingExistingDeck && initial.status === "published";

  // User-scope decks skip the grade requirement entirely (they're personal —
  // no audience to filter), so canPublish only enforces grades for ecosystem.
  const canPublish =
    deck.title.trim().length > 0 &&
    (!isEcosystemDeck || deck.grades.length > 0) &&
    deck.cards.some((c) => c.front.trim() && c.back.trim());

  const persist = async (status: Deck["status"]) => {
    setValidationError("");
    if (!deck.title.trim()) {
      setValidationError("Title is required.");
      return;
    }
    if (status === "published" && !canPublish) {
      setValidationError(
        isEcosystemDeck
          ? "Need a title, at least one grade, and one card with front + back to publish."
          : "Need a title and one card with front + back to save.",
      );
      return;
    }
    setSaving(true);
    try {
      const res = await backendAPI.post("/decks", { scope: deck.scope, deck: { ...deck, status } });
      if (res.data?.success) {
        const updated: Deck = res.data.deck;
        const targetList = updated.scope === "ecosystem" ? ecosystemDecks : userDecks;
        const others = targetList.filter((d) => d.id !== updated.id);
        const nextList = [...others, updated];
        dispatch!({
          type: SET_DECKS,
          payload: updated.scope === "ecosystem" ? { ecosystemDecks: nextList } : { userDecks: nextList },
        });
        onClose();
      }
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="ss-header-row">
        <h2 style={{ marginBottom: 0 }}>{initial.title ? `Edit: ${initial.title}` : "New deck"}</h2>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card">
          <label htmlFor="deck-title" style={{ display: "block", fontWeight: 600 }}>
            Title
          </label>
          <input
            id="deck-title"
            className="input"
            value={deck.title}
            onChange={(e) => updateField("title", e.target.value.slice(0, 120))}
            placeholder="e.g. Civil War Dates"
          />

          <div className="mt-2">
            <label htmlFor="deck-subject" style={{ display: "block", fontWeight: 600 }}>
              Subject
            </label>
            <select
              id="deck-subject"
              className="input"
              value={deck.subject}
              onChange={(e) => updateField("subject", e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {isEcosystemDeck && (
            <div className="mt-2">
              <span className="ss-field__label">Grade levels</span>
              <label className="ss-checkbox-row">
                <input
                  type="checkbox"
                  checked={allGradesSelected}
                  onChange={(e) => setDeck((d) => ({ ...d, grades: e.target.checked ? [...ALL_GRADES] : [] }))}
                />
                All grades
              </label>
              {deck.grades.length === 0 && (
                <p className="ss-field__error">Select at least one grade or check &quot;All&quot;.</p>
              )}
              {!allGradesSelected && (
                <div
                  className={`ss-grade-list${deck.grades.length === 0 ? " ss-grade-list--error" : ""}`}
                  role="group"
                  aria-label="Grade levels"
                >
                  {ALL_GRADES.map((g) => {
                    const selected = deck.grades.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        className={`ss-grade-list__item${selected ? " ss-grade-list__item--selected" : ""}`}
                        onClick={() => toggleGrade(g)}
                        aria-pressed={selected}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-2">
            <label htmlFor="deck-difficulty" style={{ display: "block", fontWeight: 600 }}>
              Difficulty
            </label>
            <select
              id="deck-difficulty"
              className="input"
              value={deck.difficulty}
              onChange={(e) => updateField("difficulty", e.target.value as Deck["difficulty"])}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="mt-4">
              <span className="ss-field__label">Visibility</span>
              <label className="ss-checkbox-row">
                <input
                  type="checkbox"
                  checked={deck.scope === "ecosystem"}
                  /* Scope is locked after first save — moving between the
                   * Visitor and Ecosystem data objects would require recreating
                   * the deck (and student mastery tied to the old id would
                   * orphan). */
                  disabled={isEditingExistingDeck}
                  onChange={(e) => setScope(e.target.checked ? "ecosystem" : "user")}
                />
                Make available to all students (Class deck)
              </label>
              <p className="p3" style={{ color: "var(--ss-text-dim)" }}>
                {deck.scope === "ecosystem" ? "Available to all students." : "Only you will see this deck."}
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="ss-header-row">
            <h4>
              Cards ({deck.cards.length} / {MAX_CARDS_PER_DECK})
            </h4>
            <button type="button" className="btn btn-outline w-auto float-right" onClick={() => setShowImport(true)}>
              ⤴ Import
            </button>
          </div>
          <button type="button" className="btn" onClick={addCard} disabled={deck.cards.length >= MAX_CARDS_PER_DECK}>
            + Add card
          </button>

          {deck.cards.length === 0 ? (
            <p className="ss-empty-state">
              No cards yet. Click <strong>+ Add card</strong> to enter one at a time, or <strong>⤴ Import</strong> to
              paste/upload a list.
            </p>
          ) : (
            deck.cards.map((c, i) => (
              <CardEditor
                key={c.id}
                card={c}
                index={i}
                total={deck.cards.length}
                onChange={(next) => updateCard(i, next)}
                onMove={(dir) => moveCard(i, dir)}
                onDelete={() => {
                  if (deck.status === "published") setConfirmingCardRemoval(i);
                  else deleteCard(i);
                }}
              />
            ))
          )}
        </div>
      </div>

      {validationError && (
        <p className="p3 text-error mt-4" role="alert">
          {validationError}
        </p>
      )}

      <div className="flex gap-2 mt-6">
        {isEcosystemDeck ? (
          <>
            {!isAlreadyPublished && (
              <button className="btn btn-outline" onClick={() => persist("draft")} disabled={saving}>
                Save as draft
              </button>
            )}
            <button
              className="btn"
              onClick={() => persist("published")}
              disabled={saving || !canPublish}
              aria-disabled={saving || !canPublish}
            >
              {isAlreadyPublished ? "Save changes" : "Publish"}
            </button>
          </>
        ) : (
          <button
            className="btn"
            onClick={() => persist("published")}
            disabled={saving || !canPublish}
            aria-disabled={saving || !canPublish}
          >
            Save
          </button>
        )}
        <button className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
      </div>

      {confirmingCardRemoval !== null && (
        <ConfirmationModal
          title="Remove this card?"
          message="This deck is published. Removing a card will reset student mastery for it. Continue?"
          handleOnConfirm={() => deleteCard(confirmingCardRemoval)}
          handleToggleShowConfirmationModal={() => setConfirmingCardRemoval(null)}
        />
      )}

      {showImport && (
        <ImportCardsModal
          existingCount={deck.cards.length}
          onCancel={() => setShowImport(false)}
          onConfirm={(imported, mode) => {
            setDeck((d) => {
              const merged = mode === "replace" ? imported : [...d.cards, ...imported];
              return { ...d, cards: merged.slice(0, MAX_CARDS_PER_DECK) };
            });
            setShowImport(false);
            setValidationError("");
          }}
        />
      )}
    </div>
  );
};

export default EditDeck;
