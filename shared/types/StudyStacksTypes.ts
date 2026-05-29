export type DeckId = string;
export type CardId = string;

export type Subject = "math" | "ela" | "science" | "history" | "language" | "art" | "other";
export type Grade = "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

/** Every grade we support, in display order. */
export const ALL_GRADES: readonly Grade[] = [
  "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];

/**
 * Sentinel value for "every grade" on an ecosystem deck. Stored instead of
 * the full 13-element array to keep the data object small — by far the
 * common case is "All grades", and serializing one string beats serializing
 * thirteen.
 */
export const ALL_GRADES_SENTINEL = "all" as const;

/**
 * What gets written to the deck for grade targeting:
 *   - `"all"`     → every grade (storage-efficient form of the full array)
 *   - `Grade[]`   → an explicit subset (one or more specific grades)
 *
 * User decks omit this field entirely (no audience to target). The optional
 * marker lives on `Deck.grades` itself.
 */
export type DeckGrades = typeof ALL_GRADES_SENTINEL | Grade[];

/** Resolve stored grades to the concrete list of targeted grades. */
export const expandGrades = (grades: DeckGrades | undefined): Grade[] => {
  if (!grades) return [];
  if (grades === ALL_GRADES_SENTINEL) return [...ALL_GRADES];
  return grades;
};

/** Collapse a full grade array to the `"all"` sentinel; otherwise return the array. */
export const normalizeGrades = (grades: Grade[]): DeckGrades => {
  if (grades.length === ALL_GRADES.length) return ALL_GRADES_SENTINEL;
  return grades;
};

/** Whether a stored grades value represents "every grade". */
export const isAllGrades = (grades: DeckGrades | undefined): boolean =>
  grades === ALL_GRADES_SENTINEL || (Array.isArray(grades) && grades.length === ALL_GRADES.length);

export type StudyMode = "flip" | "quiz" | "sprint";
export type FlipRating = "got_it" | "almost" | "missed";
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * A deck is either personal to one visitor (`"user"`) or shared across every
 * Study Stacks desk in the account (`"ecosystem"`). Only admins can write
 * ecosystem decks; anyone can create user decks for themselves.
 */
export type DeckScope = "user" | "ecosystem";

export interface Card {
  id: CardId;
  front: string;
  back: string;
  hint?: string;
  /** Optional image (http/https URL) shown above the front prompt. */
  imageUrl?: string;
}

/**
 * A card is complete when it has an answer (back) and *something* on the front
 * — either prompt text or a front image URL. (The image alone can be the
 * prompt, so front text is not independently required.)
 */
export const isCardComplete = (card: Pick<Card, "front" | "back" | "imageUrl">): boolean =>
  Boolean((card.front.trim() || (card.imageUrl ?? "").trim()) && card.back.trim());

export interface Deck {
  id: DeckId;
  scope: DeckScope;
  title: string;
  subject: Subject;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published";
  cards: Card[];
  // Grade targeting only applies to ecosystem decks (teacher → class
  // audience). User decks are personal, so this field is omitted on them.
  // Ecosystem decks store either `"all"` (every grade — the common case)
  // or an explicit `Grade[]` subset; see `DeckGrades`.
  grades?: DeckGrades;
  // Authorship is only tracked on ecosystem decks (shared across admins).
  // User decks live in the owner's own visitor data object, so the creator
  // is implicit and these are omitted.
  createdByProfileId?: string;
  createdByDisplayName?: string;
}

export interface CardMastery {
  cardId: CardId;
  mastery: MasteryLevel;
  lastSeenAt: number;
  timesCorrect: number;
  timesWrong: number;
}

export interface DeckProgress {
  deckId: DeckId;
  cards: { [cardId: string]: CardMastery };
  sessionsCompleted: number;
  lastStudiedAt: number;
}

export interface VisitorStudyData {
  decks: { [deckId: string]: DeckProgress };
  streak: {
    current: number;
    longest: number;
    lastDay: string;
  };
  totalCardsStudied: number;
  totalSessionsCompleted: number;
}

export const STUDY_STACK_BADGES = {
  FIRST_STEP: "First Step",
  BOOKWORM: "Bookworm",
  SCHOLAR: "Scholar",
  MASTER: "Master",
  DECK_DONE: "Deck Done",
  POLYGLOT: "Polyglot",
  COMEBACK_KID: "Comeback Kid",
  STREAKER: "Streaker",
  MARATHONER: "Marathoner",
  SPEED_DEMON: "Speed Demon",
  PERFECTIONIST: "Perfectionist",
} as const;

export type BadgeName = (typeof STUDY_STACK_BADGES)[keyof typeof STUDY_STACK_BADGES];

/**
 * Badge UI metadata (title, icon, description) is sourced from the Topia
 * ecosystem inventory item — never hard-coded in this app. See
 * `.ai/examples/badges.md` for the canonical pattern.
 */
export interface BadgeRecord {
  [name: string]: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
}

export interface VisitorBadgeRecord {
  [name: string]: {
    id: string;
    name: string;
    icon: string;
  };
}

export interface AssetResultsRow {
  displayName: string;
  totalSessions: number;
  mostStudiedDeckId?: DeckId;
  currentStreak: number;
  lastSeenAt: number;
}

/**
 * Account-wide store. Everything in Study Stacks is ecosystem-scoped — decks
 * AND aggregate results live here, shared across every desk in every world.
 */
export interface EcosystemDataObjectType {
  studyStacksDecks?: { [deckId: string]: Deck };
  studyStacksResults?: { [profileId: string]: AssetResultsRow };
  [key: string]: unknown;
}

export interface SessionSummary {
  cardsStudied: number;
  correctCount: number;
  totalCardsInSession: number;
  masteryDeltas: { [cardId: string]: number };
  newBadges: string[];
  streakAfter: { current: number; longest: number };
}

export const MAX_CARDS_PER_DECK = 100;
export const FLIP_SESSION_SIZE = 12;
export const QUIZ_SESSION_SIZE = 10;
export const SPRINT_DURATION_MS = 60_000;
