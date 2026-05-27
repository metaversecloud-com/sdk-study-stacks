import { useState } from "react";
import { DecksList, ResultsTable } from "@/components";

type AdminTab = "decks" | "results";

export const AdminView = () => {
  const [tab, setTab] = useState<AdminTab>("decks");

  return (
    <div>
      <div className="ss-tab-bar" role="tablist" aria-label="Admin sections">
        <button className="ss-tab" role="tab" aria-selected={tab === "decks"} onClick={() => setTab("decks")}>
          Decks
        </button>
        <button className="ss-tab" role="tab" aria-selected={tab === "results"} onClick={() => setTab("results")}>
          Results
        </button>
      </div>

      <div role="tabpanel">{tab === "decks" ? <DecksList /> : <ResultsTable />}</div>
    </div>
  );
};

export default AdminView;
