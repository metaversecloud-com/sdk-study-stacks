import {
  BadgeRecordType,
  DeckType,
  DeckScopeType,
  SessionSummaryType,
  StudyModeType,
  VisitorBadgeRecordType,
  VisitorStudyDataType,
} from "@shared/types/StudyStacksTypes";

export const SET_HAS_INTERACTIVE_PARAMS = "SET_HAS_INTERACTIVE_PARAMS";
export const SET_CONFIG = "SET_CONFIG";
export const SET_DECKS = "SET_DECKS";
export const SET_VISITOR_DATA = "SET_VISITOR_DATA";
export const SET_SESSION = "SET_SESSION";
export const CLEAR_SESSION = "CLEAR_SESSION";
export const SET_ERROR = "SET_ERROR";
export const SET_MUTED = "SET_MUTED";

export type InteractiveParams = {
  assetId: string;
  displayName: string;
  identityId: string;
  interactiveNonce: string;
  interactivePublicKey: string;
  profileId: string;
  sceneDropId: string;
  uniqueName: string;
  urlSlug: string;
  username: string;
  visitorId: string;
};

export interface SessionCard {
  id: string;
  front: string;
  back: string;
  hint?: string;
  imageUrl?: string;
  distractors?: string[];
}

export interface ActiveClientSession {
  sessionId: string;
  deckId: string;
  deckScope: DeckScopeType;
  mode: StudyModeType;
  cards: SessionCard[];
  startedAt: number;
  index: number;
  correctCount: number;
  totalAnswered: number;
  /** session result after /session/complete returns */
  summary?: SessionSummaryType;
}

export interface InitialState {
  hasInteractiveParams: boolean;
  isAdmin: boolean;
  error: string;
  muted: boolean;
  /** admin-authored, account-wide; visible to everyone */
  ecosystemDecks: DeckType[];
  /** this visitor's personal decks (scope: "user") */
  userDecks: DeckType[];
  visitorStudyData?: VisitorStudyDataType;
  badges: BadgeRecordType;
  visitorInventory: VisitorBadgeRecordType;
  session?: ActiveClientSession;
}

export type ActionType = {
  type: string;
  payload?: any;
};

export type ErrorType =
  | string
  | {
      message?: string;
      response?: { data?: { error?: { message?: string }; message?: string } };
    };
