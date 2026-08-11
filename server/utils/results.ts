import { Credentials } from "../types/index.js";
import { formatDeckResultsValue } from "@shared/types/StudyStacksTypes.js";
import { Ecosystem } from "./topiaInit.js";
import { standardizeError } from "./standardizeError.js";

/**
 * Per-deck leaderboards (only for ecosystem decks). Each deck has a
 * `results` map under it, keyed by `profileId`, valued as the standard
 * pipe-delimited leaderboard string used elsewhere in the stack:
 *
 *   studyStacksDecks.{deckId}.results.{profileId} = "{displayName}|{sessions}"
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
    const ecosystem = await Ecosystem.create({ credentials });
    const lockId = `studyStacksDeckResults-${deckId}-${profileId}-${Math.round(Date.now() / 5000) * 5000}`;
    await ecosystem.updateDataObject(
      { [`studyStacksDecks.${deckId}.results.${profileId}`]: formatDeckResultsValue(displayName, sessions) },
      { lock: { lockId, releaseLock: true } },
    );
  } catch (error) {
    throw standardizeError(error);
  }
};
