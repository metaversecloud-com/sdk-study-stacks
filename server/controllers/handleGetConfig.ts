import { Request, Response } from "express";
import {
  errorHandler,
  fetchEcosystemDecks,
  fetchResults,
  fetchUserDecks,
  getBadges,
  getCredentials,
  getVisitor,
  normalizeStudyData,
  STUDY_STACKS_DATA_KEY,
} from "@utils/index.js";
import { AssetResultsRow, Deck } from "@shared/types/StudyStacksTypes.js";

export const handleGetConfig = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.query);
    const { profileId } = credentials;
    const forceRefreshInventory = req.query.forceRefreshInventory === "true";

    const { visitor, visitorInventory } = await getVisitor(credentials, true);
    const badges = await getBadges(credentials, forceRefreshInventory);

    const isAdmin = Boolean(visitor.isAdmin);

    const [ecoMap, userMap] = await Promise.all([fetchEcosystemDecks(credentials), fetchUserDecks(credentials)]);

    // Drafts:
    //  - ecosystem drafts visible only to admins
    //  - user drafts visible only to their creator (which is always `profileId` here
    //    since we fetch the current visitor's user decks)
    const ecosystemDecks: Deck[] = Object.values(ecoMap).filter((d) => isAdmin || d.status === "published");
    const userDecks: Deck[] = Object.values(userMap).filter(
      (d) => d.createdByProfileId === profileId || d.status === "published",
    );

    const visitorDataObject = (visitor.dataObject || {}) as Record<string, any>;
    const studyData = normalizeStudyData(visitorDataObject[STUDY_STACKS_DATA_KEY]);

    const results: { [profileId: string]: AssetResultsRow } | undefined = isAdmin
      ? await fetchResults(credentials)
      : undefined;

    return res.json({
      success: true,
      ecosystemDecks,
      userDecks,
      visitorStudyData: studyData,
      badges,
      visitorInventory,
      isAdmin,
      results,
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
