import { Credentials } from "../types/index.js";
import { AssetResultsRow, EcosystemDataObjectType } from "@shared/types/StudyStacksTypes.js";
import { Ecosystem } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Aggregate per-student results are ecosystem-wide (account-level) — shared
 * across every Study Stacks desk in every world, alongside ecosystem decks.
 */

export const fetchResults = async (
  credentials: Credentials,
): Promise<{ [profileId: string]: AssetResultsRow }> => {
  try {
    const ecosystem = await Ecosystem.create({ credentials });
    const data = ((await ecosystem.fetchDataObject()) as EcosystemDataObjectType) || {};
    return data.studyStacksResults || {};
  } catch (error) {
    console.warn("fetchResults failed; returning empty.", error);
    return {};
  }
};

export const updateResultsRow = async (
  credentials: Credentials,
  profileId: string,
  row: AssetResultsRow,
): Promise<void> => {
  try {
    const ecosystem = await Ecosystem.create({ credentials });
    const lockId = `studyStacksResults-${profileId}-${Math.round(Date.now() / 5000) * 5000}`;
    await ecosystem.updateDataObject(
      { [`studyStacksResults.${profileId}`]: row },
      { lock: { lockId, releaseLock: true } },
    );
  } catch (error) {
    throw standardizeError(error);
  }
};
