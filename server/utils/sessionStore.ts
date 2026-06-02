import { DeckScopeType, StudyModeType } from "@shared/types/StudyStacksTypes.js";

export interface ActiveSession {
  sessionId: string;
  visitorId: number;
  assetId: string;
  deckId: string;
  deckScope: DeckScopeType;
  mode: StudyModeType;
  cardIds: string[];
  startedAt: number;
  // mastery transitions observed during session, used for Comeback Kid evaluation
  comebackTransitions: boolean;
  correctCount: number;
  totalAnswered: number;
  // mastery levels at session start, for delta reporting
  startingMastery: { [cardId: string]: number };
  masteryDeltas: { [cardId: string]: number };
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions: Map<string, ActiveSession> = new Map();

const prune = () => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.startedAt > SESSION_TTL_MS) sessions.delete(id);
  }
};

export const createSession = (
  s: Omit<ActiveSession, "startedAt" | "correctCount" | "totalAnswered" | "comebackTransitions" | "masteryDeltas">,
): ActiveSession => {
  prune();
  const session: ActiveSession = {
    ...s,
    startedAt: Date.now(),
    correctCount: 0,
    totalAnswered: 0,
    comebackTransitions: false,
    masteryDeltas: {},
  };
  sessions.set(session.sessionId, session);
  return session;
};

export const getSession = (sessionId: string): ActiveSession | undefined => sessions.get(sessionId);

export const deleteSession = (sessionId: string): void => {
  sessions.delete(sessionId);
};

export const clearSessions = (): void => {
  sessions.clear();
};
