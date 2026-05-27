import { useContext, useMemo } from "react";
import { Deck, DeckScope, VisitorStudyData } from "@shared/types/StudyStacksTypes";
import DeckCard from "./DeckCard";
import { GlobalStateContext } from "@context/GlobalContext";

const pickRecommendedDeckId = (decks: Deck[], studyData?: VisitorStudyData): string | undefined => {
  if (decks.length === 0) return undefined;
  let best: { id: string; score: number } | undefined;
  for (const d of decks) {
    const progress = studyData?.decks?.[d.id];
    const last = progress?.lastStudiedAt ?? 0;
    const masterySum = d.cards.reduce((a, c) => a + (progress?.cards?.[c.id]?.mastery ?? 0), 0);
    const avgMastery = d.cards.length ? masterySum / d.cards.length : 0;
    const score = (5 - avgMastery) * 1000 + (Date.now() - last) / 86_400_000;
    if (!best || score > best.score) best = { id: d.id, score };
  }
  return best?.id;
};

export const Library = ({
  onPick,
  onCreate,
}: {
  onPick: (deckId: string, scope: DeckScope) => void;
  onCreate?: () => void;
}) => {
  const { ecosystemDecks, userDecks, visitorStudyData } = useContext(GlobalStateContext);

  // Server already filtered drafts appropriately for this visitor.
  const recommendedId = useMemo(
    () =>
      pickRecommendedDeckId(
        [...ecosystemDecks, ...userDecks].filter((d) => d.status === "published"),
        visitorStudyData,
      ),
    [ecosystemDecks, userDecks, visitorStudyData],
  );

  const renderGroup = (decks: Deck[]) =>
    decks.map((d) => (
      <DeckCard
        key={`${d.scope}-${d.id}`}
        deck={d}
        studyData={visitorStudyData}
        recommended={d.id === recommendedId}
        onClick={() => onPick(d.id, d.scope)}
      />
    ));

  return (
    <div>
      {ecosystemDecks.length > 0 && (
        <>
          <h3 className="ss-section-label">Class decks</h3>
          <div className="ss-deck-grid">{renderGroup(ecosystemDecks)}</div>
        </>
      )}

      {userDecks.length > 0 && (
        <>
          <h3 className="ss-section-label">My decks</h3>
          <div className="ss-deck-grid">{renderGroup(userDecks)}</div>
        </>
      )}

      {onCreate && (
        <button type="button" className="btn mt-2 mt-6" onClick={onCreate}>
          + Create a new deck
        </button>
      )}

      <p className="p3 mt-6" style={{ color: "var(--ss-text-dim)" }}>
        Tip: your teacher can publish shared class decks too — they'll appear above.
      </p>
    </div>
  );
};

export default Library;
