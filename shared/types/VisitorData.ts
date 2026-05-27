import { Deck, VisitorStudyData } from "./StudyStacksTypes.js";

/**
 * Visitor data object layout (all cross-world — nothing is scoped by
 * urlSlug/sceneDropId):
 *  - `studyStacksData`: this visitor's study progress (streak, mastery, totals).
 *  - `studyStacksDecks`: this visitor's personal (`scope: "user"`) deck library.
 */
export interface VisitorDataObjectType {
  studyStacksData?: VisitorStudyData;
  studyStacksDecks?: { [deckId: string]: Deck };
  [key: string]: VisitorStudyData | { [deckId: string]: Deck } | unknown;
}
