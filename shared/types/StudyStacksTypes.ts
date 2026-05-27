export type DeckId = string;
export type CardId = string;

export type Subject = "math" | "ela" | "science" | "history" | "language" | "art" | "other";
export type Grade = "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

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

export interface Deck {
  id: DeckId;
  scope: DeckScope;
  title: string;
  subject: Subject;
  grades: Grade[];
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published";
  cards: Card[];
  createdByProfileId: string;
  createdByDisplayName: string;
  createdAt: number;
  updatedAt: number;
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
  earnedBadges?: { [badgeName: string]: number };
}

export const STUDY_STACK_BADGES = {
  FIRST_STEP: "FirstStep",
  BOOKWORM: "Bookworm",
  SCHOLAR: "Scholar",
  MASTER: "Master",
  DECK_DONE: "DeckDone",
  POLYGLOT: "Polyglot",
  COMEBACK_KID: "ComebackKid",
  STREAKER: "Streaker",
  MARATHONER: "Marathoner",
  SPEED_DEMON: "SpeedDemon",
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
