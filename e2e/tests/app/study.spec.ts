// Studying a deck in the drawer: flip, quiz and sprint sessions end to end.
import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { cards, dayKey, deck, seedStudy, studyData } from "./studyStacks";

const openDeck = async (page: Page, title: string, mode: "Flip" | "Quiz" | "Sprint") => {
  await page.getByRole("button", { name: new RegExp(`Study ${title}\\.`) }).click();
  await page.getByRole("button", { name: new RegExp(mode) }).click();
};

const flipAndRate = async (page: Page, rating: "✓ Got it" | "◐ Almost" | "✗ Missed") => {
  await page.getByRole("button", { name: "Card front. Press to reveal the answer." }).click();
  await page.getByRole("button", { name: rating }).click();
};

test("a flip session records mastery, the streak, the leaderboard and a first badge", async ({ page, world }) => {
  await seedStudy(world, { classDecks: [deck("d1", { title: "Cell Biology" })] });
  await page.goto(world.url("/", { forceRefreshInventory: "true" }));

  await openDeck(page, "Cell Biology", "Flip");
  await expect(page.getByText("1 of 4")).toBeVisible();
  await flipAndRate(page, "✓ Got it");
  await expect(page.getByText("2 of 4")).toBeVisible();
  await flipAndRate(page, "◐ Almost");
  await expect(page.getByText("3 of 4")).toBeVisible();
  await flipAndRate(page, "✗ Missed");
  await expect(page.getByText("4 of 4")).toBeVisible();
  await flipAndRate(page, "✓ Got it");

  await expect(page.getByRole("heading", { name: "Nice work!" })).toBeVisible();
  await expect(page.locator(".ss-end-card")).toContainText("2 / 4 correct");
  await expect(page.locator(".ss-end-card")).toContainText("(50%)");
  await expect(page.locator(".ss-end-card")).toContainText("2 mastered");
  await expect(page.getByText("You're on a 1-day streak (longest: 1)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New badges" })).toBeVisible();
  await expect(page.locator(".ss-badge-tile")).toHaveText(["First Step"]);

  const data = await studyData(world);
  const mastery = Object.fromEntries(Object.entries(data.decks.d1.cards).map(([id, c]: [string, any]) => [id, c.mastery]));
  // got_it +2, almost +0, missed -1 (never below 0); each rated card in session order.
  expect(Object.values(mastery).sort()).toEqual([0, 0, 2, 2]);
  expect(data.totalCardsStudied).toBe(4);
  expect(data.totalSessionsCompleted).toBe(1);
  expect(data.decks.d1.sessionsCompleted).toBe(1);
  expect(data.streak).toEqual({ current: 1, longest: 1, lastDay: dayKey() });

  expect((await world.assetData()).studyStacksDecks.d1.results).toEqual({ [world.profileId]: "E2E Player|1" });
  expect((await world.events("analytics")).map((e) => e.analyticName)).toEqual(["starts", "completions"]);
  expect(await world.events("grant-item")).toEqual([expect.objectContaining({ name: "First Step" })]);
  expect(await world.events("fire-toast")).toContainEqual(
    expect.objectContaining({ title: "Badge Awarded", text: "You have earned the First Step badge!" }),
  );
  expect(await world.events("particles")).toContainEqual(expect.objectContaining({ particleName: "explosion_float" }));

  await page.getByRole("button", { name: "Back to Library" }).click();
  await expect(page.getByRole("button", { name: /Study Cell Biology\. 4 cards\. Mastery 20 percent\./ })).toBeVisible();
  await page.getByRole("tab", { name: "Badges" }).click();
  await expect(page.getByRole("img", { name: "First Step" })).toHaveCSS("opacity", "1");
});

test("flip cards show the hint and the answer on the back", async ({ page, world }) => {
  await seedStudy(world, {
    classDecks: [deck("d1", { title: "Capitals", cards: [{ id: "c1", front: "France", back: "Paris", hint: "Eiffel" }] })],
  });
  await page.goto(world.url("/"));

  await openDeck(page, "Capitals", "Flip");
  await expect(page.locator(".ss-flip-card__face").first()).toHaveText("France");
  await page.getByRole("button", { name: "💡 Show hint" }).click();
  await expect(page.getByText("💡 Eiffel")).toBeVisible();
  await page.getByRole("button", { name: "Card front. Press to reveal the answer." }).click();
  await expect(page.locator(".ss-flip-card__face--back")).toHaveText("Paris");
  await expect(page.getByRole("button", { name: "✓ Got it" })).toBeVisible();
});

