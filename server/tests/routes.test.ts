import express from "express";
import request from "supertest";

import router from "../routes.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

const baseCreds = {
  assetId: "asset-123",
  interactivePublicKey: process.env.INTERACTIVE_KEY,
  interactiveNonce: "nonce-xyz",
  visitorId: 1,
  urlSlug: "my-world",
  sceneDropId: "scene-1",
  profileId: "profile-1",
  displayName: "Lina",
};

// Mock all server utils that controllers depend on.
jest.mock("@utils/index.js", () => ({
  errorHandler: jest.fn(({ res, message }: any) => {
    if (res) return res.status(500).json({ success: false, message });
    return { success: false };
  }),
  getCredentials: jest.fn(),
  getVisitor: jest.fn(),
  getBadges: jest.fn(),
  evaluateBadges: jest.fn(),
  computeNextCards: jest.fn(),
  createSession: jest.fn(),
  getSession: jest.fn(),
  deleteSession: jest.fn(),
  applyDailyStreak: jest.fn(),
  dateKey: jest.fn(),
  STUDY_STACKS_DATA_KEY: "studyStacksData",
  normalizeStudyData: jest.fn((raw: any) => ({
    decks: (raw && typeof raw === "object" && raw.decks) || {},
    streak: {
      current: raw?.streak?.current ?? 0,
      longest: raw?.streak?.longest ?? 0,
      lastDay: raw?.streak?.lastDay ?? "",
    },
    totalCardsStudied: raw?.totalCardsStudied ?? 0,
    totalSessionsCompleted: raw?.totalSessionsCompleted ?? 0,
  })),
  fetchClassDecks: jest.fn(),
  fetchUserDecks: jest.fn(),
  updateDeckResult: jest.fn(),
  findDeck: jest.fn(),
  buildDeckFromInput: jest.fn(),
  persistDeck: jest.fn(),
  deleteDeck: jest.fn(),
}));

const mockUtils = jest.mocked(require("@utils/index.js"));

beforeEach(() => {
  jest.clearAllMocks();
  mockUtils.getCredentials.mockReturnValue(baseCreds);
});

describe("GET /system/health", () => {
  test("returns status OK", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/system/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
  });
});

describe("GET /config", () => {
  test("returns class + user decks; hides class drafts from students", async () => {
    mockUtils.getVisitor.mockResolvedValue({
      visitor: {
        isAdmin: false,
        dataObject: {
          studyStacksData: {
            decks: {},
            streak: { current: 1, longest: 1, lastDay: "2026-05-20" },
            totalCardsStudied: 5,
            totalSessionsCompleted: 1,
          },
        },
      },
      visitorInventory: {},
    });
    mockUtils.getBadges.mockResolvedValue({ FirstStep: { id: "", name: "FirstStep", icon: "", description: "" } });
    mockUtils.fetchClassDecks.mockResolvedValue({
      d1: { id: "d1", scope: "class", title: "Pub", status: "published", cards: [] },
      d2: { id: "d2", scope: "class", title: "Draft", status: "draft", cards: [] },
    });
    mockUtils.fetchUserDecks.mockResolvedValue({
      u1: {
        id: "u1",
        scope: "user",
        title: "My deck",
        status: "draft",
        cards: [],
      },
    });

    const app = makeApp();
    const res = await request(app).get("/api/config").query(baseCreds);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.classDecks).toHaveLength(1); // draft hidden from student
    expect(res.body.classDecks[0].id).toBe("d1");
    expect(res.body.userDecks).toHaveLength(1); // student sees their own draft
    expect(res.body.userDecks[0].id).toBe("u1");
    expect(res.body.results).toBeUndefined(); // students don't get aggregate results
    expect(res.body.badges).toBeDefined();
  });

  test("admin sees draft class decks + aggregate results", async () => {
    mockUtils.getVisitor.mockResolvedValue({
      visitor: { isAdmin: true, dataObject: {} },
      visitorInventory: {},
    });
    mockUtils.getBadges.mockResolvedValue({});
    mockUtils.fetchClassDecks.mockResolvedValue({
      d1: { id: "d1", scope: "class", status: "draft", cards: [] },
      d2: { id: "d2", scope: "class", status: "published", cards: [] },
    });
    mockUtils.fetchUserDecks.mockResolvedValue({});

    const app = makeApp();
    const res = await request(app).get("/api/config").query(baseCreds);
    expect(res.body.classDecks).toHaveLength(2);
    expect(res.body.isAdmin).toBe(true);
  });
});

