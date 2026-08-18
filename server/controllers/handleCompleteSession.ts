import { Request, Response } from "express";
import {
  applyDailyStreak,
  dateKey,
  deleteSession,
  errorHandler,
  evaluateBadges,
  fetchClassDecks,
  fetchUserDecks,
  findDeck,
  getCredentials,
  getSession,
  getVisitor,
  getVisitorBadges,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
  updateDeckResult,
} from "@utils/index.js";
import { SessionSummaryType, VisitorStudyDataType } from "@shared/types/StudyStacksTypes.js";

export const handleCompleteSession = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { urlSlug, profileId, displayName } = credentials;

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) return res.status(400).json({ success: false, message: "sessionId required." });

    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found or expired." });

    const deck = await findDeck(credentials, session.deckId, session.deckScope);
    if (!deck) {
      deleteSession(sessionId);
      return res.status(404).json({ success: false, message: "Deck no longer available." });
    }
    // Pull every deck the visitor might have mastery in (class + their own)
    // so evaluateBadges can compute Deck Done / Polyglot across their full library.
    const [classDecks, userDecks] = await Promise.all([fetchClassDecks(credentials), fetchUserDecks(credentials)]);
    const allDecks = { ...classDecks, ...userDecks };

    const { visitor, visitorInventory } = await getVisitor(credentials, true);
    const dataKey = STUDY_STACKS_DATA_KEY;
    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyDataBefore: VisitorStudyDataType = normalizeStudyData(visitorDataObject[dataKey]);
    const studyData: VisitorStudyDataType = JSON.parse(JSON.stringify(studyDataBefore));

    const progress = studyData.decks[session.deckId] || {
      deckId: session.deckId,
      cards: {},
      sessionsCompleted: 0,
      lastStudiedAt: Date.now(),
    };
    progress.sessionsCompleted = (progress.sessionsCompleted || 0) + 1;
    progress.lastStudiedAt = Date.now();
    studyData.decks[session.deckId] = progress;
    studyData.totalSessionsCompleted = (studyData.totalSessionsCompleted || 0) + 1;

    const today = dateKey(Date.now());
    studyData.streak = applyDailyStreak(studyData.streak, today);

    const lockId = `${dataKey}-complete-${Math.round(Date.now() / 5000) * 5000}`;
    await visitor.updateDataObject(
      { [dataKey]: studyData },
      {
        analytics: [{ analyticName: "completions", profileId, uniqueKey: profileId, urlSlug }],
        lock: { lockId, releaseLock: true },
      },
    );

    // Per-deck leaderboard write — class decks only. User decks are
    // personal (live in the owner's visitor data object), so there's no
    // audience to aggregate.
    if (session.deckScope === "class") {
      const deckSessions = progress.sessionsCompleted;
      await updateDeckResult({
        credentials,
        deckId: session.deckId,
        profileId,
        displayName: displayName || "Player",
        sessions: deckSessions,
      }).catch((err: any) => console.warn("Failed to update deck results", err));
    }

    // Evaluate and grant badges
    const newBadges = await evaluateBadges({
      credentials,
      visitor,
      visitorInventory,
      studyDataAfter: studyData,
      studyDataBefore,
      decks: allDecks,
      sessionMode: session.mode,
      sessionCorrect: session.correctCount,
      sessionTotal: session.totalAnswered,
      comebackTransitions: session.comebackTransitions,
    });

    let updatedInventory = visitorInventory;
    if (newBadges.length > 0) {
      await visitor.fetchInventoryItems();
      updatedInventory = getVisitorBadges(visitor.inventoryItems);
    }

    const summary: SessionSummaryType = {
      cardsStudied: session.totalAnswered,
      correctCount: session.correctCount,
      totalCardsInSession: session.cardIds.length,
      masteryDeltas: session.masteryDeltas,
      newBadges,
      streakAfter: { current: studyData.streak.current, longest: studyData.streak.longest },
    };

    deleteSession(sessionId);

    return res.json({ success: true, summary, visitorStudyData: studyData, visitorInventory: updatedInventory });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleCompleteSession",
      message: "Error completing study session.",
      req,
      res,
    });
  }
};
