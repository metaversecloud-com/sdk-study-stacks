import { computeNextCards, defaultMastery, priority, recencyPenalty } from "../utils/computeNextCards.js";
import { CardType, DeckType, DeckProgressType } from "@shared/types/StudyStacksTypes.js";

const makeCard = (id: string): CardType => ({ id, front: `front ${id}`, back: `back ${id}` });
const makeDeck = (ids: string[]): DeckType => ({
  id: "d1",
  scope: "class",
  title: "T",
  subject: "math",
  grades: ["5"],
  difficulty: "easy",
  status: "published",
  cards: ids.map(makeCard),
  createdByProfileId: "p",
  createdByDisplayName: "Teacher",
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

  test("quiz distractors never duplicate the correct answer when siblings share back text", () => {
    // Regression: two cards sharing the same answer used to surface that
    // answer as both the correct option and a distractor.
    const sharedBack: CardType = { id: "math-1", front: "4+4", back: "8" };
    const collidingSibling: CardType = { id: "math-2", front: "2+6", back: "8" };
    const otherSibling: CardType = { id: "math-3", front: "10-3", back: "7" };
    const wildcard: CardType = { id: "math-4", front: "1+1", back: "2" };
    const deck: DeckType = {
      id: "d1",
      scope: "class",
      title: "T",
      subject: "math",
      grades: ["5"],
      difficulty: "easy",
      status: "published",
      cards: [sharedBack, collidingSibling, otherSibling, wildcard],
      createdByProfileId: "p",
      createdByDisplayName: "Teacher",
    };

    const result = computeNextCards(deck, undefined, "quiz", 4);
    const targeted = result.find((r) => r.card.id === sharedBack.id);
    expect(targeted).toBeDefined();
    // Correct answer ("8") must not appear in distractors, even case-insensitive.
    expect(targeted!.distractors).not.toEqual(expect.arrayContaining(["8"]));
    expect(targeted!.distractors!.map((s) => s.toLowerCase())).not.toContain("8");
    // And no two distractors should collide with each other.
    const set = new Set(targeted!.distractors!.map((s) => s.trim().toLowerCase()));
    expect(set.size).toBe(targeted!.distractors!.length);
  });

  test("distractor pool also dedupes among siblings sharing answers", () => {
    // Three siblings answering "blue" should collapse to one entry in the pool.
    const target: CardType = { id: "t", front: "Q", back: "red" };
    const dup1: CardType = { id: "d1", front: "A", back: "Blue" };
    const dup2: CardType = { id: "d2", front: "B", back: "blue " };
    const dup3: CardType = { id: "d3", front: "C", back: "BLUE" };
    const unique: CardType = { id: "u", front: "D", back: "green" };
    const deck: DeckType = {
      ...makeDeck(["x"]),
      cards: [target, dup1, dup2, dup3, unique],
    };
    const result = computeNextCards(deck, undefined, "quiz", 5);
    const targeted = result.find((r) => r.card.id === target.id);
    const distractors = targeted!.distractors!.map((s) => s.trim().toLowerCase());
    // At most one "blue" copy + at most one "green".
    expect(distractors.filter((s) => s === "blue").length).toBeLessThanOrEqual(1);
    expect(new Set(distractors).size).toBe(distractors.length);
  });

  test("low-mastery cards bubble to top in flip mode", () => {
    const deck = makeDeck(["a", "b", "c"]);
    const progress: DeckProgressType = {
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
