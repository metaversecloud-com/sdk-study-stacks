import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Deck, DeckResultsRow } from "@shared/types/StudyStacksTypes";
import { parseDeckResultsValue } from "@shared/types/StudyStacksTypes";
import { openResultsInNewTab } from "@/utils";

type SortKey = "name" | "sessions";

const MAX_ROWS = 200;

const parseResultsMap = (raw: Deck["results"]): DeckResultsRow[] => {
  if (!raw) return [];
  return Object.entries(raw).map(([profileId, value]) => {
    const { displayName, sessions } = parseDeckResultsValue(value);
    return { profileId, displayName, sessions };
  });
};

/**
 * Per-deck leaderboard view. Reads from `deck.results` (the pipe-delimited
 * `displayName|sessions` map written by `handleCompleteSession`).
 */
export const DeckResultsModal = ({ deck, onClose }: { deck: Deck; onClose: () => void }) => {
  const [sortKey, setSortKey] = useState<SortKey>("sessions");

  const rows: DeckResultsRow[] = useMemo(() => {
    const list = parseResultsMap(deck.results);
    list.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.displayName.localeCompare(b.displayName);
        default:
          return b.sessions - a.sessions;
      }
    });
    return list;
  }, [deck.results, sortKey]);

  return createPortal(
    <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="ss-deck-results-title">
      <div className="modal" style={{ maxHeight: "85vh", display: "flex", flexDirection: "column", maxWidth: 640 }}>
        <div className="ss-header-row">
          <h2 id="ss-deck-results-title" className="h3" style={{ marginBottom: 0 }}>
            Results · {deck.title || "(untitled)"}
          </h2>
          {rows.length > 0 && (
            <button type="button" className="btn btn-outline" onClick={() => openResultsInNewTab(deck)}>
              Open in new tab
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="ss-empty-state mt-2">No one has studied this deck yet.</p>
        ) : (
          <div className="ss-results-wrap" style={{ overflowY: "auto" }}>
            <table className="ss-results-table">
              <thead>
                <tr>
                  <th>
                    <a onClick={() => setSortKey("name")}>Name</a>
                  </th>
                  <th>
                    <a onClick={() => setSortKey("sessions")}>Sessions</a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_ROWS).map((r) => (
                  <tr key={r.profileId}>
                    <td>{r.displayName}</td>
                    <td>{r.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows.length > MAX_ROWS && (
              <p className="p3 mt-2" style={{ color: "var(--ss-text-dim)" }}>
                Showing first {MAX_ROWS} of {rows.length} rows. Use "Open in new tab" for the full list.
              </p>
            )}
          </div>
        )}

        <div className="ss-modal__actions mt-3" style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DeckResultsModal;
