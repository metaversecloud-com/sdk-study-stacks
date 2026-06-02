import { Request, Response } from "express";
import {
  buildDeckFromInput,
  errorHandler,
  fetchEcosystemDecks,
  fetchUserDecks,
  getCredentials,
  getVisitor,
  persistDeck,
} from "@utils/index.js";
import { DeckScopeType } from "@shared/types/StudyStacksTypes.js";

export const handleSaveDeck = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const incoming = req.body?.deck;
    const scope: DeckScopeType = req.body?.scope;

    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ success: false, message: "Missing deck in request body." });
    }
    if (scope !== "user" && scope !== "ecosystem") {
      return res.status(400).json({ success: false, message: "Invalid scope." });
    }

    const { visitor } = await getVisitor(credentials, true);
    if (scope === "ecosystem" && !visitor.isAdmin) {
      return res.status(403).json({ success: false, message: "Only admins can save ecosystem decks." });
    }

    // Look up existing deck so we preserve ecosystem-only metadata
    // (createdBy*) across edits.
    const existingMap =
      scope === "ecosystem" ? await fetchEcosystemDecks(credentials) : await fetchUserDecks(credentials);
    const incomingId = incoming.id ? String(incoming.id) : undefined;
    const existing = incomingId ? existingMap[incomingId] : undefined;

    // No per-deck owner check for user decks: they're fetched from the calling
    // visitor's own data object, so a user can only ever edit their own. The
    // admin gate above covers ecosystem decks.

    const { deck, validationError } = buildDeckFromInput({ credentials, scope, incoming, existing });
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    await persistDeck({ credentials, scope, deck });
    return res.json({ success: true, deck });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleSaveDeck",
      message: "Error saving deck.",
      req,
      res,
    });
  }
};
