import { Credentials } from "../../types/index.js";
import { DeckType, KeyAssetDataObjectType } from "@shared/types/StudyStacksTypes.js";
import { VisitorDataObjectType } from "@shared/types/VisitorData.js";
import { DroppedAsset, Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

/**
 * Decks live in two SDK-owned data objects:
 *  - Key asset (dropped) data object → class-scope decks (per-canvas, shared
 *    by every visitor who studies at that Study Stacks board)
 *  - Visitor data object             → user-scope decks (per-profile,
 *    cross-world)
 *
 * Both are stored under the top-level key `studyStacksDecks`.
 */

/**
 * Topia's data-object delete pattern is "set the path to null", which leaves
 * a `{ id: null }` slot behind in the parent map for at least one read cycle
 * (sometimes longer, depending on SDK caching). Strip those before returning
 * so callers — and any `Object.values` that follow — never see null entries.
 */
const pruneNullEntries = (map: Record<string, DeckType | null | undefined>): Record<string, DeckType> => {
  const out: Record<string, DeckType> = {};
  for (const [id, deck] of Object.entries(map)) {
    if (deck && typeof deck === "object") out[id] = deck;
  }
  return out;
};

export const fetchClassDecks = async (credentials: Credentials): Promise<Record<string, DeckType>> => {
  try {
    const { assetId, urlSlug } = credentials;
    const keyAsset = await DroppedAsset.create(assetId, urlSlug, { credentials });
    const data = ((await keyAsset.fetchDataObject()) as KeyAssetDataObjectType) || {};
    if (!data.studyStacksDecks) {
      try {
        await keyAsset.setDataObject(
          { ...data, studyStacksDecks: {} },
          { lock: { lockId: `studyStacks-class-init-${Date.now()}`, releaseLock: true } },
        );
      } catch (err) {
        console.warn("fetchClassDecks: failed to seed empty decks map", err);
      }
      return {};
    }
    return pruneNullEntries(data.studyStacksDecks);
  } catch (error) {
    console.warn("fetchClassDecks: returning empty.", error);
    return {};
  }
};

export const fetchUserDecks = async (credentials: Credentials): Promise<Record<string, DeckType>> => {
  try {
    const { visitorId, urlSlug } = credentials;
    const visitor = await Visitor.create(visitorId, urlSlug, { credentials });
    const data = ((await visitor.fetchDataObject()) as VisitorDataObjectType) || {};
    return pruneNullEntries((data.studyStacksDecks as Record<string, DeckType | null | undefined>) || {});
  } catch (error) {
    throw standardizeError(error);
  }
};

export const findDeck = async (
  credentials: Credentials,
  deckId: string,
  scope: "class" | "user",
): Promise<DeckType | undefined> => {
  if (scope === "class") {
    const decks = await fetchClassDecks(credentials);
    return decks[deckId];
  }
  const decks = await fetchUserDecks(credentials);
  return decks[deckId];
};
