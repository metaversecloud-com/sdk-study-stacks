import { useContext, useState } from "react";
import type { Deck } from "@shared/types/StudyStacksTypes";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { backendAPI, setErrorMessage } from "@/utils";
import { ConfirmationModal, EditDeck } from "@/components";
import { ErrorType, SET_DECKS } from "@/context/types";

const blankEcosystemDeck = (createdByProfileId: string, createdByDisplayName: string): Deck => ({
  id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  scope: "ecosystem",
  title: "",
  subject: "other",
  grades: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  difficulty: "medium",
  status: "draft",
  cards: [],
  createdByProfileId,
  createdByDisplayName: createdByDisplayName || "Teacher",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const DecksList = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks } = useContext(GlobalStateContext);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Deck | null>(null);

  // Admin tab manages ecosystem (class-wide) decks only — personal decks are
  // authored from the student-facing Library tab.
  const decks = ecosystemDecks;

  const handleDelete = async (deck: Deck) => {
    try {
      await backendAPI.delete(`/decks/${deck.id}`, { params: { scope: "ecosystem" } });
      dispatch!({
        type: SET_DECKS,
        payload: { ecosystemDecks: ecosystemDecks.filter((d) => d.id !== deck.id) },
      });
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleDuplicate = (deck: Deck) => {
    const copy: Deck = {
      ...deck,
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${deck.title} (copy)`,
      status: "draft",
      cards: deck.cards.map((c) => ({ ...c, id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditing(copy);
  };

  const togglePublish = async (deck: Deck) => {
    try {
      const nextStatus = deck.status === "published" ? "draft" : "published";
      const res = await backendAPI.post("/decks", { scope: "ecosystem", deck: { ...deck, status: nextStatus } });
      if (res.data?.success) {
        const others = ecosystemDecks.filter((d) => d.id !== deck.id);
        dispatch!({ type: SET_DECKS, payload: { ecosystemDecks: [...others, res.data.deck] } });
      }
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    }
  };

  if (editing) {
    return <EditDeck initial={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div>
      <div className="ss-header-row">
        <h2 className="h3" style={{ marginBottom: 0 }}>
          Class decks
        </h2>
        <button className="btn" onClick={() => setEditing(blankEcosystemDeck("", "Teacher"))}>
          + New class deck
        </button>
      </div>

      <p className="p3" style={{ color: "var(--ss-text-dim)" }}>
        Class decks are visible to every student at every Study Stacks desk in this account.
      </p>

      {decks.length === 0 ? (
        <p className="ss-empty-state">No class decks yet. Create your first one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {decks.map((d) => (
            <li key={d.id} className="card ss-deck-row" style={{ marginBottom: "0.5rem" }}>
              <div className="ss-deck-row__info">
                <div className="ss-deck-row__title">{d.title || "(untitled)"}</div>
                <div className="p3" style={{ color: "var(--ss-text-dim)" }}>
                  {d.subject} · {d.cards.length} cards ·{" "}
                  <span style={{ color: d.status === "published" ? "var(--ss-success-dark)" : "var(--ss-coral)" }}>
                    {d.status}
                  </span>
                </div>
              </div>
              <div className="ss-deck-row__actions">
                <button className="btn btn-outline" onClick={() => setEditing(d)}>
                  Edit
                </button>
                <button className="btn btn-outline" onClick={() => handleDuplicate(d)}>
                  Duplicate
                </button>
                <button className="btn btn-outline" onClick={() => togglePublish(d)}>
                  {d.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(d)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmationModal
          title="Delete class deck?"
          message={`This will permanently delete "${confirmDelete.title}". Student mastery for this deck stays on record.`}
          handleOnConfirm={() => handleDelete(confirmDelete)}
          handleToggleShowConfirmationModal={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default DecksList;
