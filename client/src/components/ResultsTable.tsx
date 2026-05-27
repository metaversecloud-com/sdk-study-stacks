import { useContext, useMemo, useState } from "react";
import { GlobalStateContext } from "@context/GlobalContext";
import type { AssetResultsRow } from "@shared/types/StudyStacksTypes";

type SortKey = "name" | "streak" | "sessions" | "lastSeen";
const MAX_ROWS = 200;

const downloadCSV = (rows: AssetResultsRow[], deckTitles: Record<string, string>) => {
  const lines = ["Name,Current Streak,Total Sessions,Most-Studied Deck,Last Active"];
  for (const r of rows) {
    const last = r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : "";
    const deck = r.mostStudiedDeckId ? deckTitles[r.mostStudiedDeckId] || r.mostStudiedDeckId : "";
    const cells = [r.displayName, r.currentStreak, r.totalSessions, deck, last].map(
      (c) => `"${String(c).replace(/"/g, '""')}"`,
    );
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "study-stack-results.csv";
  a.click();
  URL.revokeObjectURL(url);
};

export const ResultsTable = () => {
  const { results, ecosystemDecks, userDecks } = useContext(GlobalStateContext);
  const [sortKey, setSortKey] = useState<SortKey>("lastSeen");

  const deckTitles = useMemo(
    () => Object.fromEntries([...ecosystemDecks, ...userDecks].map((d) => [d.id, d.title])),
    [ecosystemDecks, userDecks],
  );

  const rows: AssetResultsRow[] = useMemo(() => {
    const list = Object.values(results || {});
    list.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.displayName.localeCompare(b.displayName);
        case "streak":
          return (b.currentStreak || 0) - (a.currentStreak || 0);
        case "sessions":
          return (b.totalSessions || 0) - (a.totalSessions || 0);
        default:
          return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      }
    });
    return list;
  }, [results, sortKey]);

  if (!results || rows.length === 0) {
    return <p className="ss-empty-state">No student activity yet.</p>;
  }

  return (
    <div>
      <div className="ss-header-row">
        <h2 className="h3" style={{ marginBottom: 0 }}>
          Class results
        </h2>
        <button className="btn btn-outline" onClick={() => downloadCSV(rows, deckTitles)}>
          Download CSV
        </button>
      </div>

      <div className="ss-results-wrap">
        <table className="ss-results-table">
          <thead>
            <tr>
              <th>
                <button className="btn btn-text" onClick={() => setSortKey("name")}>
                  Name
                </button>
              </th>
              <th>
                <button className="btn btn-text" onClick={() => setSortKey("streak")}>
                  Streak
                </button>
              </th>
              <th>
                <button className="btn btn-text" onClick={() => setSortKey("sessions")}>
                  Sessions
                </button>
              </th>
              <th>Most-studied deck</th>
              <th>
                <button className="btn btn-text" onClick={() => setSortKey("lastSeen")}>
                  Last active
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_ROWS).map((r, i) => (
              <tr key={r.displayName + i}>
                <td>{r.displayName}</td>
                <td>{r.currentStreak}</td>
                <td>{r.totalSessions}</td>
                <td>{r.mostStudiedDeckId ? deckTitles[r.mostStudiedDeckId] || r.mostStudiedDeckId : "—"}</td>
                <td>{r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > MAX_ROWS && (
        <p className="p3 mt-2" style={{ color: "var(--ss-text-dim)" }}>
          Showing first {MAX_ROWS} rows of {rows.length}. Use "Download CSV" for the full list.
        </p>
      )}
    </div>
  );
};

export default ResultsTable;
