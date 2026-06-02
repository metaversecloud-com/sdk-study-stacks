import { Request, Response } from "express";
import {
  computeNextCards,
  createSession,
  errorHandler,
  findDeck,
  getCredentials,
  getVisitor,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
} from "@utils/index.js";
import { DeckScopeType, FLIP_SESSION_SIZE, QUIZ_SESSION_SIZE, StudyModeType } from "@shared/types/StudyStacksTypes.js";

const SESSION_SIZE: { [mode in StudyModeType]: number } = {
  flip: FLIP_SESSION_SIZE,
  quiz: QUIZ_SESSION_SIZE,
  sprint: 100,
};

export const handleStartSession = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { assetId, visitorId, profileId, urlSlug } = credentials;

    const deckId: string = req.body?.deckId;
    const mode: StudyModeType = req.body?.mode;
    const scope: DeckScopeType = req.body?.scope;
    if (!deckId) return res.status(400).json({ success: false, message: "deckId is required." });
    if (!["flip", "quiz", "sprint"].includes(mode)) {
      return res.status(400).json({ success: false, message: "Invalid mode." });
    }
    if (scope !== "user" && scope !== "ecosystem") {
      return res.status(400).json({ success: false, message: "Invalid scope." });
    }

    const deck = await findDeck(credentials, deckId, scope);
    if (!deck) return res.status(404).json({ success: false, message: "Deck not found." });

    const { visitor } = await getVisitor(credentials, true);

    // Ecosystem drafts are admin-only. User decks come from the caller's own
    // data object, so their drafts are always the caller's to study.
    if (deck.status !== "published" && scope === "ecosystem" && !visitor.isAdmin) {
      return res.status(404).json({ success: false, message: "Deck not found." });
    }

    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyData = normalizeStudyData(visitorDataObject[STUDY_STACKS_DATA_KEY]);
    const progress = studyData.decks[deckId];

    const computed = computeNextCards(deck, progress, mode, SESSION_SIZE[mode]);
    if (computed.length === 0) {
      return res.status(400).json({ success: false, message: "Deck has no playable cards." });
    }

    const sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startingMastery: { [cardId: string]: number } = {};
    for (const c of computed) {
      startingMastery[c.card.id] = progress?.cards?.[c.card.id]?.mastery ?? 0;
    }

    createSession({
      sessionId,
      visitorId,
      assetId,
      deckId,
      deckScope: scope,
      mode,
      cardIds: computed.map((c) => c.card.id),
      startingMastery,
    });

    await visitor.updateDataObject(
      {},
      { analytics: [{ analyticName: "starts", profileId, uniqueKey: profileId, urlSlug }] },
    );

    return res.json({
      success: true,
      sessionId,
      cards: computed.map(({ card, distractors }) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        hint: card.hint,
        ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
        ...(distractors ? { distractors } : {}),
      })),
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleStartSession",
      message: "Error starting study session.",
      req,
      res,
    });
  }
};
