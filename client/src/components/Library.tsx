import { useContext } from "react";
import { DeckType, DeckScopeType } from "@shared/types/StudyStacksTypes";
import Deck from "./Deck";
import { GlobalStateContext } from "@context/GlobalContext";

export const Library = ({
  onPick,
  onCreate,
}: {
  onPick: (deckId: string, scope: DeckScopeType) => void;
  onCreate?: () => void;
}) => {
  const { classDecks, userDecks, visitorStudyData } = useContext(GlobalStateContext);

  const renderGroup = (decks: DeckType[]) =>
    decks.map((d) => (
      <Deck key={`${d.scope}-${d.id}`} deck={d} studyData={visitorStudyData} onClick={() => onPick(d.id, d.scope)} />
    ));

  return (
    <div>
      {classDecks.length > 0 && (
        <>
          <h3 className="ss-section-label">Class decks</h3>
          <div className="ss-deck-grid">{renderGroup(classDecks)}</div>
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
    </div>
  );
};

export default Library;
