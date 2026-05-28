import { Request, Response } from "express";
import { deleteDeck, errorHandler, findDeck, getCredentials, getVisitor } from "@utils/index.js";
import { DeckScope } from "@shared/types/StudyStacksTypes.js";

export const handleDeleteDeck = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { deckId } = req.params;
    if (!deckId) return res.status(400).json({ success: false, message: "deckId is required." });

    const scope = (req.query.scope as DeckScope) || (req.body?.scope as DeckScope);
    if (scope !== "user" && scope !== "ecosystem") {
      return res.status(400).json({ success: false, message: "Invalid scope." });
    }

    const { visitor } = await getVisitor(credentials, true);

    if (scope === "ecosystem" && !visitor.isAdmin) {
      return res.status(403).json({ success: false, message: "Only admins can delete ecosystem decks." });
    }

    const existing = await findDeck(credentials, deckId, scope);
    if (!existing) return res.status(404).json({ success: false, message: "Deck not found." });

    // No per-deck owner check for user decks: they live in the calling
    // visitor's own data object, so a user can only delete their own. The
    // admin gate above covers ecosystem decks.

    await deleteDeck({ credentials, scope, deckId });
    return res.json({ success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleDeleteDeck",
      message: "Error deleting deck.",
      req,
      res,
    });
  }
};