describe("POST /decks", () => {
  test("rejects unknown scope with 400", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ deck: { title: "x" }, scope: "bogus" });
    expect(res.status).toBe(400);
  });

  test("non-admin can save a user-scope deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    mockUtils.fetchUserDecks.mockResolvedValue({});
    mockUtils.buildDeckFromInput.mockReturnValue({
      deck: { id: "u_new", scope: "user", title: "My deck", cards: [] },
      isNew: true,
    });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ scope: "user", deck: { title: "My deck" } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deck.scope).toBe("user");
    expect(mockUtils.persistDeck).toHaveBeenCalled();
  });

  test("non-admin cannot save an class-scope deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ scope: "class", deck: { title: "T" } });
    expect(res.status).toBe(403);
  });

  test("admin can save an class-scope deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: true }, visitorInventory: {} });
    mockUtils.fetchClassDecks.mockResolvedValue({});
    mockUtils.buildDeckFromInput.mockReturnValue({
      deck: { id: "e_new", scope: "class", title: "Civil War", cards: [] },
      isNew: true,
    });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ scope: "class", deck: { title: "Civil War" } });
    expect(res.status).toBe(200);
    expect(res.body.deck.scope).toBe("class");
  });

  test("non-admin can save their own user deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    mockUtils.fetchUserDecks.mockResolvedValue({
      u1: { id: "u1", scope: "user", title: "My deck", status: "draft", cards: [] },
    });
    mockUtils.buildDeckFromInput.mockReturnValue({
      deck: { id: "u1", scope: "user", title: "My deck (edited)" } as any,
      isNew: false,
    });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ scope: "user", deck: { id: "u1", title: "My deck (edited)" } });
    expect(res.status).toBe(200);
    expect(res.body.deck.scope).toBe("user");
  });

  test("propagates build validation errors", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: true }, visitorInventory: {} });
    mockUtils.fetchClassDecks.mockResolvedValue({});
    mockUtils.buildDeckFromInput.mockReturnValue({
      deck: {} as any,
      isNew: true,
      validationError: "Decks are limited to 100 cards.",
    });
    const app = makeApp();
    const res = await request(app)
      .post("/api/decks")
      .query(baseCreds)
      .send({ scope: "class", deck: { title: "T" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/100 cards/);
  });
});

describe("DELETE /decks/:deckId", () => {
  test("admin can delete an class deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: true }, visitorInventory: {} });
    mockUtils.findDeck.mockResolvedValue({ id: "d1", scope: "class" });
    const app = makeApp();
    const res = await request(app)
      .delete("/api/decks/d1")
      .query({ ...baseCreds, scope: "class" });
    expect(res.status).toBe(200);
    expect(mockUtils.deleteDeck).toHaveBeenCalled();
  });

  test("non-admin cannot delete an class deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    const app = makeApp();
    const res = await request(app)
      .delete("/api/decks/d1")
      .query({ ...baseCreds, scope: "class" });
    expect(res.status).toBe(403);
  });

  test("user can delete their own user deck", async () => {
    mockUtils.getVisitor.mockResolvedValue({ visitor: { isAdmin: false }, visitorInventory: {} });
    mockUtils.findDeck.mockResolvedValue({ id: "u1", scope: "user" });
    const app = makeApp();
    const res = await request(app)
      .delete("/api/decks/u1")
      .query({ ...baseCreds, scope: "user" });
    expect(res.status).toBe(200);
    expect(mockUtils.deleteDeck).toHaveBeenCalled();
  });
});

describe("POST /session/start", () => {
  test("rejects unknown mode", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/session/start")
      .query(baseCreds)
      .send({ deckId: "d1", scope: "class", mode: "bogus" });
    expect(res.status).toBe(400);
  });

  test("rejects unknown scope", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/session/start")
      .query(baseCreds)
      .send({ deckId: "d1", mode: "flip", scope: "bogus" });
    expect(res.status).toBe(400);
  });

  test("mints a session id and returns cards", async () => {
    mockUtils.findDeck.mockResolvedValue({
      id: "d1",
      scope: "class",
      status: "published",
      cards: [{ id: "c1", front: "Q", back: "A" }],
    });
    mockUtils.getVisitor.mockResolvedValue({
      visitor: { isAdmin: false, dataObject: {} },
      visitorInventory: {},
    });
    mockUtils.computeNextCards.mockReturnValue([{ card: { id: "c1", front: "Q", back: "A" } }]);
    mockUtils.createSession.mockImplementation((s: any) => ({ ...s }));

    const app = makeApp();
    const res = await request(app)
      .post("/api/session/start")
      .query(baseCreds)
      .send({ deckId: "d1", scope: "class", mode: "flip" });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.cards).toHaveLength(1);
  });
});

