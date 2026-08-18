import { evaluateBadges } from "../utils/evaluateBadges.js";
import { STUDY_STACK_BADGES, DeckType, VisitorStudyDataType } from "@shared/types/StudyStacksTypes.js";

jest.mock("../utils/awardBadge.js", () => ({
  awardBadge: jest.fn(async ({ badgeName }: { badgeName: string }) => {
    (jest.requireMock("../utils/awardBadge.js") as any).__calls.push(badgeName);
    return "granted";
  }),
}));

const awardBadgeMock = jest.requireMock("../utils/awardBadge.js") as any;

const baseCreds = { urlSlug: "w", sceneDropId: "s" } as any;
const visitor = {};
const visitorInventory = {};

const makeData = (overrides: Partial<VisitorStudyDataType> = {}): VisitorStudyDataType => ({
  decks: {},
  streak: { current: 0, longest: 0, lastDay: "" },
  totalCardsStudied: 0,
  totalSessionsCompleted: 0,
  ...overrides,
});

const makeDeck = (id: string, subject: DeckType["subject"], cardIds: string[]): DeckType => ({
  id,
  scope: "class",
  title: id,
  subject,
  grades: ["5"],
  difficulty: "easy",
  status: "published",
  cards: cardIds.map((cid) => ({ id: cid, front: "f", back: "b" })),
  createdByProfileId: "p",
  createdByDisplayName: "T",
});

const masteredProgress = (cardIds: string[]) => ({
  deckId: "x",
  cards: Object.fromEntries(
    cardIds.map((id) => [id, { cardId: id, mastery: 5 as const, lastSeenAt: 0, timesCorrect: 5, timesWrong: 0 }]),
  ),
  sessionsCompleted: 1,
  lastStudiedAt: 0,
});

beforeEach(() => {
  awardBadgeMock.__calls = [];
});

test("First Step on first completed session", async () => {
  const after = makeData({ totalSessionsCompleted: 1 });
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: after,
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 5,
    sessionTotal: 10,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.FIRST_STEP);
});

test("Bookworm at 50 cards, not at 49", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1, totalCardsStudied: 49 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).not.toContain(STUDY_STACK_BADGES.BOOKWORM);

  awardBadgeMock.__calls = [];
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1, totalCardsStudied: 50 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.BOOKWORM);
});

test("Scholar and Master tiers", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1, totalCardsStudied: 1000 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toEqual(
    expect.arrayContaining([STUDY_STACK_BADGES.BOOKWORM, STUDY_STACK_BADGES.SCHOLAR, STUDY_STACK_BADGES.MASTER]),
  );
});

test("Streaker at 7-day, Marathoner at 30-day", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1, streak: { current: 7, longest: 7, lastDay: "x" } }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.STREAKER);
  expect(awardBadgeMock.__calls).not.toContain(STUDY_STACK_BADGES.MARATHONER);

  awardBadgeMock.__calls = [];
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1, streak: { current: 30, longest: 30, lastDay: "x" } }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.MARATHONER);
});

test("Deck Done when every card in deck is mastered", async () => {
  const deck = makeDeck("d1", "math", ["a", "b"]);
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({
      totalSessionsCompleted: 1,
      decks: { d1: masteredProgress(["a", "b"]) },
    }),
    studyDataBefore: makeData(),
    decks: { d1: deck },
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.DECK_DONE);
});

test("Polyglot at 3 mastered subjects", async () => {
  const decks = {
    d1: makeDeck("d1", "math", ["a"]),
    d2: makeDeck("d2", "ela", ["a"]),
    d3: makeDeck("d3", "science", ["a"]),
  };
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({
      totalSessionsCompleted: 1,
      decks: {
        d1: masteredProgress(["a"]),
        d2: masteredProgress(["a"]),
        d3: masteredProgress(["a"]),
      },
    }),
    studyDataBefore: makeData(),
    decks,
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.POLYGLOT);
});

test("Speed Demon at sprint 20+", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "sprint",
    sessionCorrect: 20,
    sessionTotal: 25,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.SPEED_DEMON);
});

test("Perfectionist only on Quiz 100% with 10+", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "quiz",
    sessionCorrect: 10,
    sessionTotal: 10,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.PERFECTIONIST);

  awardBadgeMock.__calls = [];
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "quiz",
    sessionCorrect: 9,
    sessionTotal: 9,
    comebackTransitions: false,
  });
  expect(awardBadgeMock.__calls).not.toContain(STUDY_STACK_BADGES.PERFECTIONIST);
});

test("Comeback Kid only when transitions observed", async () => {
  await evaluateBadges({
    credentials: baseCreds,
    visitor,
    visitorInventory,
    studyDataAfter: makeData({ totalSessionsCompleted: 1 }),
    studyDataBefore: makeData(),
    decks: {},
    sessionMode: "flip",
    sessionCorrect: 0,
    sessionTotal: 0,
    comebackTransitions: true,
  });
  expect(awardBadgeMock.__calls).toContain(STUDY_STACK_BADGES.COMEBACK_KID);
});
