// Study Stacks test data: decks, the badge catalog and a seed wrapper.
import type { APIRequestContext } from "@playwright/test";
import type { InventoryItem, SeedOptions, TopiaWorld } from "../../fixtures";

export const BADGE_NAMES = [
  "First Step",
  "Bookworm",
  "Scholar",
  "Master",
  "Deck Done",
  "Polyglot",
  "Comeback Kid",
  "Streaker",
  "Marathoner",
  "Speed Demon",
  "Perfectionist",
];

/**
 * The ecosystem catalog every test seeds. The app caches the catalog process-wide for 6 hours, so all
 * worlds use the same one. Marathoner is retired (INACTIVE) and one item isn't a badge.
 */
export const CATALOG: InventoryItem[] = [
  ...BADGE_NAMES.map((name, i) => ({
    id: `ss-badge-${i + 1}`,
    name,
    type: "BADGE",
    status: name === "Marathoner" ? "INACTIVE" : "ACTIVE",
    description: `${name} badge`,
    image_path: `http://localhost/badges/${i + 1}.png`,
    metadata: { sortOrder: i },
  })),
  { id: "ss-item-1", name: "Golden Pencil", type: "ITEM", status: "ACTIVE", description: "Not a badge" },
];

export type Card = { id: string; front: string; back: string; hint?: string; imageUrl?: string };

export const cards = (n: number, prefix = "c"): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, front: `Question ${i + 1}`, back: `Answer ${i + 1}` }));

export const deck = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  scope: "class",
  title: `Deck ${id}`,
  subject: "science",
  difficulty: "medium",
  status: "published",
  grades: "all",
  cards: cards(4, `${id}-c`),
  createdByProfileId: "teacher-profile",
  createdByDisplayName: "Ms Teacher",
  ...overrides,
});

export const userDeck = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  scope: "user",
  title: `My ${id}`,
  subject: "math",
  difficulty: "easy",
  status: "published",
  cards: cards(4, `${id}-c`),
  ...overrides,
});

/** Seeds a world with class decks on the key asset and the Study Stacks badge catalog. */
export const seedStudy = (
  world: TopiaWorld,
  { classDecks = [], ...options }: SeedOptions & { classDecks?: Array<Record<string, any>> } = {},
) =>
  world.seed({
    inventoryItems: CATALOG,
    ...options,
    assetData: {
      ...(options.assetData ?? {}),
      studyStacksDecks: Object.fromEntries(classDecks.map((d) => [d.id, d])),
    },
  });

/** UTC day key the app uses for streaks. */
export const dayKey = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** The visitor's Study Stacks progress record. */
export const studyData = async (world: TopiaWorld, visitorId?: number) =>
  ((await world.visitorData(visitorId)) ?? {}).studyStacksData;

/**
 * Starts a session through the API, as the drawer of `visitorId` (default: the test's own visitor).
 * Refreshes the app's process-wide badge cache with this world's catalog first (see CATALOG).
 */
export const startSession = async (
  request: APIRequestContext,
  world: TopiaWorld,
  body: { deckId: string; mode: string; scope?: string },
  visitorId?: number,
) => {
  const as = visitorId ? world.as(visitorId) : {};
  await request.get(world.api("/config", { ...as, forceRefreshInventory: "true" }));
  const response = await request.post(world.api("/session/start", as), { data: { scope: "class", ...body } });
  return { response, json: await response.json() };
};

export const answer = (
  request: APIRequestContext,
  world: TopiaWorld,
  data: Record<string, unknown>,
  visitorId?: number,
) => request.post(world.api("/session/answer", visitorId ? world.as(visitorId) : {}), { data });

export const complete = (request: APIRequestContext, world: TopiaWorld, sessionId: string, visitorId?: number) =>
  request.post(world.api("/session/complete", visitorId ? world.as(visitorId) : {}), { data: { sessionId } });
