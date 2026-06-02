import { DeckType, VisitorStudyDataType } from "./StudyStacksTypes.js";

/**
 * Visitor data object layout (all cross-world — nothing is scoped by
 * urlSlug/sceneDropId):
 *  - `studyStacksData`: this visitor's study progress (streak, mastery, totals).
 *  - `studyStacksDecks`: this visitor's personal (`scope: "user"`) deck library.
 */
export interface VisitorDataObjectType {
  studyStacksData?: VisitorStudyDataType;
  studyStacksDecks?: { [deckId: string]: DeckType };
  [key: string]: VisitorStudyDataType | { [deckId: string]: DeckType } | unknown;
}
