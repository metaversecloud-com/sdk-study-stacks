import { Credentials } from "../../types/index.js";
import { Deck, EcosystemDataObjectType } from "@shared/types/StudyStacksTypes.js";
import { VisitorDataObjectType } from "@shared/types/VisitorData.js";
import { Ecosystem, Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

/**
 * Decks live in two SDK-owned data objects (mirrors sdk-trivia's set storage):
 *  - Ecosystem data object → ecosystem-scope decks (account-wide, all worlds)
 *  - Visitor data object   → user-scope decks (per-profile, cross-world)
 *
 * Both are stored under the top-level key `studyStacksDecks`.
 */

export const fetchEcosystemDecks = async (credentials: Credentials): Promise<Record<string, Deck>> => {
  try {
    const ecosystem = await Ecosystem.create({ credentials });
    const data = ((await ecosystem.fetchDataObject()) as EcosystemDataObjectType) || {};
    if (!data.studyStacksDecks) {
      try {
        await ecosystem.setDataObject(
          { ...data, studyStacksDecks: {} },
          { lock: { lockId: `studyStacks-eco-init-${Date.now()}`, releaseLock: true } },
        );
      } catch (err) {
        console.warn("fetchEcosystemDecks: failed to seed empty decks map", err);
      }
      return {};
    }
    return data.studyStacksDecks || {};
  } catch (error) {
    console.warn("fetchEcosystemDecks: returning empty.", error);
    return {};
  }
};

export const fetchUserDecks = async (credentials: Credentials): Promise<Record<string, Deck>> => {
  try {
    const { visitorId, urlSlug } = credentials;
    const visitor = await Visitor.create(visitorId, urlSlug, { credentials });
    const data = ((await visitor.fetchDataObject()) as VisitorDataObjectType) || {};
    return (data.studyStacksDecks as { [id: string]: Deck }) || {};
  } catch (error) {
    throw standardizeError(error);
  }
};

export const findDeck = async (
  credentials: Credentials,
  deckId: string,
  scope: "ecosystem" | "user",
): Promise<Deck | undefined> => {
  if (scope === "ecosystem") {
    const decks = await fetchEcosystemDecks(credentials);
    return decks[deckId];
  }
  const decks = await fetchUserDecks(credentials);
  return decks[deckId];
};
