// Study session rules through the API: card selection, mastery, streaks, badges, leaderboard, and
// what a player can get away with.
import { forgeDisplayName } from "../../helpers/leaderboardForgery";
import { expect, test } from "../../fixtures";
import { answer, cards, complete, dayKey, deck, seedStudy, startSession, studyData, userDeck } from "./studyStacks";

const mastered = (id: string, mastery: number, lastSeenAt = Date.now()) => ({
  cardId: id,
  mastery,
  lastSeenAt,
  timesCorrect: mastery,
  timesWrong: 0,
});

const progress = (deckId: string, cardMastery: Record<string, number>, extra: Record<string, unknown> = {}) => ({
  decks: {
    [deckId]: {
      deckId,
      sessionsCompleted: 0,
      lastStudiedAt: 0,
      cards: Object.fromEntries(Object.entries(cardMastery).map(([id, m]) => [id, mastered(id, m)])),
    },
  },
  streak: { current: 0, longest: 0, lastDay: "" },
  totalCardsStudied: 0,
  totalSessionsCompleted: 0,
  ...extra,
});

const grantedBadges = async (world: { events: (t: string) => Promise<any[]> }) =>
  (await world.events("grant-item")).map((e) => e.name).sort();

test.describe("starting a session", () => {
  test("flip sessions pick the 12 weakest cards, quiz sessions 10 with three distinct wrong answers", async ({
    request,
    world,
  }) => {
    const deckCards = cards(15);
    // The deck repeats one answer: it's never offered as a wrong choice for a card it answers.
    deckCards[1].back = "Answer 1";
    await seedStudy(world, {
      classDecks: [deck("d1", { cards: deckCards })],
      visitorData: { studyStacksData: progress("d1", { c1: 5, c2: 5, c3: 5, c4: 4 }) },
    });

    const flip = (await startSession(request, world, { deckId: "d1", mode: "flip" })).json;
    expect(flip.cards).toHaveLength(12);
    expect(flip.cards.map((c: any) => c.id).filter((id: string) => ["c1", "c2", "c3"].includes(id))).toEqual([]);
    expect(flip.cards[0]).not.toHaveProperty("distractors");

    const quiz = (await startSession(request, world, { deckId: "d1", mode: "quiz" })).json;
    expect(quiz.cards).toHaveLength(10);
    for (const card of quiz.cards) {
      expect(card.distractors).toHaveLength(3);
      expect(new Set(card.distractors).size).toBe(3);
      expect(card.distractors.map((d: string) => d.toLowerCase())).not.toContain(card.back.toLowerCase());
    }
    expect(await world.events("analytics")).toEqual([
      expect.objectContaining({ analyticName: "starts", profileId: world.profileId }),
      expect.objectContaining({ analyticName: "starts", profileId: world.profileId }),
    ]);
  });

  test("sprints shuffle the whole deck", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1", { cards: cards(30) })] });

    const sprint = (await startSession(request, world, { deckId: "d1", mode: "sprint" })).json;

    expect(sprint.cards.map((c: any) => c.id).sort()).toEqual(cards(30).map((c) => c.id).sort());
  });

  test("rejects bad requests", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1")] });

    const start = (data: Record<string, unknown>) => request.post(world.api("/session/start"), { data });
    expect((await start({ mode: "flip", scope: "class" })).status()).toBe(400);
    expect((await start({ deckId: "d1", mode: "cram", scope: "class" })).status()).toBe(400);
    expect((await start({ deckId: "d1", mode: "flip", scope: "world" })).status()).toBe(400);
    expect((await start({ deckId: "nope", mode: "flip", scope: "class" })).status()).toBe(404);
    // A class deck isn't one of the player's own decks.
    expect((await start({ deckId: "d1", mode: "flip", scope: "user" })).status()).toBe(404);
  });

  test("a player studies their own deck, without a class leaderboard", async ({ request, world }) => {
    await seedStudy(world, { visitorData: { studyStacksDecks: { u1: userDeck("u1", { status: "draft" }) } } });

    const { json } = await startSession(request, world, { deckId: "u1", mode: "flip", scope: "user" });
    await answer(request, world, { sessionId: json.sessionId, cardId: json.cards[0].id, mode: "flip", rating: "got_it" });
    expect((await complete(request, world, json.sessionId)).status()).toBe(200);

    const data = await studyData(world);
    expect(data.decks.u1.sessionsCompleted).toBe(1);
    expect(data.decks.u1.cards[json.cards[0].id].mastery).toBe(2);
    expect((await world.assetData()).studyStacksDecks).toEqual({});
  });
});

