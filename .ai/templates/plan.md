# Study Stack — Implementation Plan

> Read `.ai/rules.md` and `.ai/sdk-fundamentals.md` before starting. This plan assumes the boilerplate's protected files (`App.tsx`, `PageContainer.tsx`, `backendAPI.ts`, `setErrorMessage.ts`, `getCredentials.ts`) stay untouched and that all per-app state lives on the **key asset's** data object (per the sdk-quiz / sdk-scavenger-hunt convention).

## 1. Project Overview

**Study Stack** is a teacher-customizable flash-card study app that lives in a Topia world. Teachers ("admins") build **decks** of study cards keyed to their curriculum; students click a Study Stack desk in the world to drop into a focused study session. Sessions are deliberately short and replayable: the same deck is meant to be studied repeatedly across days, with the app adapting which cards come back based on what the student got wrong.

The goal is to feel as quick and habit-forming as Duolingo or Quizlet, while staying inside a Topia world so the social/spatial elements (teacher-in-the-room, classroom decor, NPC tutors) are available.

This project focuses on **single-player study sessions with spaced repetition + badges**. Future iterations may include image/audio cards, a "match" drag-and-drop mode, multiplayer study races over SSE, and an AI tutor NPC built on `sdk-npc-voice-session`.

## 2. Core User Flow

### Student flow

1. Walks up to the **Study Stack desk** (key asset) and clicks it.
2. Drawer opens to the **Library** screen: list of decks the teacher has published, each with the student's mastery progress ring and last-studied date.
3. Picks a deck → chooses a **study mode** (Flip / Quiz / Sprint).
4. Studies through the cards. After each card, sees whether they were right, with a brief celebration on correct + a "show me again later" if they were wrong.
5. End-of-session screen: cards studied, mastery deltas, streak status, any badges granted, an explicit "Study again" CTA.
6. Returns the next day → daily streak increments → recommended deck surfaces at the top.

### Teacher (admin) flow

1. Clicks the same Study Stack desk → because they're an admin, sees a gear icon → opens **Admin** view.
2. Decks list: create / edit / duplicate / delete / publish / unpublish.
3. Inside a deck: edit metadata (title, subject, grade levels), add/edit/remove cards (front/back text), reorder cards, set a difficulty hint.
4. Hits **Publish** — students see the deck in their Library on next open.
5. Optional: Results tab shows aggregate progress per student across this asset (admin-only).

## 3. Important Terminology

- **Deck** — A teacher-authored set of related study cards (e.g. "Civil War Dates", "Spanish -ar Verbs"). Has metadata (title, subject, grades, difficulty) and an ordered list of cards.
- **Card** — A single study item with a `front` (the prompt the student sees first) and a `back` (the answer revealed after they commit). v1 is text-only; v2 adds image and audio.
- **Study mode** — How a card is presented:
  - **Flip** — Classic flash card. Read front → think → tap to flip → self-rate ("Got it" / "Almost" / "Missed").
  - **Quiz** — Front shown with 3 distractors drawn from other cards in the deck. Tap the correct back.
  - **Sprint** — 60-second timed quiz. As many correct as possible.
- **Mastery** — Per-card, per-visitor scalar 0–5 representing how well the student knows the card. Bumps up on correct, drops on wrong, decays slightly with time-since-last-seen. Drives **spaced repetition**.
- **Streak** — Number of consecutive calendar days the visitor has completed at least one session.
- **Session** — One end-to-end study sitting (deck pick → cards → end screen). Bounded so sessions complete and badges can be awarded.

## 4. Technical Requirements

### Styling guidelines

All client-side components MUST follow `.ai/style-guide.md` and `.ai/accessibility.md`. Specifically for this app:

- See `.ai/templates/StudyStack.png` and `.ai/templates/style.md` as a general guide for how the app should be styled but use this file as the source of truth for all features and functionality.
- Use SDK classes for chrome (`.btn`, `.card`, `.input`, `.h1`–`.h4`, `.p1`–`.p4`).
- Use Tailwind utilities for layout/spacing only — the SDK class wins where they overlap thanks to the cascade-layer setup.
- Card flip + correct/incorrect feedback get bespoke `.ss-*`-prefixed component CSS in `client/src/styles/components.css`. Motion respects `prefers-reduced-motion`.
- Min student body type 18px; teacher admin can be tighter (14–16px).
- Every interactive element needs visible `:focus-visible`, sensible `:hover` and `:active`. Tap targets ≥ 44px on student screens.

