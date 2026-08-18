import { Credentials } from "../types/index.js";
import { formatDeckResultsValue } from "@shared/types/StudyStacksTypes.js";
import { DroppedAsset } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Per-deck leaderboards (only for class decks). Each deck has a `results`
 * map under it, keyed by `profileId`, valued as the standard pipe-delimited
 * leaderboard string used elsewhere in the stack:
 *
 *   studyStacksDecks.{deckId}.results.{profileId} = "{displayName}|{sessions}"
 *
 * Written to the key asset's data object — the same location the class
 * deck itself lives on, so a leaderboard is scoped to the specific Study
 * Stacks canvas the visitor studied at.
 *
 * User decks have no leaderboard — they live in a single visitor's data
 * object, so there's no audience to aggregate.
 */

export const updateDeckResult = async ({
  credentials,
  deckId,
  profileId,
  displayName,
  sessions,
}: {
  credentials: Credentials;
  deckId: string;
  profileId: string;
  displayName: string;
  sessions: number;
}): Promise<void> => {
  try {
    const { assetId, urlSlug } = credentials;
    const keyAsset = await DroppedAsset.create(assetId, urlSlug, { credentials });
    const lockId = `studyStacksDeckResults-${deckId}-${profileId}-${Math.round(Date.now() / 5000) * 5000}`;
    await keyAsset.updateDataObject(
      { [`studyStacksDecks.${deckId}.results.${profileId}`]: formatDeckResultsValue(displayName, sessions) },
      { lock: { lockId, releaseLock: true } },
    );
  } catch (error) {
    throw standardizeError(error);
  }
};
