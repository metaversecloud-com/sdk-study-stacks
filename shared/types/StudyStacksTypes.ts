export type DeckIdType = string;
export type CardIdType = string;

export type SubjectType = "math" | "ela" | "science" | "history" | "language" | "art" | "other";
export type GradeType = "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

/** Every grade we support, in display order. */
export const ALL_GRADES: readonly GradeType[] = [
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
export type DeckGradesType = typeof ALL_GRADES_SENTINEL | GradeType[];

/** Resolve stored grades to the concrete list of targeted grades. */
export const expandGrades = (grades: DeckGradesType | undefined): GradeType[] => {
  if (!grades) return [];
  if (grades === ALL_GRADES_SENTINEL) return [...ALL_GRADES];
  return grades;
};

/** Collapse a full grade array to the `"all"` sentinel; otherwise return the array. */
export const normalizeGrades = (grades: GradeType[]): DeckGradesType => {
  if (grades.length === ALL_GRADES.length) return ALL_GRADES_SENTINEL;
  return grades;
};

/** Whether a stored grades value represents "every grade". */
export const isAllGrades = (grades: DeckGradesType | undefined): boolean =>
  grades === ALL_GRADES_SENTINEL || (Array.isArray(grades) && grades.length === ALL_GRADES.length);

export type StudyModeType = "flip" | "quiz" | "sprint";
export type FlipRatingType = "got_it" | "almost" | "missed";
export type MasteryLevelType = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * A deck is either personal to one visitor (`"user"`) or shared across every
 * Study Stacks desk in the account (`"ecosystem"`). Only admins can write
 * ecosystem decks; anyone can create user decks for themselves.
 */
export type DeckScopeType = "user" | "ecosystem";

export interface CardType {
  id: CardIdType;
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
export const isCardComplete = (card: Pick<CardType, "front" | "back" | "imageUrl">): boolean =>
  Boolean((card.front.trim() || (card.imageUrl ?? "").trim()) && card.back.trim());

export interface DeckType {
  id: DeckIdType;
  scope: DeckScopeType;
  title: string;
  subject: SubjectType;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published";
  cards: CardType[];
  // Grade targeting only applies to ecosystem decks (teacher → class
  // audience). User decks are personal, so this field is omitted on them.
  // Ecosystem decks store either `"all"` (every grade — the common case)
  // or an explicit `Grade[]` subset; see `DeckGrades`.
  grades?: DeckGradesType;
  // Authorship is only tracked on ecosystem decks (shared across admins).
  // User decks live in the owner's own visitor data object, so the creator
  // is implicit and these are omitted.
  createdByProfileId?: string;
  createdByDisplayName?: string;
  // Per-deck leaderboard for ecosystem decks. Standard pipe-delimited
  // leaderboard syntax used across the stack: `"{displayName}|{sessions}"`.
  // User decks omit this field (a personal deck has one owner, no
  // leaderboard).
  results?: { [profileId: string]: string };
}

/**
 * One parsed row from a deck's `results` map.
 *   storage: `studyStacksDecks.{deckId}.results.{profileId} = "{name}|{n}"`
 */
export interface DeckResultsRowType {
  profileId: string;
  displayName: string;
  sessions: number;
}

/** `"Linda Jones|7"` → `{ displayName: "Linda Jones", sessions: 7 }`. */
export const parseDeckResultsValue = (value: string): { displayName: string; sessions: number } => {
  const pipe = value.indexOf("|");
  if (pipe < 0) return { displayName: value, sessions: 0 };
  const displayName = value.slice(0, pipe);
  const sessions = parseInt(value.slice(pipe + 1), 10);
  return { displayName, sessions: Number.isFinite(sessions) ? sessions : 0 };
};

/** Build a deck-results value. displayName must not contain `|`. */
export const formatDeckResultsValue = (displayName: string, sessions: number): string =>
  `${displayName.replace(/\|/g, "")}|${sessions}`;

export interface CardMasteryType {
  cardId: CardIdType;
  mastery: MasteryLevelType;
  lastSeenAt: number;
  timesCorrect: number;
  timesWrong: number;
}

export interface DeckProgressType {
  deckId: DeckIdType;
  cards: { [cardId: string]: CardMasteryType };
  sessionsCompleted: number;
  lastStudiedAt: number;
}

export interface VisitorStudyDataType {
  decks: { [deckId: string]: DeckProgressType };
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

export type BadgeNameType = (typeof STUDY_STACK_BADGES)[keyof typeof STUDY_STACK_BADGES];

/**
 * Badge UI metadata (title, icon, description) is sourced from the Topia
 * ecosystem inventory item — never hard-coded in this app. See
 * `.ai/examples/badges.md` for the canonical pattern.
 */
export interface BadgeRecordType {
  [name: string]: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
}

export interface VisitorBadgeRecordType {
  [name: string]: {
    id: string;
    name: string;
    icon: string;
  };
}

/**
 * Account-wide store. Ecosystem decks live here; per-deck leaderboards live
 * INSIDE each deck (`Deck.results`), so a single fetch of `studyStacksDecks`
 * carries everything an admin needs.
 */
export interface EcosystemDataObjectType {
  studyStacksDecks?: { [deckId: string]: DeckType };
  [key: string]: unknown;
}

export interface SessionSummaryType {
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
