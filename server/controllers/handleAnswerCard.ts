import { Request, Response } from "express";
import {
  errorHandler,
  findDeck,
  getCredentials,
  getSession,
  getVisitor,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
} from "@utils/index.js";
import { CardMastery, DeckProgress, FlipRating, MasteryLevel, StudyMode } from "@shared/types/StudyStacksTypes.js";

const clampMastery = (n: number): MasteryLevel => {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return v as MasteryLevel;
};

const masteryDeltaForFlip = (rating: FlipRating): number => {
  if (rating === "got_it") return 2;
  if (rating === "almost") return 0;
  return -1;
};

const masteryDeltaForQuiz = (isCorrect: boolean): number => (isCorrect ? 1 : -1);

const masteryDeltaForSprint = (isCorrect: boolean): number => (isCorrect ? 1 : 0);

export const handleAnswerCard = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);

    const { sessionId, cardId, mode, rating, isCorrect } = req.body as {
      sessionId: string;
      cardId: string;
      mode: StudyMode;
      rating?: FlipRating;
      isCorrect?: boolean;
    };
    if (!sessionId || !cardId || !mode) {
      return res.status(400).json({ success: false, message: "sessionId, cardId, mode required." });
    }

    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found or expired." });
    if (!session.cardIds.includes(cardId)) {
      return res.status(400).json({ success: false, message: "Card not part of session." });
    }

    const deck = await findDeck(credentials, session.deckId, session.deckScope);
    if (!deck) return res.status(404).json({ success: false, message: "Deck no longer available." });

    const { visitor } = await getVisitor(credentials, true);
    const dataKey = STUDY_STACKS_DATA_KEY;
    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyData = normalizeStudyData(visitorDataObject[dataKey]);

    const progress: DeckProgress = studyData.decks[session.deckId] || {
      deckId: session.deckId,
      cards: {},
      sessionsCompleted: 0,
      lastStudiedAt: 0,
    };

    const prev: CardMastery = progress.cards[cardId] || {
      cardId,
      mastery: 0,
      lastSeenAt: 0,
      timesCorrect: 0,
      timesWrong: 0,
    };

    let delta = 0;
    let correct = false;
    if (mode === "flip") {
      if (!rating) return res.status(400).json({ success: false, message: "Flip mode requires rating." });
      delta = masteryDeltaForFlip(rating);
      correct = rating === "got_it";
    } else if (mode === "quiz") {
      if (typeof isCorrect !== "boolean")
        return res.status(400).json({ success: false, message: "Quiz mode requires isCorrect." });
      delta = masteryDeltaForQuiz(isCorrect);
      correct = isCorrect;
    } else if (mode === "sprint") {
      if (typeof isCorrect !== "boolean")
        return res.status(400).json({ success: false, message: "Sprint mode requires isCorrect." });
      delta = masteryDeltaForSprint(isCorrect);
      correct = isCorrect;
    } else {
      return res.status(400).json({ success: false, message: "Unknown mode." });
    }

    const newMasteryNum = prev.mastery + delta;
    const newMastery = clampMastery(newMasteryNum);

    const updatedCard: CardMastery = {
      cardId,
      mastery: newMastery,
      lastSeenAt: Date.now(),
      timesCorrect: prev.timesCorrect + (correct ? 1 : 0),
      timesWrong: prev.timesWrong + (correct ? 0 : 1),
    };

    progress.cards[cardId] = updatedCard;
    progress.lastStudiedAt = Date.now();
    studyData.decks[session.deckId] = progress;
    studyData.totalCardsStudied = (studyData.totalCardsStudied || 0) + 1;

    const lockId = `${dataKey}-answer-${Math.round(Date.now() / 5000) * 5000}`;
    await visitor.updateDataObject({ [dataKey]: studyData }, { lock: { lockId, releaseLock: true } });

    // Session-level bookkeeping
    session.totalAnswered += 1;
    if (correct) session.correctCount += 1;
    const startMastery = session.startingMastery[cardId] ?? 0;
    if (startMastery <= 1 && newMastery >= 5) session.comebackTransitions = true;
    session.masteryDeltas[cardId] = (session.masteryDeltas[cardId] || 0) + delta;

    return res.json({ success: true, masteryAfter: newMastery });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleAnswerCard",
      message: "Error recording card answer.",
      req,
      res,
    });
  }
};
