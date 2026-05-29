import { useContext } from "react";
import { Deck, DeckScope } from "@shared/types/StudyStacksTypes";
import DeckCard from "./DeckCard";
import { GlobalStateContext } from "@context/GlobalContext";

export const Library = ({
  onPick,
  onCreate,
}: {
  onPick: (deckId: string, scope: DeckScope) => void;
  onCreate?: () => void;
}) => {
  const { ecosystemDecks, userDecks, visitorStudyData } = useContext(GlobalStateContext);

  const renderGroup = (decks: Deck[]) =>
    decks.map((d) => (
      <DeckCard
        key={`${d.scope}-${d.id}`}
        deck={d}
        studyData={visitorStudyData}
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
