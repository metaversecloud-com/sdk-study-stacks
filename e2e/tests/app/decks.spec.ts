// Creating, editing and deleting decks: personal decks on the visitor, class decks on the key asset
// (admins only).
import { expect, test } from "../../fixtures";
import type { Page } from "@playwright/test";
import { cards, deck, seedStudy, userDeck } from "./studyStacks";

// The deck modal's Edit / Delete / Analytics controls are links whose only content is a CDN icon, which
// the tests block, so they have no size to click on.
const iconButton = (page: Page, title: string) => page.getByTitle(title).dispatchEvent("click");

test.describe("personal decks", () => {
  test("a player creates a personal deck in the editor", async ({ page, world }) => {
    await seedStudy(world);
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: "+ Create a new deck" }).click();
    await expect(page.getByRole("heading", { name: "New deck" })).toBeVisible();
    // Students don't get the class-deck option.
    await expect(page.getByText("Make available to all students")).toHaveCount(0);
    await page.getByLabel("Title").fill("Capitals");
    await page.getByLabel("Subject").selectOption("history");
    await page.getByRole("button", { name: "Continue to cards step" }).click();
    await page.getByRole("button", { name: "+ Add card" }).click();
    await page.getByLabel("Front", { exact: true }).fill("France");
    await page.getByRole("textbox", { name: "Back" }).fill("Paris");
    await page.getByLabel("Hint").fill("Eiffel");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: /Study Capitals\. 1 cards/ })).toBeVisible();
    const saved = Object.values((await world.visitorData()).studyStacksDecks) as any[];
    expect(saved).toEqual([
      {
        id: expect.stringMatching(/^d_/),
        scope: "user",
        title: "Capitals",
        subject: "history",
        difficulty: "medium",
        status: "published",
        cards: [{ id: expect.any(String), front: "France", back: "Paris", hint: "Eiffel" }],
      },
    ]);
    // Nothing lands on the shared key asset.
    expect((await world.assetData()).studyStacksDecks).toEqual({});
  });

  test("the editor refuses to save a deck with an empty card", async ({ page, world }) => {
    await seedStudy(world);
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: "+ Create a new deck" }).click();
    await page.getByLabel("Title").fill("Half done");
    await page.getByRole("button", { name: "Continue to cards step" }).click();
    await page.getByRole("button", { name: "+ Add card" }).click();
    await page.getByRole("button", { name: "+ Add card" }).click();
    await page.getByLabel("Front", { exact: true }).first().fill("Q");
    await page.getByRole("textbox", { name: "Back" }).first().fill("A");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("alert")).toContainText("1 card is empty");
    expect((await world.visitorData()).studyStacksDecks).toBeUndefined();
  });

  test("a player deletes their own deck", async ({ page, world }) => {
    await seedStudy(world, { visitorData: { studyStacksDecks: { u1: userDeck("u1", { title: "Old notes" }) } } });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: /Study Old notes/ }).click();
    await iconButton(page, "Delete");
    await page.getByRole("button", { name: "Yes" }).click();

    await expect(page.getByRole("button", { name: /Study Old notes/ })).toHaveCount(0);
    expect((await world.visitorData()).studyStacksDecks).toEqual({ u1: null });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Hi, E2E!" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Study Old notes/ })).toHaveCount(0);
  });

  test("the server validates decks: title, card count, empty cards, image URLs", async ({ request, world }) => {
    await seedStudy(world);
    const save = (deckData: Record<string, unknown>) =>
      request.post(world.api("/decks"), { data: { scope: "user", deck: deckData } });

    expect(await (await save({ title: " ", cards: cards(1) })).json()).toMatchObject({ message: "Title is required." });
    expect(await (await save({ title: "T", cards: [] })).json()).toMatchObject({
      message: "Add at least one card before saving.",
    });
    expect(await (await save({ title: "T", cards: cards(101) })).json()).toMatchObject({
      message: "Decks are limited to 100 cards.",
    });
    expect(await (await save({ title: "T", cards: [{ front: "Q", back: " " }] })).json()).toMatchObject({
      message: expect.stringContaining("1 card is empty"),
    });

    const response = await save({
      id: "u9",
      title: "x".repeat(200),
      subject: "astrology",
      difficulty: "insane",
      status: "secret",
      grades: ["5"],
      createdByProfileId: "someone",
      cards: [
        { id: "a", front: "Q1", back: "A1", imageUrl: "javascript:alert(1)" },
        { id: "b", front: "", back: "A2", imageUrl: "https://example.com/pic.png" },
      ],
    });
    expect(response.status()).toBe(200);
    expect((await world.visitorData()).studyStacksDecks.u9).toEqual({
      id: "u9",
      scope: "user",
      title: "x".repeat(120),
      subject: "other",
      difficulty: "medium",
      status: "draft",
      cards: [
        { id: "a", front: "Q1", back: "A1" },
        { id: "b", front: "", back: "A2", imageUrl: "https://example.com/pic.png" },
      ],
    });
  });

  test("a deck id can't write outside its own slot in the data object", async ({ request, world }) => {
    test.fail(true, "EXP-460 #8: deck ids are used unescaped in data-object paths");
    await seedStudy(world, { visitorData: { studyStacksDecks: { u1: userDeck("u1") } } });

    // A dotted id becomes a nested path: the deck lands inside u1 instead of in a slot of its own.
    await request.post(world.api("/decks"), {
      data: { scope: "user", deck: { id: "u1.cards", title: "Sneaky", cards: cards(1) } },
    });

    expect((await world.visitorData()).studyStacksDecks.u1).toEqual(userDeck("u1"));
  });
});