### Data models

All shared between client and server via `shared/types/StudyStackTypes.ts`.

#### Deck

```ts
type DeckId = string;
type CardId = string;
type Subject = "math" | "ela" | "science" | "history" | "language" | "art" | "other";

interface Card {
  id: CardId;
  front: string;
  back: string;
  hint?: string;
  // Stretch: imageUrlFront, imageUrlBack, audioUrl
}

interface Deck {
  id: DeckId;
  title: string;
  subject: Subject;
  grades: Grade[]; // shared with other SDK apps if available
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published";
  cards: Card[];
  createdByProfileId: string;
  createdByDisplayName: string;
  createdAt: number;
  updatedAt: number;
}
```

#### Per-visitor study state

Per visitor + per asset, keyed `${urlSlug}_${sceneDropId}` to mirror the convention used in trivia and scavenger hunt.

```ts
interface CardMastery {
  cardId: CardId;
  mastery: 0 | 1 | 2 | 3 | 4 | 5; // 0 = never seen, 5 = burned in
  lastSeenAt: number;
  timesCorrect: number;
  timesWrong: number;
}

interface DeckProgress {
  deckId: DeckId;
  cards: { [cardId: CardId]: CardMastery };
  sessionsCompleted: number;
  lastStudiedAt: number;
}

interface VisitorStudyData {
  decks: { [deckId: DeckId]: DeckProgress };
  streak: {
    current: number;
    longest: number;
    lastDay: string; // YYYY-MM-DD in the visitor's wall clock; resets if a day is skipped
  };
  totalCardsStudied: number;
  totalSessionsCompleted: number;
}
```

#### Key asset data object (single source of truth for teacher config)

Following the sdk-quiz / sdk-scavenger-hunt pattern: the **world data object** is just `{ [sceneDropId]: { keyAssetId } }`, and everything else lives on the key asset.

```ts
interface KeyAssetDataObjectType {
  decks: { [deckId: DeckId]: Deck };
  // Aggregate per-asset analytics so admins can see how their class is doing:
  results?: {
    [profileId: string]: {
      displayName: string;
      totalSessions: number;
      mostStudiedDeckId?: DeckId;
      currentStreak: number;
      lastSeenAt: number;
    };
  };
  leaderboard?: { [profileId: string]: string }; // pipe-encoded as in trivia
}
```

#### Server response shape (single envelope)

Per `.ai/rules.md` RESPONSE SCHEMA — every endpoint returns `{ success: true, ...data }` or `{ success: false, message }`.

## 5. Engagement Mechanics

Listed up front because the brief specifically calls out "fun, engaging." These aren't decoration — they're the difference between this and a homework worksheet.

- **Card flip animation** — 3D flip on tap. CSS-only.
- **Streak ring** — Persistent indicator in the top-right showing current streak; pulses on increment.
- **Correct / wrong micro-celebration** — Correct = brief green burst + soft chime; wrong = horizontal shake + the back of the card revealed so they actually learn. **Sound is opt-in** (mute toggle).
- **Sprint mode** — Big timer pill that pulses near 0 (no shake — matches the accessibility note in trivia).
- **Badge toast** — On grant, `visitor.fireToast` + a one-off particle effect via `visitor.triggerParticle({ name: "explosion_float" })`.
- **End-of-session screen** — Concrete numbers ("8 mastered, 2 to revisit"), a streak callout, and a Study Again CTA that goes straight back into the deck.
- **No anxiety-inducing patterns** — no leaderboard shaming, no "you're behind your class" framing, no shake on wrong answers. Encouragement framing on errors ("Let's circle back to this one").

## 6. User Stories & Acceptance Criteria

### Epic 1: Teacher authoring

#### 1.1 — Create a deck

As a **teacher**, I want to **create a new deck of cards** so that **I can publish curriculum-aligned study material to my class**.

✅ Acceptance criteria:

