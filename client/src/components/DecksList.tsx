import { useContext, useState } from "react";
import type { DeckType } from "@shared/types/StudyStacksTypes";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { backendAPI, setErrorMessage } from "@/utils";
import { ConfirmationModal, DeckResultsModal, EditDeck, IconButton } from "@/components";
import { ErrorType, SET_DECKS } from "@/context/types";

const blankEcosystemDeck = (createdByProfileId: string, createdByDisplayName: string): DeckType => ({
  id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  scope: "ecosystem",
  title: "",
  subject: "other",
  grades: "all",
  difficulty: "medium",
  status: "draft",
  cards: [],
  createdByProfileId,
  createdByDisplayName: createdByDisplayName || "Teacher",
});

const ICON = {
  stats: "https://sdk-style.s3.amazonaws.com/icons/info.svg",
  edit: "https://sdk-style.s3.amazonaws.com/icons/edit.svg",
  copy: "https://sdk-style.s3.amazonaws.com/icons/copy.svg",
  delete: "https://sdk-style.s3.amazonaws.com/icons/delete.svg",
};

export const DecksList = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks } = useContext(GlobalStateContext);
  const [editing, setEditing] = useState<DeckType | null>(null);
  const [viewingResults, setViewingResults] = useState<DeckType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeckType | null>(null);

  // Admin tab manages ecosystem (class-wide) decks only — personal decks are
  // authored from the student-facing Library tab.
  const decks = ecosystemDecks;

  const handleDelete = async (deck: DeckType) => {
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

  const handleDuplicate = (deck: DeckType) => {
    const copy: DeckType = {
      ...deck,
      id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${deck.title} (copy)`,
      status: "draft",
      cards: deck.cards.map((c) => ({ ...c, id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
      // Don't carry over the source deck's leaderboard.
      results: undefined,
    };
    setEditing(copy);
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

      <p className="p3">Class decks are visible to every student at every Study Stacks desk in this account.</p>

      {decks.length === 0 ? (
        <p className="ss-empty-state">No class decks yet. Create your first one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {decks.map((d) => (
            <li key={d.id} className="card ss-deck-row">
              <div className="ss-deck-row__info">
                <h4 className="ss-deck-row__title">{d.title || "(untitled)"}</h4>
                <p className="p2 ss-text-dim">
                  {d.subject} · {d.cards.length} cards ·{" "}
                  <span style={{ color: d.status === "published" ? "var(--ss-success-dark)" : "var(--ss-coral)" }}>
                    {d.status}
                  </span>
                </p>
              </div>
              <div className="ss-deck-row__actions">
                <IconButton label="Analytics" onClick={() => setViewingResults(d)}>
                  <img src={ICON.stats} alt="" aria-hidden="true" />
                </IconButton>
                <IconButton label="Edit" onClick={() => setEditing(d)}>
                  <img src={ICON.edit} alt="" aria-hidden="true" />
                </IconButton>
                <IconButton label="Duplicate" onClick={() => handleDuplicate(d)}>
                  <img src={ICON.copy} alt="" aria-hidden="true" />
                </IconButton>
                <IconButton label="Delete" onClick={() => setConfirmDelete(d)} danger>
                  <img src={ICON.delete} alt="" aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewingResults && <DeckResultsModal deck={viewingResults} onClose={() => setViewingResults(null)} />}

      {confirmDelete && (
        <ConfirmationModal
          title="Delete class deck?"
          message={`This will permanently delete "${confirmDelete.title}".`}
          handleOnConfirm={() => handleDelete(confirmDelete)}
          handleToggleShowConfirmationModal={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default DecksList;
