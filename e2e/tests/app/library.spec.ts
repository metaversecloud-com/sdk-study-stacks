// The home page: library of class and personal decks, progress and badges tabs.
import { expect, test } from "../../fixtures";
import { deck, seedStudy, userDeck } from "./studyStacks";

test("asks to open the app inside a Topia world when credentials are missing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Missing Interactive Parameters" })).toBeVisible();
});

test("greets the player and lists published class decks and their own decks", async ({ page, world }) => {
  await seedStudy(world, {
    classDecks: [deck("d1", { title: "Cell Biology" }), deck("d2", { title: "Unfinished", status: "draft" })],
    visitorData: { studyStacksDecks: { u1: userDeck("u1", { title: "My Spanish" }) } },
  });

  await page.goto(world.url("/"));

  await expect(page.getByRole("heading", { name: "Hi, E2E!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Class decks" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Study Cell Biology\. 4 cards/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Study Unfinished/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "My decks" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Study My Spanish/ })).toBeVisible();
});

test("admins also see class drafts, marked as drafts", async ({ page, world }) => {
  await seedStudy(world, { isAdmin: true, classDecks: [deck("d2", { title: "Unfinished", status: "draft" })] });

  await page.goto(world.url("/"));

  const draft = page.getByRole("button", { name: /Study Unfinished/ });
  await expect(draft).toBeVisible();
  await expect(draft).toContainText("Draft");
});

test("shows the player's mastery per deck and their level", async ({ page, world }) => {
  const d1 = deck("d1", { title: "Cell Biology" });
  await seedStudy(world, {
    classDecks: [d1],
    visitorData: {
      studyStacksData: {
        decks: {
          d1: {
            deckId: "d1",
            sessionsCompleted: 3,
            lastStudiedAt: Date.now(),
            // 2 of 4 cards fully mastered: 10 of 20 points.
            cards: {
              "d1-c1": { cardId: "d1-c1", mastery: 5, lastSeenAt: 1, timesCorrect: 5, timesWrong: 0 },
              "d1-c2": { cardId: "d1-c2", mastery: 5, lastSeenAt: 1, timesCorrect: 5, timesWrong: 0 },
            },
          },
        },
        streak: { current: 4, longest: 9, lastDay: "2020-01-01" },
        totalCardsStudied: 130,
        totalSessionsCompleted: 12,
      },
    },
  });

  await page.goto(world.url("/"));

  await expect(page.getByRole("button", { name: "Study Cell Biology. 4 cards. Mastery 50 percent." })).toContainText("Today");
  await expect(page.getByLabel("Level 2, 30 of 100 cards to next level")).toBeVisible();

  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.locator(".ss-stat-card", { hasText: "Current streak" })).toContainText("4");
  await expect(page.locator(".ss-stat-card", { hasText: "Longest streak" })).toContainText("9");
  await expect(page.locator(".ss-stat-card", { hasText: "Cards studied" })).toContainText("130");
  await expect(page.locator(".ss-stat-card", { hasText: "Sessions completed" })).toContainText("12");
  await expect(page.getByRole("listitem").filter({ hasText: "Cell Biology" })).toContainText("4 cards · 3 sessions");
});

test("a first visit initializes the player's progress record", async ({ page, world }) => {
  await seedStudy(world, { visitorData: { somethingElse: true } });

  await page.goto(world.url("/"));
  await expect(page.getByRole("heading", { name: "Hi, E2E!" })).toBeVisible();

  expect(await world.visitorData()).toEqual({
    somethingElse: true,
    studyStacksData: {
      decks: {},
      streak: { current: 0, longest: 0, lastDay: "" },
      totalCardsStudied: 0,
      totalSessionsCompleted: 0,
    },
  });
  // The class-deck map is created on the key asset.
  expect((await world.assetData()).studyStacksDecks).toEqual({});
});

test("the badges tab shows active catalog badges, earned ones in colour", async ({ page, world }) => {
  await seedStudy(world, { badges: ["First Step"] });

  // forceRefreshInventory reloads the app's process-wide catalog cache (see CATALOG).
  await page.goto(world.url("/", { forceRefreshInventory: "true" }));
  await page.getByRole("tab", { name: "Badges" }).click();

  // 11 badges in the catalog, Marathoner is retired and the pencil isn't a badge.
  await expect(page.getByText("1 / 10")).toBeVisible();
  await expect(page.getByRole("img", { name: "Marathoner" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Golden Pencil" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "First Step" })).toHaveCSS("opacity", "1");
  await expect(page.getByRole("img", { name: "Bookworm" })).toHaveCSS("opacity", "0.7");
});

test("shows an error when Topia can't load the player", async ({ page, world }) => {
  await seedStudy(world, { failures: { [`GET /api/v1/world/${world.urlSlug}/visitors/42`]: 500 } });

  const config = page.waitForResponse((r) => r.url().includes("/api/config"));
  await page.goto(world.url("/"));

  await expect(page.locator(".text-error")).toContainText("Error");
  const body = await (await config).text();
  expect(body).not.toContain("interactiveSecret");
  expect(body).not.toContain("InteractiveJWT");
});