- Admin can click **Create Deck**, enter a title, pick a subject, pick grades, pick difficulty, save as draft.
- A blank deck has the **+ Add Card** button enabled; students can't see drafts.
- Up to 100 cards per deck (server-enforced); attempting 101 returns a clear error.
- Title is required; subject is required; grades has a default of all if not set.

#### 1.2 — Edit cards

As a **teacher**, I want to **add, edit, reorder, and delete cards** so that **I can iterate on my deck content**.

✅ Acceptance criteria:

- Each card has Front and Back required text fields plus an optional Hint.
- Cards reorder via drag-handle. Order persists.
- Removing a card asks for confirmation (cards may be referenced by visitor mastery — see migration note below).
- Published decks: editing card _text_ is allowed, but adding/removing cards prompts "this will reset mastery for affected students — continue?".

#### 1.3 — Publish a deck

As a **teacher**, I want to **publish a deck** so that **my students can find it in their Library**.

✅ Acceptance criteria:

- Publish button is gated on: title + ≥ 1 grade + ≥ 1 card with non-empty front and back.
- Publishing flips status to "published" and stamps `updatedAt`.
- Unpublishing returns to draft; existing visitor mastery for that deck is preserved.

#### 1.4 — See class results

As a **teacher**, I want to **see aggregate results for my class** so that **I can tell who's struggling and who's ahead**.

✅ Acceptance criteria:

- Admin-only Results tab on the asset.
- Table: Name, Current Streak, Total Sessions, Most-Studied Deck, Last Active.
- Sortable; max 200 rows; rest accessible via "View all" which downloads a CSV.

### Epic 2: Student studying

#### 2.1 — Pick a deck

As a **student**, I want to **see a Library of published decks with my progress** so that **I can pick what to study next**.

✅ Acceptance criteria:

- Library only shows decks with `status === "published"`.
- Each deck card shows: title, subject icon, # of cards, my mastery % (avg mastery / 5 across the deck), last studied date.
- "Recommended" deck (least-recently-studied or lowest-mastery) is pinned to the top.

#### 2.2 — Study in Flip mode

As a **student**, I want to **flip cards and self-rate my recall** so that **I'm actively retrieving and not just passively reading**.

✅ Acceptance criteria:

- Card opens showing the front. Tap or press space to flip.
- After flip, three rating buttons: **Got it** (+2 mastery), **Almost** (+0 mastery, no change), **Missed** (−1, min 0).
- Card advance is automatic on rating; no extra confirm.
- Reduced-motion mode: flip is a fade-in instead.

#### 2.3 — Study in Quiz mode

As a **student**, I want to **pick the right answer from choices** so that **I can practice recognition before recall**.

✅ Acceptance criteria:

- Front of card is shown with 4 buttons: 1 correct back + 3 distractors sampled from other cards in this deck.
- Decks with < 4 cards fall back to True/False ("Is this the right answer?").
- Wrong answer: feedback shows the correct back and queues the card to come back later in the same session.
- Correct: +1 mastery. Wrong: −1 (min 0).

#### 2.4 — Study in Sprint mode

As a **student**, I want a **60-second timed challenge** so that **I get a fun, gameshow-y session option**.

✅ Acceptance criteria:

- Pre-session screen: deck name + Start button + countdown.
- 60-second clock counts down; cards are presented in Quiz-mode style; auto-advance on answer.
- End screen: number correct, accuracy %, badges if any.
- Sprint does **not** apply mastery decay penalties (it's about speed, not learning) — only awards mastery bumps on correct.

#### 2.5 — See my progress

As a **student**, I want to **see my streak, total cards studied, and badges** so that **I feel rewarded for showing up**.

✅ Acceptance criteria:

- Progress tab shows: current streak, longest streak, total sessions, total cards mastered, list of earned badges with icons.
- Streak ring is visible across all screens.

### Epic 3: Rewards (shared)

#### 3.1 — Earn badges

As a **student**, I want to **earn badges for milestones** so that **I have a visible record of progress**.

✅ Acceptance criteria:

- Badges granted via `Ecosystem.grantInventoryItem` (see `.ai/examples/badges.md`).
- Grant is **idempotent** — re-running the eligibility check on a visitor who already has the badge is a no-op.
- Grant fires a Topia toast + a one-off particle effect.
- See **§9 Badge Catalog** for the full list.

## 7. Implementation Plan

### Server-side

```
server/
├── controllers/
│   ├── handleAnswerCard.ts             // student commits an answer; updates mastery + grants badges
│   ├── handleCompleteSession.ts        // session end; updates streak, totals, aggregate results
│   ├── handleDeleteDeck.ts             // admin
│   ├── handleGetConfig.ts              // returns merged view: decks + my visitor study data + badges
│   ├── handleGetDeck.ts                // includes mastery for the current visitor
│   ├── handleSaveDeck.ts               // create or update a deck (draft or published)
│   ├── handleStartSession.ts           // mints a sessionId, returns the chosen card sequence
│   └── index.ts                        // barrel
├── utils/
│   ├── awardBadge.ts                   // already in boilerplate; mirrors trivia/scavenger
│   ├── computeNextCards.ts             // spaced-repetition selection (see §8)
│   ├── evaluateBadges.ts               // pure function: which badges should this visitor have?
│   ├── getConfig.ts                    // single key-asset resolver; mirrors sdk-quiz/sdk-scavenger
│   ├── getVisitor.ts                   // boilerplate helper; reused
│   ├── streak.ts                       // pure: applyDailyStreak(prev, today) → updated streak
│   └── index.ts                        // barrel
├── tests/
│   └── routes.test.ts                  // success + error paths for each route; mocks Topia SDK + getConfig
├── routes.ts                           // wires the controllers above
└── index.ts                            // protected
```

### Client-side

```
client/src/
├── pages/
│   ├── Home.tsx                        // tab container: Library | Progress | Badges (admin: + Admin tab)
│   └── Study.tsx                       // owns the in-session state machine; renders mode sub-views
├── components/
│   ├── Library.tsx                     // grid of DeckCard
│   ├── DeckCard.tsx                    // mastery ring + title + meta
│   ├── ModePicker.tsx                  // Flip | Quiz | Sprint chooser
│   ├── FlipCard.tsx                    // self-rated card
│   ├── QuizCard.tsx                    // 4-button multiple choice
│   ├── SprintHUD.tsx                   // timer + running score
│   ├── EndOfSession.tsx                // summary screen
│   ├── StreakRing.tsx                  // ambient streak indicator
│   ├── BadgesTab.tsx                   // grid of badges (earned + locked)
│   ├── ProgressTab.tsx                 // per-deck mastery breakdown
│   └── admin/
│       ├── DecksList.tsx               // list of decks with status/actions
│       ├── EditDeck.tsx                // deck metadata + cards list
│       └── CardEditor.tsx              // single card row with drag handle
├── context/
│   ├── GlobalContext.tsx               // typed Provider
│   ├── reducer.ts                      // SET_CONFIG, SET_DECKS, SET_VISITOR_DATA, SET_SESSION_RESULT, SET_ERROR
│   └── types.ts                        // InitialState + action types
└── styles/
    ├── tokens.css                      // colors / fonts / motion (loaded unlayered)
    └── components.css                  // .ss-* component classes (card flip, mastery ring, streak pulse)
```

### API endpoints

```ts
// GET /api/config
// Returns the merged view used by Home.tsx
// Response: {
//   success: true,
//   decks: Deck[];                 // drafts hidden from non-admins
//   visitorStudyData: VisitorStudyData;
//   badges: BadgeRecord;
//   visitorInventory: VisitorBadgeRecord;
//   isAdmin: boolean;
// }

// POST /api/decks                                       (admin)
// Body: { deck: Partial<Deck> }
// Response: { success: true, deck: Deck }

// DELETE /api/decks/:deckId                             (admin)
// Response: { success: true }

// GET /api/decks/:deckId
// Response: { success: true, deck: Deck, mastery: { [cardId]: CardMastery } }

// POST /api/session/start
// Body: { deckId: DeckId, mode: "flip" | "quiz" | "sprint" }
// Response: { success: true, sessionId: string, cards: Card[] }
// The server picks the card sequence using computeNextCards (see §8); client just renders it.

// POST /api/session/answer
// Body: {
//   sessionId: string;
//   cardId: CardId;
//   mode: "flip" | "quiz" | "sprint";
//   rating?: "got_it" | "almost" | "missed";   // flip mode only
//   isCorrect?: boolean;                       // quiz/sprint
//   msTaken: number;
// }
// Response: { success: true, masteryAfter: 0|1|2|3|4|5 }

// POST /api/session/complete
// Body: { sessionId: string }
// Response: {
//   success: true,
//   summary: {
//     cardsStudied: number;
//     correctCount: number;
//     masteryDeltas: { [cardId]: number };
//     newBadges: string[];
//     streakAfter: { current: number; longest: number };
//   }
// }
```

### State management

- `GlobalContext` holds the same shape `/api/config` returns: `decks`, `visitorStudyData`, `badges`, `visitorInventory`, `isAdmin`, plus a transient `session` slice for the in-progress study session.
- Mutations go through `dispatch` after the corresponding backend call returns, so the UI always reflects committed server state. No optimistic updates in v1 — keeps mastery math authoritative server-side.
- `Study.tsx` owns the session state machine: `picking-mode → in-session → ended`. Only one of these is mounted at a time.

## 8. Spaced repetition algorithm

The differentiator vs. plain quiz apps. v1 uses a small, explainable version of SM-2 — deliberately simpler than Anki so a teacher reading the code can follow it.

```ts
// utils/computeNextCards.ts (server)
// Goal: pick the next N cards to study in this session.

const recencyPenalty = (lastSeenAt: number) => {
  const days = (Date.now() - lastSeenAt) / 86_400_000;
  return Math.min(2, days / 3); // up to 2 points of "I've forgotten" pressure after 6+ days
};

const priority = (m: CardMastery) =>
  // Low mastery + recently wrong + not-seen-in-a-while bubbles to the top.
  (5 - m.mastery) * 2 + m.timesWrong + recencyPenalty(m.lastSeenAt);

export function computeNextCards(deck: Deck, mastery: DeckProgress, sessionSize: number) {
  const ranked = deck.cards
    .map((c) => ({ card: c, score: priority(mastery.cards[c.id] ?? defaultMastery(c.id)) }))
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, sessionSize).map((r) => r.card);
}
```

Notes:

- Pure, testable, dependency-free.
- For Sprint mode, ignore priority and just shuffle the full deck.
- For Quiz mode, also build distractors here so the client can't peek at the answer in any payload it doesn't render.

## 9. Badge catalog

All badges live in the Topia ecosystem and are granted via `Ecosystem.grantInventoryItem`. Grant logic is centralized in `utils/evaluateBadges.ts`, called from `handleCompleteSession` and `handleAnswerCard`. Eligibility is idempotent; the helper short-circuits if the visitor already has the badge in their inventory.

| Name              | Trigger                                                               |
| ----------------- | --------------------------------------------------------------------- |
| **First Step**    | Complete your first session.                                          |
| **Bookworm**      | 50 cards studied lifetime.                                            |
| **Scholar**       | 250 cards studied lifetime.                                           |
| **Master**        | 1000 cards studied lifetime.                                          |
| **Deck Done**     | Reach mastery 5 on every card in any deck (granted per _first_ deck). |
| **Polyglot**      | Earn Deck Done on decks in 3 different subjects.                      |
| **Comeback Kid**  | Move a card from mastery 0 or 1 to mastery 5.                         |
| **Streaker**      | 7-day streak.                                                         |
| **Marathoner**    | 30-day streak.                                                        |
| **Speed Demon**   | Score 20+ in Sprint mode.                                             |
| **Perfectionist** | Finish a Quiz session with 100% correct and ≥ 10 cards.               |

Badge images, descriptions, and ecosystem unique names will be configured once the ecosystem is set up; the names above are placeholders that map 1:1 to the `evaluateBadges` switch.

## 10. Testing approach

- **`server/utils/computeNextCards.test.ts`** — table-driven tests for priority and ordering; covers all-new deck, mixed-mastery deck, and stale-mastery deck.
- **`server/utils/streak.test.ts`** — calendar arithmetic edge cases (DST, year boundary, missed day, same-day double-session).
- **`server/utils/evaluateBadges.test.ts`** — each badge in §9 gets a unit test for the boundary case (e.g. "49 → 50 cards triggers Bookworm but a 51st doesn't double-grant").
- **`server/tests/routes.test.ts`** — integration tests for each route: success, auth (admin-only routes reject non-admin), input validation (oversize body, missing fields, malformed deckId).
- **Mocks** — `server/mocks/@rtsdk/topia.ts` mocks Visitor, Ecosystem, DroppedAsset, World, plus the analytics options.
- **Client** — manual testing of the three study modes, including reduced-motion mode and keyboard-only navigation through cards.

## 11. Validation checklist

Before submitting:

- [ ] All user stories in §6 meet their acceptance criteria.
- [ ] Both Library and Study screens are usable with keyboard alone (Tab through cards, Space/Enter to flip/select, Escape to abandon).
- [ ] Every motion has a `prefers-reduced-motion` fallback.
- [ ] WCAG 2.1 AA contrast on all student screens; verified with axe DevTools.
- [ ] All buttons use `.btn` classes; all chrome typography uses SDK classes.
- [ ] All API endpoints return the standard `{ success, ... }` envelope.
- [ ] Admin-only endpoints return 403 for non-admin callers.
- [ ] No optimistic UI for mastery — every change is server-committed first.
- [ ] No relative imports; only aliased paths.
- [ ] Server tests cover the route matrix; pure-function utilities have their own unit tests.

## 12. Future iterations

- **v2 — Richer cards**: image and audio cards, with the image picker reusing the S3 pattern from `sdk-scavenger-hunt` (`userUploads/{interactivePublicKey}/{profileId}_{filename}`).
- **v2 — Match mode**: drag-and-drop pairing UI; works best on tablet/desktop, falls back to tap-pair on mobile.
- **v2 — Daily review**: server-curated mixed-deck session of "cards likely to be forgotten today" pulled from across all the student's decks.
- **v3 — AI tutor NPC**: spawn an NPC built on `sdk-npc-voice-session` that quizzes the student verbally. The NPC's system prompt is pre-loaded with the active deck's content so it stays on-topic. Use the same per-app guardrails layered with Topia's platform preamble.
- **v3 — Multiplayer study race**: 2–4 students study the same deck in real time over SSE (see `sdk-ring-toss/server/utils/sseManager.ts`). First to mastery wins a "Study Champion" badge.
- **v3 — Teacher analytics export**: weekly digest CSV downloaded from the Results tab, or surfaced as a `WorldActivity` feed for the in-world teacher avatar.

## 13. Post-implementation finalization

Per `.ai/rules.md` FINALIZE, after the app is implemented:

### 13a. Remove unused boilerplate code

- **Server utils**: remove any unused boilerplate files (`droppedAssets/`, `getBaseUrl.ts`, etc.) that this app doesn't reference. Trace imports — if a file isn't imported anywhere, it goes.
- **Server types**: remove orphaned type files.
- **Client components**: drop unused boilerplate components (likely `Accordion.tsx`, `AdminIconButton.tsx` if not reused).
- **Barrels**: keep `server/utils/index.ts`, `server/types/index.ts`, `client/src/components/index.ts` in sync.

Protected files stay (`App.tsx`, `PageContainer.tsx`, `backendAPI.ts`, `setErrorMessage.ts`, `getCredentials.ts`).

### 13b. Update README

Rewrite `README.md` for Study Stack specifically — using the boilerplate's [`README.md`](../README.md) as the structural reference. Fill in every section heading (Introduction, Key Features, Required Assets with Unique Names, Technical Architecture, API Endpoints, Environment Variables, Getting Started, For Developers).

Notable for this app:

- **Required dropped asset**: `StudyStack_keyAsset` (unique name) — the desk students click to open the app.
- **Optional NPC**: `StudyStack_tutorNpc` for the v3 AI tutor extension.
- **Ecosystem badges**: enumerate the names from §9 so world builders know what to provision.

### 13c. Update server tests

Per §10. Replace boilerplate route tests with Study Stack's routes; update `jest.mock("../utils/index.js")` to mock `getConfig`, `getVisitor`, `evaluateBadges`, `computeNextCards`, `streak`.

### 13d. Replace `CLAUDE.md` with the per-app template

Per `.ai/templates/CLAUDE.md` — point at `../sdk-ai-boilerplate/.ai/` as the canonical source. Fill the "App-specific context" section with: one-line description, key-asset unique name, badge list, link to README.

### 13e. Commit, push, open PR

- Commit on `dev`, push, open PR `dev` → `main` with the standard summary + test plan template.