describe("POST /session/answer", () => {
  test("400 on missing required body fields", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/session/answer").query(baseCreds).send({});
    expect(res.status).toBe(400);
  });

  test("404 when session unknown", async () => {
    mockUtils.getSession.mockReturnValue(undefined);
    const app = makeApp();
    const res = await request(app)
      .post("/api/session/answer")
      .query(baseCreds)
      .send({ sessionId: "x", cardId: "c1", mode: "quiz", isCorrect: true });
    expect(res.status).toBe(404);
  });

  test("updates visitor data on quiz answer", async () => {
    const updateDataObject = jest.fn().mockResolvedValue({});
    mockUtils.getSession.mockReturnValue({
      sessionId: "s1",
      visitorId: 1,
      assetId: "asset-123",
      deckId: "d1",
      deckScope: "class",
      mode: "quiz",
      cardIds: ["c1"],
      startedAt: 0,
      correctCount: 0,
      totalAnswered: 0,
      comebackTransitions: false,
      startingMastery: { c1: 0 },
      masteryDeltas: {},
    });
    mockUtils.findDeck.mockResolvedValue({
      id: "d1",
      scope: "class",
      status: "published",
      cards: [{ id: "c1", front: "Q", back: "A" }],
    });
    mockUtils.getVisitor.mockResolvedValue({
      visitor: { isAdmin: false, dataObject: {}, updateDataObject },
      visitorInventory: {},
    });

    const app = makeApp();
    const res = await request(app)
      .post("/api/session/answer")
      .query(baseCreds)
      .send({ sessionId: "s1", cardId: "c1", mode: "quiz", isCorrect: true });
    expect(res.status).toBe(200);
    expect(res.body.masteryAfter).toBe(1);
    expect(updateDataObject).toHaveBeenCalled();
  });
});

describe("POST /session/complete", () => {
  test("returns summary and grants badges", async () => {
    const updateVisitor = jest.fn().mockResolvedValue({});
    mockUtils.getSession.mockReturnValue({
      sessionId: "s1",
      visitorId: 1,
      assetId: "asset-123",
      deckId: "d1",
      deckScope: "class",
      mode: "flip",
      cardIds: ["c1"],
      startedAt: 0,
      correctCount: 1,
      totalAnswered: 1,
      comebackTransitions: false,
      startingMastery: { c1: 0 },
      masteryDeltas: { c1: 2 },
    });
    mockUtils.findDeck.mockResolvedValue({
      id: "d1",
      scope: "class",
      subject: "math",
      cards: [{ id: "c1", front: "Q", back: "A" }],
    });
    mockUtils.fetchClassDecks.mockResolvedValue({});
    mockUtils.fetchUserDecks.mockResolvedValue({});
    mockUtils.updateDeckResult.mockResolvedValue(undefined);
    mockUtils.getVisitor.mockResolvedValue({
      visitor: {
        isAdmin: false,
        dataObject: {
          studyStacksData: {
            decks: {},
            streak: { current: 0, longest: 0, lastDay: "" },
            totalCardsStudied: 1,
            totalSessionsCompleted: 0,
          },
        },
        updateDataObject: updateVisitor,
      },
      visitorInventory: {},
    });
    mockUtils.dateKey.mockReturnValue("2026-05-21");
    mockUtils.applyDailyStreak.mockReturnValue({ current: 1, longest: 1, lastDay: "2026-05-21" });
    mockUtils.evaluateBadges.mockResolvedValue(["FirstStep"]);

    const app = makeApp();
    const res = await request(app).post("/api/session/complete").query(baseCreds).send({ sessionId: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.summary.newBadges).toContain("FirstStep");
    expect(updateVisitor).toHaveBeenCalled();
  });
});
