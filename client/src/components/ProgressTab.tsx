import { useContext } from "react";
import { GlobalStateContext } from "@context/GlobalContext";
import StreakRing from "./StreakRing";
import MasteryRing from "./MasteryRing";
import StatCard from "./StatCard";

export const ProgressTab = () => {
  const { visitorStudyData, classDecks, userDecks } = useContext(GlobalStateContext);
  const decks = [...classDecks, ...userDecks];

  const streak = visitorStudyData?.streak || { current: 0, longest: 0, lastDay: "" };
  const totalCards = visitorStudyData?.totalCardsStudied || 0;
  const totalSessions = visitorStudyData?.totalSessionsCompleted || 0;

  return (
    <div>
      <div className="ss-header-row">
        <h2 className="h3" style={{ marginBottom: 0 }}>
          Your progress
        </h2>
        <StreakRing current={streak.current} longest={streak.longest} />
      </div>

      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <StatCard value={streak.current} label="Current streak (days)" />
        <StatCard value={streak.longest} label="Longest streak" />
        <StatCard value={totalCards} label="Cards studied" />
        <StatCard value={totalSessions} label="Sessions completed" />
      </div>

      <h3 className="h4 mt-6">Per-deck mastery</h3>
      {decks.length === 0 ? (
        <p className="ss-empty-state">No decks yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }} className="mt-2">
          {decks
            .filter((d) => d.status === "published")
            .map((d) => {
              const progress = visitorStudyData?.decks?.[d.id];
              const sum = d.cards.reduce((acc, c) => acc + (progress?.cards?.[c.id]?.mastery ?? 0), 0);
              const max = d.cards.length * 5;
              const pct = max === 0 ? 0 : (sum / max) * 100;
              return (
                <li
                  key={d.id}
                  className="card grid grid-cols-[auto_4rem] justify-stretch items-center"
                  style={{ marginBottom: "0.5rem", gap: "0.75rem" }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{d.title}</div>
                    <div className="p3" style={{ color: "var(--ss-text-dim)" }}>
                      {d.cards.length} card{d.cards.length === 1 ? "" : "s"} · {progress?.sessionsCompleted || 0}{" "}
                      sessions
                    </div>
                  </div>
                  <MasteryRing pct={pct} />
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
};

export default ProgressTab;
