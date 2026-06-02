import { Credentials } from "../../types/index.js";
import {
  ALL_GRADES_SENTINEL,
  CardType,
  DeckType,
  DeckGradesType,
  DeckScopeType,
  GradeType,
  isCardComplete,
  MAX_CARDS_PER_DECK,
  normalizeGrades,
  SubjectType,
} from "@shared/types/StudyStacksTypes.js";
import { Ecosystem, Visitor } from "../topiaInit.js";
import { standardizeError } from "../standardizeError.js";

const VALID_SUBJECTS: SubjectType[] = ["math", "ela", "science", "history", "language", "art", "other"];
const VALID_DIFFICULTIES: DeckType["difficulty"][] = ["easy", "medium", "hard"];
const VALID_STATUSES: DeckType["status"][] = ["draft", "published"];

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

const sanitizeCard = (raw: any, index: number): CardType => {
  const front = String(raw?.front ?? "").slice(0, 1000);
  const back = String(raw?.back ?? "").slice(0, 1000);
  const id = String(raw?.id ?? `c_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`);
  const hint = raw?.hint ? String(raw.hint).slice(0, 500) : undefined;
  const imageUrl = sanitizeImageUrl(raw?.imageUrl);
  return { id, front, back, ...(hint ? { hint } : {}), ...(imageUrl ? { imageUrl } : {}) };
};

export interface SaveDeckInput {
  credentials: Credentials;
  scope: DeckScopeType;
  /** raw payload from the client (untrusted) */
  incoming: any;
  /** the deck already in storage at this id, if any */
  existing?: DeckType;
}

export interface SaveDeckResult {
  deck: DeckType;
  isNew: boolean;
  validationError?: string;
}

export const buildDeckFromInput = ({ credentials, scope, incoming, existing }: SaveDeckInput): SaveDeckResult => {
  const { profileId, displayName } = credentials;

  if (!incoming || typeof incoming !== "object") {
    return { deck: {} as DeckType, isNew: false, validationError: "Missing deck in request body." };
  }

  const id = String(incoming.id || `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const title = String(incoming.title ?? existing?.title ?? "")
    .trim()
    .slice(0, 120);
  if (!title) return { deck: {} as DeckType, isNew: false, validationError: "Title is required." };

  const subject: SubjectType = VALID_SUBJECTS.includes(incoming.subject) ? incoming.subject : existing?.subject || "other";

  // Grade targeting only applies to ecosystem decks; we don't compute it for
  // user decks at all so it doesn't get written to the visitor data object.
  //
  // Incoming wire forms we accept (for both new and existing decks):
  //   - `"all"`     → store the sentinel verbatim
  //   - `Grade[]`   → store the subset; if it happens to contain every grade
  //                   we collapse it to `"all"` via normalizeGrades to keep
  //                   the stored payload small
  // If nothing usable comes in, we fall back to the existing value (if any)
  // or default new decks to `"all"`.
  const resolveIncomingGrades = (): DeckGradesType | undefined => {
    if (scope !== "ecosystem") return undefined;
    if (incoming.grades === ALL_GRADES_SENTINEL) return ALL_GRADES_SENTINEL;
    if (Array.isArray(incoming.grades) && incoming.grades.length > 0) {
      const arr = incoming.grades.map((g: any) => String(g)) as GradeType[];
      return normalizeGrades(arr);
    }
    return existing?.grades ?? ALL_GRADES_SENTINEL;
  };
  const grades = resolveIncomingGrades();

  const difficulty: DeckType["difficulty"] = VALID_DIFFICULTIES.includes(incoming.difficulty)
    ? incoming.difficulty
    : existing?.difficulty || "medium";

  const requestedStatus: DeckType["status"] = VALID_STATUSES.includes(incoming.status)
    ? incoming.status
    : existing?.status || "draft";

  const rawCards: any[] = Array.isArray(incoming.cards) ? incoming.cards : existing?.cards || [];
  if (rawCards.length === 0) {
    return {
      deck: {} as DeckType,
      isNew: false,
      validationError: "Add at least one card before saving.",
    };
  }
  if (rawCards.length > MAX_CARDS_PER_DECK) {
    return {
      deck: {} as DeckType,
      isNew: false,
      validationError: `Decks are limited to ${MAX_CARDS_PER_DECK} cards.`,
    };
  }
  const cards: CardType[] = rawCards.map((c, i) => sanitizeCard(c, i));
  const emptyCount = cards.filter((c) => !isCardComplete(c)).length;
  if (emptyCount > 0) {
    return {
      deck: {} as DeckType,
      isNew: false,
      validationError: `${emptyCount} card${emptyCount === 1 ? " is" : "s are"} empty. Every card needs a front (text or image) and a back.`,
    };
  }

  const isNew = !existing;
  const deck: DeckType = {
    id,
    scope,
    title,
    subject,
    difficulty,
    status: requestedStatus,
    cards,
    // Ecosystem-only fields. Omitted entirely from user decks so they don't
    // bloat the visitor data object.
    ...(grades ? { grades } : {}),
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
  scope: DeckScopeType;
  deck: DeckType;
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
  scope: DeckScopeType;
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
