import { Card, CardMastery, Deck, DeckProgress, isCardComplete, StudyMode } from "@shared/types/StudyStacksTypes.js";

export const defaultMastery = (cardId: string): CardMastery => ({
  cardId,
  mastery: 0,
  lastSeenAt: 0,
  timesCorrect: 0,
  timesWrong: 0,
});

export const recencyPenalty = (lastSeenAt: number, now: number = Date.now()): number => {
  if (!lastSeenAt) return 2;
  const days = (now - lastSeenAt) / 86_400_000;
  return Math.min(2, Math.max(0, days / 3));
};

export const priority = (m: CardMastery, now: number = Date.now()): number => {
  return (5 - m.mastery) * 2 + m.timesWrong + recencyPenalty(m.lastSeenAt, now);
};

const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export interface ComputedCard {
  card: Card;
  distractors?: string[];
}

/**
 * Pick the next N cards for a session. For sprint, just shuffles the full deck.
 * For quiz, also assembles 3 distractor `back` strings per card.
 */
export const computeNextCards = (
  deck: Deck,
  progress: DeckProgress | undefined,
  mode: StudyMode,
  sessionSize: number,
  now: number = Date.now(),
): ComputedCard[] => {
  const cards = deck.cards.filter(isCardComplete);
  if (cards.length === 0) return [];

  let chosen: Card[];
  if (mode === "sprint") {
    chosen = shuffle(cards);
  } else {
    const ranked = cards
      .map((c) => {
        const m = progress?.cards[c.id] ?? defaultMastery(c.id);
        return { card: c, score: priority(m, now) };
      })
      .sort((a, b) => b.score - a.score);
    chosen = ranked.slice(0, sessionSize).map((r) => r.card);
  }

  if (mode !== "quiz" && mode !== "sprint") {
    return chosen.map((card) => ({ card }));
  }

  return chosen.map((card) => {
    // Build a distractor pool from other cards' `back` strings, deduped two
    // ways to avoid the player ever seeing duplicate options:
    //   1. Skip any sibling whose back matches the current card's correct
    //      answer (case-insensitive, trimmed). Without this, a deck like
    //      `"4+4" → "8"` and `"2+6" → "8"` would offer two visually
    //      identical "8" options — clicking the distractor copy would be
    //      marked wrong even though the text was correct.
    //   2. Drop any later siblings that collide with each other so the
    //      pool never contains two equivalent distractors either.
    const normalize = (s: string) => s.trim().toLowerCase();
    const correctNorm = normalize(card.back);
    const seen = new Set<string>([correctNorm]);
    const pool: string[] = [];
    for (const c of cards) {
      if (c.id === card.id) continue;
      const n = normalize(c.back);
      if (seen.has(n)) continue;
      seen.add(n);
      pool.push(c.back);
    }
    const distractors = shuffle(pool).slice(0, 3);
    return { card, distractors };
  });
};