test("a quiz offers four distinct choices and grades the pick", async ({ page, world }) => {
  await seedStudy(world, { classDecks: [deck("d1", { title: "Numbers" })] });
  await page.goto(world.url("/"));

  await openDeck(page, "Numbers", "Quiz");
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(`Card ${i} of 4`)).toBeVisible();
    const prompt = await page.locator(".ss-quiz-prompt h3").textContent();
    const n = prompt!.replace("Question ", "");
    const options = page.getByRole("group", { name: "Answer choices" }).getByRole("button");
    await expect(options).toHaveCount(4);
    expect(new Set(await options.allTextContents()).size).toBe(4);
    if (i === 2) {
      // Pick a wrong one.
      await options.filter({ hasNotText: `Answer ${n}` }).first().click();
      await expect(page.getByRole("status").filter({ hasText: "Let's circle back" })).toContainText(`The answer was: Answer ${n}`);
    } else {
      await options.filter({ hasText: `Answer ${n}` }).click();
      await expect(page.getByText("✅ Nice!")).toBeVisible();
    }
  }

  await expect(page.locator(".ss-end-card")).toContainText("3 / 4 correct");
  const data = await studyData(world);
  // quiz: +1 right, -1 wrong (never below 0)
  expect(Object.values(data.decks.d1.cards).map((c: any) => c.mastery).sort()).toEqual([0, 1, 1, 1]);
});

test("quiz mode needs four cards with distinct answers", async ({ page, world }) => {
  await seedStudy(world, {
    classDecks: [
      deck("d1", { title: "Tiny", cards: cards(3) }),
      deck("d2", {
        title: "TrueFalse",
        cards: ["True", "False", "true", "False"].map((back, i) => ({ id: `t${i}`, front: `S${i}`, back })),
      }),
    ],
  });
  await page.goto(world.url("/"));

  await page.getByRole("button", { name: /Study Tiny\./ }).click();
  await expect(page.getByRole("button", { name: /Quiz/ })).toBeDisabled();
  await expect(page.getByText("Add at least 4 complete cards to unlock Quiz mode.")).toBeVisible();
  await page.getByLabel("Close").dispatchEvent("click");

  await page.getByRole("button", { name: /Study TrueFalse\./ }).click();
  await expect(page.getByRole("button", { name: /Quiz/ })).toBeDisabled();
  await expect(page.getByText("Add cards with more distinct back answers to unlock Quiz mode.")).toBeVisible();
});

test("ending a session early keeps what was answered", async ({ page, world }) => {
  await seedStudy(world, { classDecks: [deck("d1", { title: "Cell Biology" })] });
  await page.goto(world.url("/"));

  await openDeck(page, "Cell Biology", "Flip");
  await flipAndRate(page, "✓ Got it");
  await expect(page.getByText("2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "End session" }).click();

  await expect(page.locator(".ss-end-card")).toContainText("1 / 1 correct");
  const data = await studyData(world);
  expect(data.totalCardsStudied).toBe(1);
  expect(data.totalSessionsCompleted).toBe(1);
});

test("a sprint loops the deck for 60 seconds, then ends once", async ({ page, world }) => {
  test.fail(true, "EXP-460 #4: the sprint timer sends session/complete on every tick until the first returns");
  await seedStudy(world, {
    classDecks: [deck("d1", { title: "Cell Biology", cards: cards(2) })],
    // A realistic round trip for the many Topia calls of session/complete.
    delays: { "/visitors/42/update-data-object": 600 },
  });
  // Paused: the sprint's 60 seconds only pass when the test says so.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  const completes: string[] = [];
  page.on("request", (r) => r.url().includes("/api/session/complete") && completes.push(r.url()));
  await page.goto(world.url("/", { forceRefreshInventory: "true" }));

  await openDeck(page, "Cell Biology", "Sprint");
  await expect(page.getByLabel("60 seconds remaining")).toBeVisible();
  // Two cards: true/false questions. Answer one, then the deck loops.
  await page.getByRole("group", { name: "Answer choices" }).getByRole("button").first().click();
  await page.clock.runFor(400);
  await expect(page.getByText(/Score: [01]/)).toBeVisible();
  await page.clock.runFor(55_000);
  await expect(page.getByLabel("5 seconds remaining")).toBeVisible();
  // Time runs out; the timer keeps ticking (250ms) while session/complete is in flight.
  await page.clock.runFor(5_000);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(150);
    await page.clock.runFor(250);
  }

  await expect(page.getByRole("heading", { name: "Nice work!" })).toBeVisible();
  await expect(page.locator(".text-error")).toHaveCount(0);
  expect((await studyData(world)).totalSessionsCompleted).toBe(1);
  // Every extra request counts another completion and grants the first badge again, with its toast.
  await expect.poll(async () => (await world.events("grant-item")).length).toBeGreaterThanOrEqual(1);
  expect((await world.events("analytics")).filter((e) => e.analyticName === "completions")).toHaveLength(1);
  expect(await world.events("grant-item")).toHaveLength(1);
  expect(completes).toHaveLength(1);
});
