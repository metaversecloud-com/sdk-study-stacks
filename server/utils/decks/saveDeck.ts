import { Credentials } from "../../types/index.js";
import { Card, Deck, DeckScope, Grade, isCardComplete, MAX_CARDS_PER_DECK, Subject } from "@shared/types/StudyStacksTypes.js";
import { Ecosystem, Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

const VALID_SUBJECTS: Subject[] = ["math", "ela", "science", "history", "language", "art", "other"];
const VALID_DIFFICULTIES: Deck["difficulty"][] = ["easy", "medium", "hard"];
const VALID_STATUSES: Deck["status"][] = ["draft", "published"];

/** Accept only public http(s) image URLs; anything else is dropped. */
const sanitizeImageUrl = (raw: any): string | undefined => {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return value.slice(0, 2000);
  } catch {
    return undefined;
  }
};

const sanitizeCard = (raw: any, index: number): Card => {
  const front = String(raw?.front ?? "").slice(0, 1000);
  const back = String(raw?.back ?? "").slice(0, 1000);
  const id = String(raw?.id ?? `c_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`);
  const hint = raw?.hint ? String(raw.hint).slice(0, 500) : undefined;
  const imageUrl = sanitizeImageUrl(raw?.imageUrl);
  return { id, front, back, ...(hint ? { hint } : {}), ...(imageUrl ? { imageUrl } : {}) };
};

export interface SaveDeckInput {
  credentials: Credentials;
  scope: DeckScope;
  /** raw payload from the client (untrusted) */
  incoming: any;
  /** the deck already in storage at this id, if any */
  existing?: Deck;
}

export interface SaveDeckResult {
  deck: Deck;
  isNew: boolean;
  validationError?: string;
}

export const buildDeckFromInput = ({ credentials, scope, incoming, existing }: SaveDeckInput): SaveDeckResult => {
  const { profileId, displayName } = credentials;

  if (!incoming || typeof incoming !== "object") {
    return { deck: {} as Deck, isNew: false, validationError: "Missing deck in request body." };
  }

  const id = String(incoming.id || `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const title = String(incoming.title ?? existing?.title ?? "")
    .trim()
    .slice(0, 120);
  if (!title) return { deck: {} as Deck, isNew: false, validationError: "Title is required." };

  const subject: Subject = VALID_SUBJECTS.includes(incoming.subject) ? incoming.subject : existing?.subject || "other";

  const grades: Grade[] =
    Array.isArray(incoming.grades) && incoming.grades.length > 0
      ? (incoming.grades.map((g: any) => String(g)) as Grade[])
      : existing?.grades || (["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as Grade[]);

  const difficulty: Deck["difficulty"] = VALID_DIFFICULTIES.includes(incoming.difficulty)
    ? incoming.difficulty
    : existing?.difficulty || "medium";

  const requestedStatus: Deck["status"] = VALID_STATUSES.includes(incoming.status)
    ? incoming.status
    : existing?.status || "draft";

  const rawCards: any[] = Array.isArray(incoming.cards) ? incoming.cards : existing?.cards || [];
  if (rawCards.length > MAX_CARDS_PER_DECK) {
    return {
      deck: {} as Deck,
      isNew: false,
      validationError: `Decks are limited to ${MAX_CARDS_PER_DECK} cards.`,
    };
  }
  const cards: Card[] = rawCards.map((c, i) => sanitizeCard(c, i));
  const hasValidCard = cards.some(isCardComplete);

  if (requestedStatus === "published" && !hasValidCard) {
    return {
      deck: {} as Deck,
      isNew: false,
      validationError: "Cannot publish: deck needs at least one card with a front (text or image) and a back.",
    };
  }

  const now = Date.now();
  const isNew = !existing;
  const deck: Deck = {
    id,
    scope,
    title,
    subject,
    grades,
    difficulty,
    status: requestedStatus,
    cards,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    // Authorship is only meaningful on ecosystem decks (shared across admins).
    // User decks are owned implicitly by the visitor whose data object holds
    // them, so we don't store a creator on them.
    ...(scope === "ecosystem"
      ? {
          createdByProfileId: existing?.createdByProfileId || profileId || "",
          createdByDisplayName: existing?.createdByDisplayName || displayName || "Teacher",
        }
      : {}),
  };
  return { deck, isNew };
};

/**
 * Persist a deck to the correct SDK data object based on scope. Caller is
 * responsible for auth checks (admin gate for ecosystem; ownership for user).
 */
export const persistDeck = async ({
  credentials,
  scope,
  deck,
}: {
  credentials: Credentials;
  scope: DeckScope;
  deck: Deck;
}): Promise<void> => {
  try {
    const lockId = `studyStacksDecks-${deck.id}-${Math.round(Date.now() / 30000) * 30000}`;
    if (scope === "ecosystem") {
      const ecosystem = await Ecosystem.create({ credentials });
      await ecosystem.updateDataObject(
        { [`studyStacksDecks.${deck.id}`]: deck },
        { lock: { lockId, releaseLock: true } },
      );
    } else {
      const { visitorId, urlSlug } = credentials;
      const visitor = await Visitor.create(visitorId, urlSlug, { credentials });
      await visitor.updateDataObject(
        { [`studyStacksDecks.${deck.id}`]: deck },
        { lock: { lockId, releaseLock: true } },
      );
    }
  } catch (error) {
    throw standardizeError(error);
  }
};

export const deleteDeck = async ({
  credentials,
  scope,
  deckId,
}: {
  credentials: Credentials;
  scope: DeckScope;
  deckId: string;
}): Promise<void> => {
  try {
    const lockId = `studyStacksDecks-del-${deckId}-${Math.round(Date.now() / 30000) * 30000}`;
    if (scope === "ecosystem") {
      const ecosystem = await Ecosystem.create({ credentials });
      await ecosystem.updateDataObject(
        { [`studyStacksDecks.${deckId}`]: null },
        { lock: { lockId, releaseLock: true } },
      );
    } else {
      const { visitorId, urlSlug } = credentials;
      const visitor = await Visitor.create(visitorId, urlSlug, { credentials });
      await visitor.updateDataObject({ [`studyStacksDecks.${deckId}`]: null }, { lock: { lockId, releaseLock: true } });
    }
  } catch (error) {
    throw standardizeError(error);
  }
};
