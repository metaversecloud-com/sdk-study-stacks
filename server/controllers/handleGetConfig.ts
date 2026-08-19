import { Request, Response } from "express";
import {
  errorHandler,
  fetchClassDecks,
  fetchUserDecks,
  getBadges,
  getCredentials,
  getVisitor,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
} from "@utils/index.js";
import { DeckType } from "@shared/types/StudyStacksTypes.js";

export const handleGetConfig = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";

    const { visitor, visitorInventory } = await getVisitor(credentials, true);
    const badges = await getBadges(credentials, forceRefreshInventory);

    const isAdmin = Boolean(visitor.isAdmin);

    const [classMap, userMap] = await Promise.all([fetchClassDecks(credentials), fetchUserDecks(credentials)]);

    // Class-deck drafts are visible only to admins. User decks all belong
    // to the current visitor (they come from this visitor's own data
    // object), so every one of them — draft or published — is theirs to see.
    //
    // Per-deck `results` ride along on each class deck (admin-only) so
    // a separate aggregate-results fetch is no longer needed.
    const classDecks: DeckType[] = Object.values(classMap).filter((d) => isAdmin || d.status === "published");
    const userDecks: DeckType[] = Object.values(userMap);

    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyData = normalizeStudyData(visitorDataObject[STUDY_STACKS_DATA_KEY]);

    return res.json({
      success: true,
      classDecks,
      userDecks,
      visitorStudyData: studyData,
      badges,
      visitorInventory,
      isAdmin,
    });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleGetConfig",
      message: "Error loading Study Stacks config.",
      req,
      res,
    });
  }
};
