import { computeNextCards, defaultMastery, priority, recencyPenalty } from "../utils/computeNextCards.js";
import { Card, Deck, DeckProgress } from "@shared/types/StudyStacksTypes.js";

const makeCard = (id: string): Card => ({ id, front: `front ${id}`, back: `back ${id}` });
const makeDeck = (ids: string[]): Deck => ({
  id: "d1",
  scope: "ecosystem",
  title: "T",
  subject: "math",
  grades: ["5"],
  difficulty: "easy",
  status: "published",
  cards: ids.map(makeCard),
  createdByProfileId: "p",
  createdByDisplayName: "Teacher",
  createdAt: 0,
  updatedAt: 0,
});

describe("recencyPenalty", () => {
  test("never-seen cards get max penalty", () => {
    expect(recencyPenalty(0)).toBe(2);
  });
  test("just-seen cards get 0 penalty", () => {
    const now = Date.now();
    expect(recencyPenalty(now, now)).toBe(0);
  });
  test("capped at 2 for very old", () => {
    const now = Date.now();
    expect(recencyPenalty(now - 365 * 86_400_000, now)).toBe(2);
  });
});

describe("priority", () => {
  test("low mastery + many wrongs ranks high", () => {
    const now = Date.now();
    const high = priority(
      { cardId: "a", mastery: 1, lastSeenAt: now - 86_400_000, timesCorrect: 0, timesWrong: 3 },
      now,
    );
    const low = priority({ cardId: "b", mastery: 5, lastSeenAt: now, timesCorrect: 10, timesWrong: 0 }, now);
    expect(high).toBeGreaterThan(low);
  });
});

describe("computeNextCards", () => {
  test("all-new deck returns up to sessionSize cards", () => {
    const deck = makeDeck(["a", "b", "c", "d", "e"]);
    const result = computeNextCards(deck, undefined, "flip", 3);
    expect(result).toHaveLength(3);
    expect(result[0].distractors).toBeUndefined();
  });

  test("quiz mode attaches 3 distractors", () => {
    const deck = makeDeck(["a", "b", "c", "d", "e"]);
    const result = computeNextCards(deck, undefined, "quiz", 5);
    for (const r of result) {
      expect(r.distractors).toHaveLength(3);
      expect(r.distractors).not.toContain(r.card.back);
    }
  });

  test("low-mastery cards bubble to top in flip mode", () => {
    const deck = makeDeck(["a", "b", "c"]);
    const progress: DeckProgress = {
      deckId: "d1",
      cards: {
        a: { cardId: "a", mastery: 5, lastSeenAt: Date.now(), timesCorrect: 5, timesWrong: 0 },
        b: { cardId: "b", mastery: 1, lastSeenAt: Date.now(), timesCorrect: 0, timesWrong: 3 },
        c: { cardId: "c", mastery: 4, lastSeenAt: Date.now(), timesCorrect: 2, timesWrong: 1 },
      },
      sessionsCompleted: 1,
      lastStudiedAt: Date.now(),
    };
    const result = computeNextCards(deck, progress, "flip", 3);
    expect(result[0].card.id).toBe("b");
  });

  test("sprint shuffles all valid cards", () => {
    const deck = makeDeck(["a", "b", "c", "d"]);
    const result = computeNextCards(deck, undefined, "sprint", 100);
    expect(result).toHaveLength(4);
  });

  test("skips cards with empty front/back", () => {
    const deck = makeDeck(["a", "b"]);
    deck.cards[1].back = "";
    const result = computeNextCards(deck, undefined, "flip", 5);
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe("a");
  });

  test("defaultMastery returns zero state", () => {
    expect(defaultMastery("x")).toEqual({
      cardId: "x",
      mastery: 0,
      lastSeenAt: 0,
      timesCorrect: 0,
      timesWrong: 0,
    });
  });
});
