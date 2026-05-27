import { Deck, STUDY_STACK_BADGES, StudyMode, Subject, VisitorStudyData } from "@shared/types/StudyStacksTypes.js";
import { Credentials } from "../types/index.js";
import { awardBadge } from "./awardBadge.js";

export interface BadgeEvaluationContext {
  credentials: Credentials;
  visitor: any;
  visitorInventory: { [name: string]: any };
  studyDataAfter: VisitorStudyData;
  studyDataBefore: VisitorStudyData;
  decks: { [deckId: string]: Deck };
  sessionMode: StudyMode;
  sessionCorrect: number;
  sessionTotal: number;
  /** mastery transitions observed in this session for the "comeback kid" badge */
  comebackTransitions: boolean;
}

const checkBookwormTier = (data: VisitorStudyData): string[] => {
  const total = data.totalCardsStudied;
  const out: string[] = [];
  if (total >= 50) out.push(STUDY_STACK_BADGES.BOOKWORM);
  if (total >= 250) out.push(STUDY_STACK_BADGES.SCHOLAR);
  if (total >= 1000) out.push(STUDY_STACK_BADGES.MASTER);
  return out;
};

const checkStreakTier = (data: VisitorStudyData): string[] => {
  const c = data.streak?.current || 0;
  const out: string[] = [];
  if (c >= 7) out.push(STUDY_STACK_BADGES.STREAKER);
  if (c >= 30) out.push(STUDY_STACK_BADGES.MARATHONER);
  return out;
};

const fullyMasteredDeckIds = (data: VisitorStudyData, decks: { [deckId: string]: Deck }): string[] => {
  const out: string[] = [];
  for (const [deckId, progress] of Object.entries(data.decks || {})) {
    const deck = decks[deckId];
    if (!deck || deck.cards.length === 0) continue;
    const allMastered = deck.cards.every((c) => (progress.cards[c.id]?.mastery ?? 0) >= 5);
    if (allMastered) out.push(deckId);
  }
  return out;
};

/**
 * Evaluate all Study Stacks badges; grant any that the visitor newly qualifies for.
 * Returns the names of badges newly granted in this call.
 */
export const evaluateBadges = async (ctx: BadgeEvaluationContext): Promise<string[]> => {
  const candidates = new Set<string>();

  if (ctx.studyDataAfter.totalSessionsCompleted >= 1) {
    candidates.add(STUDY_STACK_BADGES.FIRST_STEP);
  }

  for (const b of checkBookwormTier(ctx.studyDataAfter)) candidates.add(b);
  for (const b of checkStreakTier(ctx.studyDataAfter)) candidates.add(b);

  // Deck Done
  const masteredDecks = fullyMasteredDeckIds(ctx.studyDataAfter, ctx.decks);
  if (masteredDecks.length >= 1) candidates.add(STUDY_STACK_BADGES.DECK_DONE);

  // Polyglot: deck-done on decks in 3 different subjects
  const masteredSubjects = new Set(
    masteredDecks.map((id) => ctx.decks[id]?.subject).filter((s): s is Subject => Boolean(s)),
  );
  if (masteredSubjects.size >= 3) candidates.add(STUDY_STACK_BADGES.POLYGLOT);

  if (ctx.comebackTransitions) candidates.add(STUDY_STACK_BADGES.COMEBACK_KID);

  if (ctx.sessionMode === "sprint" && ctx.sessionCorrect >= 20) {
    candidates.add(STUDY_STACK_BADGES.SPEED_DEMON);
  }
  if (ctx.sessionMode === "quiz" && ctx.sessionTotal >= 10 && ctx.sessionCorrect === ctx.sessionTotal) {
    candidates.add(STUDY_STACK_BADGES.PERFECTIONIST);
  }

  const granted: string[] = [];
  for (const badgeName of candidates) {
    const outcome = await awardBadge({
      credentials: ctx.credentials,
      visitor: ctx.visitor,
      visitorInventory: ctx.visitorInventory,
      badgeName,
    });
    if (outcome === "granted") granted.push(badgeName);
  }
  return granted;
};