test.describe("answering", () => {
  test("mastery moves by mode and stays between 0 and 5", async ({ request, world }) => {
    const deckCards = cards(6);
    await seedStudy(world, {
      classDecks: [deck("d1", { cards: deckCards })],
      // c1 maxed, c2 at zero.
      visitorData: { studyStacksData: progress("d1", { c1: 5, c2: 0, c3: 3, c4: 3, c5: 3, c6: 3 }) },
    });
    const cases: Array<[string, Record<string, unknown>, string, number]> = [
      ["flip", { rating: "got_it" }, "c1", 5],
      ["flip", { rating: "missed" }, "c2", 0],
      ["flip", { rating: "almost" }, "c3", 3],
      ["quiz", { isCorrect: false }, "c4", 2],
      ["sprint", { isCorrect: false }, "c5", 3],
      ["sprint", { isCorrect: true }, "c6", 4],
    ];
    for (const [mode, data, cardId, expected] of cases) {
      const { json } = await startSession(request, world, { deckId: "d1", mode });
      const response = await answer(request, world, { sessionId: json.sessionId, cardId, mode, ...data });
      expect(await response.json(), `${mode} ${JSON.stringify(data)} on ${cardId}`).toEqual({
        success: true,
        masteryAfter: expected,
      });
    }

    const after = (await studyData(world)).decks.d1.cards;
    expect(after.c1).toMatchObject({ mastery: 5, timesCorrect: 6, timesWrong: 0 });
    expect(after.c2).toMatchObject({ mastery: 0, timesCorrect: 0, timesWrong: 1 });
    expect(after.c5).toMatchObject({ mastery: 3, timesWrong: 1 });
    expect((await studyData(world)).totalCardsStudied).toBe(6);
  });

  test("rejects answers that don't fit the session", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1")] });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "quiz" });
    const cardId = json.cards[0].id;
    const post = (data: Record<string, unknown>) => answer(request, world, { sessionId: json.sessionId, cardId, ...data });

    expect((await answer(request, world, { sessionId: "s_nope", cardId, mode: "quiz", isCorrect: true })).status()).toBe(404);
    expect((await post({ cardId: "other-deck-card", mode: "quiz", isCorrect: true })).status()).toBe(400);
    expect((await post({ mode: "quiz" })).status()).toBe(400);
    expect((await post({ mode: "flip" })).status()).toBe(400);
    expect((await post({ mode: "cram", isCorrect: true })).status()).toBe(400);
    expect((await post({ mode: "quiz", isCorrect: "yes" })).status()).toBe(400);
    expect((await studyData(world)).totalCardsStudied).toBe(0);
  });

  test("answers sent while the previous one is still saving all count", async ({ request, world }) => {
    test.fail(true, "EXP-460 #3: concurrent answers overwrite each other's progress");
    await seedStudy(world, {
      classDecks: [deck("d1")],
      // The client fires answers without waiting; the save of the first is still in flight.
      delays: { "/visitors/42/update-data-object": 400 },
    });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });
    const [first, second] = json.cards;

    const responses = await Promise.all([
      answer(request, world, { sessionId: json.sessionId, cardId: first.id, mode: "flip", rating: "got_it" }),
      answer(request, world, { sessionId: json.sessionId, cardId: second.id, mode: "flip", rating: "got_it" }),
    ]);
    expect(responses.map((r) => r.status())).toEqual([200, 200]);

    const data = await studyData(world);
    expect(data.totalCardsStudied).toBe(2);
    expect(Object.keys(data.decks.d1.cards).sort()).toEqual([first.id, second.id].sort());
  });

  test("a card can't be answered again and again in a quiz", async ({ request, world }) => {
    test.fail(true, "EXP-460 #5: the server accepts any number of answers per card, so badges can be farmed");
    await seedStudy(world, { classDecks: [deck("d1")] });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "quiz" });
    const cardId = json.cards[0].id;

    // Ten correct answers to a 4-card quiz: Perfectionist needs a 10-question quiz without a miss.
    for (let i = 0; i < 10; i++) await answer(request, world, { sessionId: json.sessionId, cardId, mode: "quiz", isCorrect: true });
    await complete(request, world, json.sessionId);

    expect(await grantedBadges(world)).not.toContain("Perfectionist");
    expect((await studyData(world)).totalCardsStudied).toBeLessThanOrEqual(4);
  });

  test("a player can't answer or finish another player's session", async ({ request, world }) => {
    test.fail(true, "EXP-460 #6: sessions aren't tied to the player who started them");
    await seedStudy(world, { classDecks: [deck("d1")], otherVisitors: { 43: {} } });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });

    const theirs = await answer(request, world, { sessionId: json.sessionId, cardId: json.cards[0].id, mode: "flip", rating: "missed" }, 43);
    const finish = await complete(request, world, json.sessionId, 43);

    expect(theirs.ok()).toBe(false);
    expect(finish.ok()).toBe(false);
    // The owner can still finish their own session.
    expect((await complete(request, world, json.sessionId)).status()).toBe(200);
  });
});