test.describe("class decks", () => {
  test("an admin publishes a class deck for every student", async ({ page, world }) => {
    await seedStudy(world, { isAdmin: true });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: "+ Create a new deck" }).click();
    await page.getByLabel("Title").fill("Fractions");
    await page.getByLabel("Subject").selectOption("math");
    await page.getByText("Make available to all students (Class deck)").click();
    await page.getByText("All grades").click();
    await page.getByRole("button", { name: "Continue to cards step" }).click();
    await page.getByRole("button", { name: "+ Add card" }).click();
    await page.getByLabel("Front", { exact: true }).fill("1/2 + 1/4");
    await page.getByRole("textbox", { name: "Back" }).fill("3/4");
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByRole("heading", { name: "Class decks" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Study Fractions/ })).toBeVisible();
    const saved = Object.values((await world.assetData()).studyStacksDecks) as any[];
    expect(saved).toEqual([
      expect.objectContaining({
        scope: "class",
        title: "Fractions",
        subject: "math",
        status: "published",
        grades: "all",
        createdByProfileId: world.profileId,
        createdByDisplayName: "E2E Player",
      }),
    ]);
  });

  test("an admin saves a draft that students don't see", async ({ page, world }) => {
    await seedStudy(world, { isAdmin: true, otherVisitors: { 43: {} } });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: "+ Create a new deck" }).click();
    await page.getByLabel("Title").fill("Next week");
    await page.getByText("Make available to all students (Class deck)").click();
    await page.getByText("All grades").click();
    await page.getByRole("button", { name: "Continue to cards step" }).click();
    await page.getByRole("button", { name: "+ Add card" }).click();
    await page.getByLabel("Front", { exact: true }).fill("Q");
    await page.getByRole("textbox", { name: "Back" }).fill("A");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: /Study Next week/ })).toContainText("Draft");

    await page.goto(world.url("/", world.as(43)));
    await expect(page.getByRole("heading", { name: "Hi, Player!" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Study Next week/ })).toHaveCount(0);
  });

  test("students can't create, edit or delete class decks", async ({ page, request, world }) => {
    const d1 = deck("d1", { title: "Cell Biology" });
    await seedStudy(world, { classDecks: [d1] });

    const save = await request.post(world.api("/decks"), {
      data: { scope: "class", deck: { ...d1, title: "Hacked" } },
    });
    expect(save.status()).toBe(403);
    const remove = await request.delete(world.api("/decks/d1", { scope: "class" }));
    expect(remove.status()).toBe(403);
    expect((await world.assetData()).studyStacksDecks).toEqual({ d1 });

    await page.goto(world.url("/"));
    await page.getByRole("button", { name: /Study Cell Biology/ }).click();
    await expect(page.getByRole("heading", { name: "Choose a study mode" })).toBeVisible();
    await expect(page.getByTitle("Edit")).toHaveCount(0);
    await expect(page.getByTitle("Delete")).toHaveCount(0);
    await expect(page.getByTitle("Analytics")).toHaveCount(0);
  });

  test("students can't open or study a class draft through the API", async ({ request, world }) => {
    await seedStudy(world, { classDecks: [deck("d2", { status: "draft" })] });

    expect((await request.get(world.api("/decks/d2"))).status()).toBe(404);
    const start = await request.post(world.api("/session/start"), { data: { deckId: "d2", scope: "class", mode: "flip" } });
    expect(start.status()).toBe(404);
  });

  test("an admin deletes a class deck", async ({ page, world }) => {
    await seedStudy(world, { isAdmin: true, classDecks: [deck("d1", { title: "Cell Biology" })] });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: /Study Cell Biology/ }).click();
    await iconButton(page, "Delete");
    await page.getByRole("button", { name: "Yes" }).click();

    await expect(page.getByRole("button", { name: /Study Cell Biology/ })).toHaveCount(0);
    expect((await world.assetData()).studyStacksDecks).toEqual({ d1: null });
  });

  test("the admin results view lists students by sessions, escaping their names", async ({ page, world }) => {
    await seedStudy(world, {
      isAdmin: true,
      classDecks: [
        deck("d1", {
          title: "Cell Biology",
          results: { p1: "Ana|3", p2: "<b>Bo</b>|7" },
        }),
      ],
    });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: /Study Cell Biology/ }).click();
    const popupPromise = page.waitForEvent("popup");
    await iconButton(page, "Analytics");
    const popup = await popupPromise;

    await expect(popup.getByRole("heading", { name: "Study Stacks Results · Cell Biology" })).toBeVisible();
    const rows = popup.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("<b>Bo</b>");
    await expect(rows.nth(0)).toContainText("7");
    await expect(rows.nth(1)).toContainText("Ana");
  });

  test("editing a class deck keeps its leaderboard", async ({ page, world }) => {
    test.fail(true, "EXP-460 #2: saving a class deck drops its results");
    const results = { p1: "Ana|3", p2: "Bo|7" };
    await seedStudy(world, { isAdmin: true, classDecks: [deck("d1", { title: "Cell Biology", results })] });
    await page.goto(world.url("/"));

    await page.getByRole("button", { name: /Study Cell Biology/ }).click();
    await iconButton(page, "Edit");
    await page.getByLabel("Title").fill("Cell Biology II");
    await page.getByRole("button", { name: "Continue to cards step" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("button", { name: /Study Cell Biology II/ })).toBeVisible();

    const saved = (await world.assetData()).studyStacksDecks.d1;
    expect(saved.title).toBe("Cell Biology II");
    expect(saved.results).toEqual(results);
  });

  test("students don't receive other students' results", async ({ request, world }) => {
    test.fail(true, "EXP-460 #1: class decks carry the leaderboard to every student");
    await seedStudy(world, { classDecks: [deck("d1", { results: { p1: "Ana Lopez|3", p2: "Bo Chen|7" } })] });

    const config = await (await request.get(world.api("/config"))).json();
    const one = await (await request.get(world.api("/decks/d1"))).json();

    expect(config.isAdmin).toBe(false);
    expect(JSON.stringify(config)).not.toContain("Ana Lopez");
    expect(JSON.stringify(one)).not.toContain("Ana Lopez");
  });
});
