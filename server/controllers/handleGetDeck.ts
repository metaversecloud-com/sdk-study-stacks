import { Request, Response } from "express";
import {
  errorHandler,
  findDeck,
  getCredentials,
  getVisitor,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
} from "@utils/index.js";
import { DeckScope, VisitorStudyData } from "@shared/types/StudyStacksTypes.js";

export const handleGetDeck = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { deckId } = req.params;
    if (!deckId) return res.status(400).json({ success: false, message: "deckId is required." });

    const scope = (req.query.scope as DeckScope) || "ecosystem";
    if (scope !== "user" && scope !== "ecosystem") {
      return res.status(400).json({ success: false, message: "Invalid scope." });
    }

    const deck = await findDeck(credentials, deckId, scope);
    if (!deck) return res.status(404).json({ success: false, message: "Deck not found." });

    const { visitor } = await getVisitor(credentials, true);

    // Ecosystem drafts are admin-only. User decks come from the caller's own
    // data object, so their drafts are always the caller's to view.
    if (deck.status !== "published" && scope === "ecosystem" && !visitor.isAdmin) {
      return res.status(404).json({ success: false, message: "Deck not found." });
    }

    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyData: VisitorStudyData = normalizeStudyData(visitorDataObject[STUDY_STACKS_DATA_KEY]);
    const mastery = studyData.decks?.[deckId]?.cards || {};

    return res.json({ success: true, deck, mastery });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetDeck",
      message: "Error fetching deck.",
      req,
      res,
    });
  }
};