test.describe("completing", () => {
  test("streaks grow on consecutive days and reset after a gap", async ({ request, world }) => {
    const run = async (streak: Record<string, unknown>) => {
      await seedStudy(world, {
        classDecks: [deck("d1")],
        visitorData: { studyStacksData: progress("d1", {}, { streak }) },
      });
      const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });
      const response = await (await complete(request, world, json.sessionId)).json();
      return response.summary.streakAfter;
    };

    expect(await run({ current: 3, longest: 3, lastDay: dayKey(-1) })).toEqual({ current: 4, longest: 4 });
    expect(await run({ current: 3, longest: 8, lastDay: dayKey(-3) })).toEqual({ current: 1, longest: 8 });
    expect(await run({ current: 3, longest: 3, lastDay: dayKey() })).toEqual({ current: 3, longest: 3 });
    expect((await studyData(world)).streak.lastDay).toBe(dayKey());
  });

  test("grants the badges a session earns, once", async ({ request, world }) => {
    const d1 = deck("d1", { cards: cards(4) });
    await seedStudy(world, {
      classDecks: [d1],
      badges: ["First Step"],
      visitorData: {
        studyStacksData: progress(
          "d1",
          { c1: 5, c2: 5, c3: 5, c4: 1 },
          { streak: { current: 6, longest: 6, lastDay: dayKey(-1) }, totalCardsStudied: 49, totalSessionsCompleted: 3 },
        ),
      },
    });

    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });
    // c4 goes from 1 to 5 in one session (got it twice, +2 each): Deck Done and Comeback Kid.
    for (let i = 0; i < 2; i++)
      await answer(request, world, { sessionId: json.sessionId, cardId: "c4", mode: "flip", rating: "got_it" });
    const response = await (await complete(request, world, json.sessionId)).json();

    // First Step is already owned; Bookworm at 50 cards, Streaker at 7 days, Deck Done, Comeback Kid.
    expect(response.summary.newBadges.sort()).toEqual(["Bookworm", "Comeback Kid", "Deck Done", "Streaker"]);
    expect(await grantedBadges(world)).toEqual(["Bookworm", "Comeback Kid", "Deck Done", "Streaker"]);
    expect(Object.keys(response.visitorInventory).sort()).toEqual(
      ["Bookworm", "Comeback Kid", "Deck Done", "First Step", "Streaker"].sort(),
    );
    expect((await world.events("fire-toast")).map((t) => t.text).sort()).toEqual([
      "You have earned the Bookworm badge!",
      "You have earned the Comeback Kid badge!",
      "You have earned the Deck Done badge!",
      "You have earned the Streaker badge!",
    ]);
  });

  test("a retired badge is never granted", async ({ request, world }) => {
    await seedStudy(world, {
      classDecks: [deck("d1")],
      badges: ["First Step", "Streaker"],
      visitorData: {
        studyStacksData: progress("d1", {}, { streak: { current: 29, longest: 29, lastDay: dayKey(-1) } }),
      },
    });

    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });
    const response = await (await complete(request, world, json.sessionId)).json();

    expect(response.summary.streakAfter.current).toBe(30);
    // Marathoner (30 days) is INACTIVE in the catalog.
    expect(response.summary.newBadges).toEqual([]);
    expect(await world.events("grant-item")).toEqual([]);
  });

  test("Perfectionist for a flawless 10-card quiz, Speed Demon for 20 right in a sprint", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1", { cards: cards(10) })], badges: ["First Step"] });

    const quiz = (await startSession(request, world, { deckId: "d1", mode: "quiz" })).json;
    for (const card of quiz.cards)
      await answer(request, world, { sessionId: quiz.sessionId, cardId: card.id, mode: "quiz", isCorrect: true });
    expect((await (await complete(request, world, quiz.sessionId)).json()).summary.newBadges).toEqual(["Perfectionist"]);

    // A sprint loops the deck, so the same card comes back.
    const sprint = (await startSession(request, world, { deckId: "d1", mode: "sprint" })).json;
    for (let i = 0; i < 20; i++)
      await answer(request, world, {
        sessionId: sprint.sessionId,
        cardId: sprint.cards[i % 10].id,
        mode: "sprint",
        isCorrect: true,
      });
    expect((await (await complete(request, world, sprint.sessionId)).json()).summary.newBadges).toEqual(["Speed Demon"]);
  });

  test("a finished session can't be completed again", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1")] });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });

    expect((await complete(request, world, json.sessionId)).status()).toBe(200);
    expect((await complete(request, world, json.sessionId)).status()).toBe(404);
    expect((await answer(request, world, { sessionId: json.sessionId, cardId: json.cards[0].id, mode: "flip", rating: "got_it" })).status()).toBe(404);
    expect((await studyData(world)).totalSessionsCompleted).toBe(1);
  });

  test("a display name can't forge a leaderboard entry", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d1")] });
    const forged = await forgeDisplayName(world, [999999]);
    await request.get(world.api("/config", forged));
    const response = await request.post(world.api("/session/start", forged), {
      data: { deckId: "d1", scope: "class", mode: "flip" },
    });
    const { sessionId } = await response.json();

    await request.post(world.api("/session/complete", forged), { data: { sessionId } });

    expect((await world.assetData()).studyStacksDecks.d1.results).toEqual({ [world.profileId]: "Mallory999999|1" });
  });

  test("a failed badge grant doesn't count the session twice when the player retries", async ({ request, world }) => {
    test.fail(true, "EXP-460 #7: progress is saved before badges are granted; a failed grant leaves the session open");
    await seedStudy(world, { classDecks: [deck("d1")], failures: { "grant-visitor-inventory-item": 500 } });
    const { json } = await startSession(request, world, { deckId: "d1", mode: "flip" });

    await complete(request, world, json.sessionId);
    // Topia recovers and the player retries.
    const saved = await studyData(world);
    await seedStudy(world, {
      classDecks: [(await world.assetData()).studyStacksDecks.d1],
      visitorData: { studyStacksData: saved },
    });
    await complete(request, world, json.sessionId);

    expect((await studyData(world)).totalSessionsCompleted).toBe(1);
  });
});
