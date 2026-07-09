# Study Stacks — Implementation Reference

> This document reflects the **shipped** app. For the boilerplate rules it was built against, see `.ai/rules.md` and `.ai/sdk-fundamentals.md`. Protected boilerplate files (`App.tsx`, `PageContainer.tsx`, `backendAPI.ts`, `setErrorMessage.ts`, `getCredentials.ts`) are untouched.

## 1. Project Overview

**Study Stacks** is a customizable flash-card study app that lives in a Topia world. Two kinds of decks coexist:

- **Ecosystem decks** — class-wide decks authored by an admin (teacher) visible to every visitor. Per-deck student leaderboards.
- **User decks** — personal decks any visitor can author for themselves. Cross-world (the same student sees their decks at every desk), but private to the owner.

Both kinds appear side-by-side in the same Library — admins don't have a separate "Admin" view. Deck management (edit / delete / view analytics) is reached by clicking the deck, which opens a `SelectedDeckModal` whose icon row shows whichever actions the current visitor is allowed to take.

Sessions are deliberately short and replayable: the same deck is meant to be studied repeatedly across days, with the app adapting which cards come back based on what the student got wrong.

## 2. Core User Flow

There is **one** UI for both students and admins. Eligibility-gated actions appear/disappear inside that one UI based on `isAdmin` and deck `scope`.

### Picking a deck

1. Walk up to the **Study Stacks** key asset and click it.
2. Drawer opens to **Home**: greeting, mute toggle, XP/Level strip, then the Library/Progress/Badges tab bar (defaults to Library).
3. **Library** lists both ecosystem decks ("Class decks") and the visitor's own user decks ("My decks"). Each deck card shows subject icon, title, mastery ring (0–100% for this visitor), card count, last-studied label, and a Draft tag if applicable.
4. Click a deck → `SelectedDeckModal` opens as a portal-mounted modal over the Library. The modal header shows the deck title, card count, difficulty, and whichever of these icon buttons the visitor is allowed:
   - **View Analytics** — `isAdmin && deck.scope === "ecosystem"`. Opens a printable per-student leaderboard in a new browser tab (`openResultsInNewTab`).
   - **Edit** — visitor can edit the deck (user decks always editable by their owner; ecosystem decks editable only by admins). Switches to the EditDeck screen.
   - **Delete** — same eligibility as Edit. Opens an inline `ConfirmationModal` inside the same modal frame; on confirm the DELETE fires and `SET_DECKS` updates dispatch from inside the modal itself.
5. Below the icon row are the three mode cards: **Flip**, **Quiz**, **Sprint**. Pick one → modal closes, `<Study>` mounts with that mode.

### Studying

6. `Study` starts the session on mount (`POST /session/start`), receives the chosen card sequence from the server, and renders one of `FlipCard` / `QuizCard` (Quiz and Sprint share the QuizCard renderer; Sprint adds a `SprintHUD` timer pill).
7. After each card, `POST /session/answer` fires fire-and-forget — the UI advances optimistically and the in-flight promises are awaited at session end so the summary/badges include every card.
8. End-of-session screen (`EndOfSession`) shows cards studied, accuracy, mastery deltas, streak callout, and any newly granted badges. Two CTAs: **Study Again** (re-opens the mode picker for the same deck) and **Done** (back to Library).

### Creating a deck

- Any visitor can click **+ Create a new deck** in the Library. A blank user-scoped deck opens in `EditDeck`. The same `EditDeck` is used by admins for ecosystem decks, with the scope/grades/createdBy fields visible only when the deck is ecosystem-scoped.
- A deck can't be saved with zero cards, and a card can't be saved unless `isCardComplete(card)` — back is required, plus _either_ front text _or_ an image URL on the front.

## 3. Terminology

- **Deck (`DeckType`)** — A set of related study cards. Has metadata (title, subject, difficulty, status) and an ordered list of cards. Either `scope: "user"` (personal) or `scope: "ecosystem"` (class-wide). Ecosystem decks add `grades`, `createdByProfileId`, `createdByDisplayName`, and a `results` leaderboard.
- **Card (`CardType`)** — A single study item with `front` text, `back` text, optional `hint`, and optional `imageUrl` (http(s) image shown above the front prompt). A card is "complete" when it has a back + either front text or an image.
- **Study mode (`StudyModeType`)** — `"flip"` | `"quiz"` | `"sprint"`.
  - **Flip** — Classic flash card. Read front → think → tap to flip → self-rate via `FlipRatingType`: `"got_it"` / `"almost"` / `"missed"`.
  - **Quiz** — Front shown with the correct back plus 3 distractors sampled from sibling cards. Tap the correct back.
  - **Sprint** — 60-second timed quiz (`SPRINT_DURATION_MS`). Same QuizCard renderer, with a `SprintHUD` timer pill.
- **Mastery (`MasteryLevelType`)** — Per-card, per-visitor scalar 0–5. Bumps up on correct, drops on wrong, decays slightly with time-since-last-seen. Drives spaced repetition.
- **Streak** — Number of consecutive calendar days the visitor has completed at least one session.
- **Session** — One end-to-end study sitting (deck pick → cards → end screen). Bounded so sessions complete and badges can be awarded.
- **`ALL_GRADES_SENTINEL` (`"all"`)** — Storage-efficient form for "every grade" on an ecosystem deck. Saves 12 bytes per deck vs. the full array; the common case is "all grades" so it pays for itself fast.

## 4. Data Models

All shared between client and server via `shared/types/StudyStacksTypes.ts` and `shared/types/VisitorData.ts`. Exported types follow the `*Type` suffix convention.

### Where data lives

Study Stacks bypasses the world/key-asset data object entirely. Data is **account-global** (ecosystem decks) or **per-visitor cross-world** (user decks + study progress), so the key asset would be the wrong scope.

| Where                 | Path                                       | Contains                                                               |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Ecosystem data object | `studyStacksDecks: { [deckId]: DeckType }` | Every class-wide deck. Each deck embeds its own `results` leaderboard. |
| Visitor data object   | `studyStacksDecks: { [deckId]: DeckType }` | This visitor's personal decks.                                         |
| Visitor data object   | `studyStacksData: VisitorStudyDataType`    | This visitor's streak, mastery, and lifetime totals.                   |

### Deck

```ts
type SubjectType = "math" | "ela" | "science" | "history" | "language" | "art" | "other";
type DeckScopeType = "user" | "ecosystem";
type DeckGradesType = "all" | GradeType[]; // sentinel-or-array, ecosystem-only

interface CardType {
  id: CardIdType;
  front: string;
  back: string;
  hint?: string;
  imageUrl?: string; // http(s) URL only; sanitized server-side
}

interface DeckType {
  id: DeckIdType;
  scope: DeckScopeType;
  title: string;
  subject: SubjectType;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published";
  cards: CardType[];

  // Ecosystem-only fields (omitted on user decks):
  grades?: DeckGradesType;
  createdByProfileId?: string;
  createdByDisplayName?: string;
  results?: { [profileId: string]: string }; // pipe-encoded: "{displayName}|{sessions}"
}
```

Helpers: `expandGrades(grades)`, `normalizeGrades(grades)`, `isAllGrades(grades)`, `isCardComplete(card)`, `parseDeckResultsValue("Lina|7")` → `{ displayName, sessions }`, `formatDeckResultsValue(name, n)`.

### Per-visitor study state

```ts
interface CardMasteryType {
  cardId: CardIdType;
  mastery: 0 | 1 | 2 | 3 | 4 | 5;
  lastSeenAt: number;
  timesCorrect: number;
  timesWrong: number;
}

interface DeckProgressType {
  deckId: DeckIdType;
  cards: { [cardId: string]: CardMasteryType };
  sessionsCompleted: number;
  lastStudiedAt: number;
}

interface VisitorStudyDataType {
  decks: { [deckId: string]: DeckProgressType };
  streak: { current: number; longest: number; lastDay: string /* YYYY-MM-DD */ };
  totalCardsStudied: number;
  totalSessionsCompleted: number;
}
```

### Per-deck leaderboard (ecosystem only)

The asset-level aggregate results table from the original plan was dropped in favor of a per-deck leaderboard that rides along inside each deck:

```
studyStacksDecks.{deckId}.results.{profileId} = "{displayName}|{sessions}"
```

`handleCompleteSession` writes one row only when `session.deckScope === "ecosystem"`. The admin opens the table via the View Analytics icon in `SelectedDeckModal`, which calls `openResultsInNewTab(deck)` — a self-contained printable HTML page in a new browser tab (the canonical "give the admin a results export" pattern across Topia SDK apps; replaces the older CSV-download approach).

### Constants

```ts
MAX_CARDS_PER_DECK = 100;
FLIP_SESSION_SIZE = 12;
QUIZ_SESSION_SIZE = 10;
SPRINT_DURATION_MS = 60_000;
```

### Server response shape

Per `.ai/rules.md` RESPONSE SCHEMA — every endpoint returns `{ success: true, ...data }` or `{ success: false, message }`.

## 5. Engagement Mechanics

- **Card flip animation** — 3D flip on tap. CSS-only. Respects `prefers-reduced-motion` (fades instead).
- **Streak ring** — `<StreakRing>` indicator visible during a study session; pulses on increment.
- **Correct / wrong micro-celebration** — Correct = brief green burst + soft chime; wrong = the back of the card revealed so they actually learn (no shake — per the accessibility note in trivia). **Sound is opt-in** (mute toggle in Home greeting).
- **Sprint mode** — Big timer pill (`<SprintHUD>`) that pulses near 0.
- **End-of-session screen** — Concrete numbers ("8 mastered, 2 to revisit"), a streak callout, and a Study Again CTA that re-opens the mode picker for the same deck (so you can swap modes without going back to the Library).
- **Confetti** — `<Confetti>` celebrates session completion.
- **No anxiety-inducing patterns** — no leaderboard shaming, no "you're behind your class" framing, no shake on wrong answers. Encouragement framing on errors.

## 6. User Stories & Acceptance Criteria

### Epic 1: Authoring (admin for ecosystem decks, any visitor for user decks)

#### 1.1 — Create a deck

✅ Acceptance criteria:

- Admins can create ecosystem decks; any visitor can create their own user decks via **+ Create a new deck** in the Library.
- A new deck must have title + subject. Ecosystem decks default `grades: "all"`; user decks omit grades entirely.
- Up to 100 cards per deck (`MAX_CARDS_PER_DECK`, server-enforced).
- Cards can be imported in bulk via `ImportCardsModal` (paste/CSV).

#### 1.2 — Edit cards

✅ Acceptance criteria:

- Each card has Front (text or image) + Back (text). At least one of front text / front image is required, alongside a non-empty back; enforced client-side by `isCardComplete` and re-checked server-side.
- Cards reorder via up/down controls in `CardEditor`.
- Save is blocked when the deck has zero cards OR any incomplete card; the form surfaces a pluralized error message naming the offenders.

#### 1.3 — Publish a deck

✅ Acceptance criteria:

- A deck has `status: "draft" | "published"`. Drafts are hidden from non-admins on ecosystem decks; user decks are always visible to their owner.
- Editing card text on a published deck keeps existing visitor mastery intact (mastery is keyed by `cardId`).

#### 1.4 — See per-deck results

✅ Acceptance criteria:

- Admin clicks an ecosystem deck → `SelectedDeckModal` shows a **View Analytics** icon in the header.
- Clicking it opens a printable per-student leaderboard (`openResultsInNewTab`) in a new browser tab — sorted by sessions descending, HTML-escaped display names, includes deck title + subject + generated timestamp.
- User decks have no analytics icon (no leaderboard exists for them).

### Epic 2: Studying

#### 2.1 — Pick a deck

✅ Acceptance criteria:

- Library lists ecosystem decks under "Class decks" and the visitor's user decks under "My decks".
- Each deck card shows: subject icon, title, mastery ring (avg mastery / 5 across the deck × 100), card count, difficulty, last-studied label, and a Draft tag if applicable.
- Decks with the `null`-slot pattern from Topia's delete-by-null are pruned before reaching the client (`pruneNullEntries` in `fetchDecks.ts`), with a defensive `d && d.id === id` guard on the client memo for stragglers.

#### 2.2 — Study in Flip mode

✅ Acceptance criteria:

- Card opens showing the front (text + optional image). Tap or press space to flip.
- After flip, three rating buttons: **Got it**, **Almost**, **Missed**. Server translates these into mastery deltas in `handleAnswerCard`.
- Reduced-motion: flip is a fade-in.

#### 2.3 — Study in Quiz mode

✅ Acceptance criteria:

- Front of card shown with 4 buttons: 1 correct back + 3 distractors sampled from sibling cards.
- Distractor sampling dedupes case-insensitively against the correct answer **and** against itself (fixes the "4+4 = 8" double-option bug).
- Decks with < 4 cards still render the same UI with as many distractors as are available.
- Wrong answer reveals the correct back.

#### 2.4 — Study in Sprint mode

✅ Acceptance criteria:

- 60-second clock counts down (`SPRINT_DURATION_MS`); same QuizCard renderer underneath; auto-advance on answer.
- End-of-session shows count correct + accuracy.

#### 2.5 — See my progress

✅ Acceptance criteria:

- `<ProgressTab>` shows current streak, longest streak, total sessions, total cards mastered.
- `<BadgesTab>` shows earned badges with icons sourced from the Topia ecosystem inventory.

### Epic 3: Rewards

#### 3.1 — Earn badges

✅ Acceptance criteria:

- Badges granted via `Ecosystem.grantInventoryItem` (see `.ai/examples/badges.md`).
- Grant is **idempotent**.
- See **§9 Badge Catalog**.

## 7. Implementation

### Server

```
server/
├── controllers/
│   ├── handleAnswerCard.ts             // student commits an answer; updates mastery + grants badges
│   ├── handleCompleteSession.ts        // session end; streak, totals, per-deck leaderboard (ecosystem only)
│   ├── handleDeleteDeck.ts
│   ├── handleGetConfig.ts              // merged view: decks (eco + user) + visitor study data + badges
│   ├── handleGetDeck.ts                // single deck with this visitor's mastery
│   ├── handleSaveDeck.ts               // create or update (draft/published); routes by scope
│   ├── handleStartSession.ts           // mints sessionId, returns chosen card sequence
│   └── index.ts
├── utils/
│   ├── awardBadge.ts                   // boilerplate helper
│   ├── computeNextCards.ts             // spaced-repetition selection (§8); quiz-mode also builds distractors
│   ├── decks/
│   │   ├── fetchDecks.ts               // fetchEcosystemDecks / fetchUserDecks; pruneNullEntries
│   │   ├── saveDeck.ts                 // buildDeckFromInput + scope-aware writer
│   │   └── index.ts
│   ├── evaluateBadges.ts               // pure: which badges should this visitor have?
│   ├── getBadges.ts                    // ecosystem inventory lookup
│   ├── getCredentials.ts               // protected
│   ├── getVisitor.ts
│   ├── getVisitorBadges.ts
│   ├── inventoryCache.ts
│   ├── results.ts                      // updateDeckResult — writes deck.results[profileId]
│   ├── sessionStore.ts                 // in-memory session map (cardSeq + answers)
│   ├── streak.ts                       // pure: applyDailyStreak(prev, today)
│   ├── topiaInit.ts
│   └── index.ts
├── tests/
│   ├── computeNextCards.test.ts
│   └── evaluateBadges.test.ts
├── routes.ts
└── index.ts                            // protected
```

### Client

```
client/src/
├── pages/
│   ├── Home.tsx                        // tabs: Library | Progress | Badges. Owns picking/playing/creating/studying state.
│   ├── Study.tsx                       // in-session state machine; renders mode sub-views
│   ├── Error.tsx
│   └── index.ts
├── components/
│   ├── BadgesTab.tsx
│   ├── CardEditor.tsx                  // single card row inside EditDeck
│   ├── Confetti.tsx
│   ├── ConfirmationModal.tsx
│   ├── Deck.tsx                        // deck card in the Library (formerly DeckCard)
│   ├── EditDeck.tsx                    // deck metadata + cards list (used for both scopes)
│   ├── EndOfSession.tsx                // session summary screen
│   ├── FlipCard.tsx
│   ├── IconButton.tsx
│   ├── ImportCardsModal.tsx            // paste/CSV bulk import
│   ├── Library.tsx                     // groups: "Class decks" + "My decks"
│   ├── Loading.tsx
│   ├── MasteryRing.tsx
│   ├── PageContainer.tsx               // protected; no gear icon (admin view was removed)
│   ├── ProgressTab.tsx
│   ├── QuizCard.tsx                    // shared by quiz and sprint
│   ├── SelectedDeckModal.tsx           // portal-mounted modal; mode picker + edit/delete/analytics icons
│   ├── SprintHUD.tsx
│   ├── StatCard.tsx
│   ├── StreakRing.tsx
│   └── index.ts
├── context/
│   ├── GlobalContext.tsx
│   ├── reducer.ts                      // SET_CONFIG, SET_DECKS, SET_VISITOR_DATA, SET_MUTED, SET_SESSION, CLEAR_SESSION, SET_ERROR
│   └── types.ts
├── utils/
│   ├── backendAPI.ts                   // protected
│   ├── openResultsInNewTab.ts          // canonical results-export pattern
│   ├── setErrorMessage.ts              // protected
│   ├── sounds.ts
│   ├── useClickOnce.ts                 // rage-click guard (used on mode-card buttons only — see note)
│   └── index.ts
└── styles/
    ├── tokens.css
    └── components.css                  // .ss-* classes (card flip, mastery ring, streak pulse, modal theme)
```

**`useClickOnce` note**: the guard is shared per-component, so it locks the _whole component_'s guarded button set on first use. It belongs on actions that fire a non-idempotent async side effect (the three mode-card buttons start a server session). Synchronous state transitions (Edit / Delete / Close / View Analytics inside `SelectedDeckModal`) intentionally skip the guard — they're cheap to retry and sharing the lock with the mode cards could strand the user if the parent didn't unmount the modal in the same tick.

### API endpoints

```ts
// GET /api/config
// Response: {
//   success: true,
//   ecosystemDecks: DeckType[];        // drafts hidden from non-admins
//   userDecks: DeckType[];             // this visitor's own
//   visitorStudyData: VisitorStudyDataType;
//   badges: BadgeRecordType;
//   visitorInventory: VisitorBadgeRecordType;
//   isAdmin: boolean;
// }

// POST /api/decks                            (admin for ecosystem; owner-implicit for user)
// Body: { deck: Partial<DeckType> }          // scope determines target data object
// Response: { success: true, deck: DeckType }

// DELETE /api/decks/:deckId?scope=...        (admin for ecosystem; owner-implicit for user)
// Response: { success: true }

// GET /api/decks/:deckId
// Response: { success: true, deck: DeckType, mastery: { [cardId]: CardMasteryType } }

// POST /api/session/start
// Body: { deckId, mode, scope }
// Response: { success: true, sessionId, cards: CardType[] }
//   The server picks the card sequence via computeNextCards and, for quiz/sprint,
//   includes 3 distractors per card so the client can't peek.

// POST /api/session/answer
// Body: { sessionId, cardId, mode, rating? | isCorrect?, msTaken }
// Response: { success: true, masteryAfter: 0|1|2|3|4|5 }

// POST /api/session/complete
// Body: { sessionId }
// Response: { success: true, summary: SessionSummaryType }
//   For ecosystem-scope sessions also writes deck.results[profileId] = "{name}|{n+1}".
```

### State management

- `GlobalContext` matches the `/api/config` envelope: `ecosystemDecks`, `userDecks`, `visitorStudyData`, `badges`, `visitorInventory`, `isAdmin`, plus a transient `session` slice for the in-progress sitting and a `muted` toggle.
- Mutations dispatch after the corresponding backend call returns. No optimistic mastery updates — server is authoritative.
- `Home.tsx` owns the user-facing state machine (`pickingDeckId` / `playingMode` / `creatingDeck` / `studyingDeckId`). `Study.tsx` owns the in-session machine (`in-session` → `ended`); the old `picking-mode` phase moved up to `Home` so the picker can overlay the Library.

## 8. Spaced Repetition

`server/utils/computeNextCards.ts` — small, explainable SM-2-ish ranker:

```ts
const recencyPenalty = (lastSeenAt: number) => {
  const days = (Date.now() - lastSeenAt) / 86_400_000;
  return Math.min(2, days / 3);
};

const priority = (m: CardMasteryType) => (5 - m.mastery) * 2 + m.timesWrong + recencyPenalty(m.lastSeenAt);
```

Notes:

- Pure, table-tested (`server/tests/computeNextCards.test.ts`).
- Sprint mode bypasses the priority and just shuffles the full deck.
- Quiz mode builds the 3 distractors per card in this same step so the payload sent to the client doesn't have to include any "is this the answer?" signal beyond the card sequence. Distractors are deduped case-insensitively against the correct answer and against each other (fixes the "4+4 = 8" double-option bug).

## 9. Badge Catalog

Names are exported as a typed const at the bottom of `StudyStacksTypes.ts` (`STUDY_STACK_BADGES`). Badge images, descriptions, and ecosystem unique names are configured in the Topia ecosystem inventory — never hard-coded.

| Const           | Name          | Trigger                                                 |
| --------------- | ------------- | ------------------------------------------------------- |
| `FIRST_STEP`    | First Step    | Complete your first session.                            |
| `BOOKWORM`      | Bookworm      | 50 cards studied lifetime.                              |
| `SCHOLAR`       | Scholar       | 250 cards studied lifetime.                             |
| `MASTER`        | Master        | 1000 cards studied lifetime.                            |
| `DECK_DONE`     | Deck Done     | Reach mastery 5 on every card in any deck.              |
| `POLYGLOT`      | Polyglot      | Earn Deck Done on decks in 3 different subjects.        |
| `COMEBACK_KID`  | Comeback Kid  | Move a card from mastery 0 or 1 to mastery 5.           |
| `STREAKER`      | Streaker      | 7-day streak.                                           |
| `MARATHONER`    | Marathoner    | 30-day streak.                                          |
| `SPEED_DEMON`   | Speed Demon   | Score 20+ in Sprint mode.                               |
| `PERFECTIONIST` | Perfectionist | Finish a Quiz session with 100% correct and ≥ 10 cards. |

Eligibility logic is centralized in `utils/evaluateBadges.ts` and called from `handleCompleteSession`/`handleAnswerCard`. Idempotent — the helper short-circuits if the visitor already has the badge.

## 10. Testing

- **`server/tests/computeNextCards.test.ts`** — priority + ordering for all-new, mixed, and stale decks; plus the quiz distractor dedup.
- **`server/tests/evaluateBadges.test.ts`** — boundary tests for each badge in §9.
- **Mocks** — `server/mocks/@rtsdk/topia.ts` mocks Visitor, Ecosystem, DroppedAsset, World.
- **Client** — manual testing of the three study modes, reduced-motion, and keyboard-only nav.

## 11. Validation Checklist

- [ ] All user stories in §6 meet their acceptance criteria.
- [ ] Library and Study screens usable with keyboard alone.
- [ ] Every motion has a `prefers-reduced-motion` fallback.
- [ ] WCAG 2.1 AA contrast.
- [ ] All buttons use `.btn` classes; chrome typography uses SDK classes.
- [ ] All API endpoints return the standard `{ success, ... }` envelope.
- [ ] No optimistic UI for mastery — every change is server-committed first.
- [ ] No relative imports; only aliased paths.
- [ ] Server tests cover the route matrix; pure utilities have unit tests.

## 12. Future Iterations

- **Audio cards** — image landed in v1; audio is the next step (S3 pattern from `sdk-scavenger-hunt`).
- **Match mode** — drag-and-drop pairing UI; works best on tablet/desktop, falls back to tap-pair on mobile.
- **Daily review** — server-curated mixed-deck session of "cards likely to be forgotten today" pulled from across all the visitor's decks (ecosystem + user).
- **AI tutor NPC** — spawn an NPC built on `sdk-npc-voice-session`, pre-loaded with the active deck's content. Use this app's per-app guardrails layered with Topia's platform preamble.
- **Multiplayer study race** — 2–4 visitors study the same ecosystem deck in real time over SSE (see `sdk-ring-toss/server/utils/sseManager.ts`). First to mastery wins a "Study Champion" badge.

## 13. Notable Departures From The Original Plan

For anyone cross-referencing earlier docs or commits, here's what changed during build and why:

- **No Admin view.** The original plan had a gear icon → AdminView tab → DecksList. Almost every action that lived there was also reachable from the per-deck flow, so the entire Admin view was removed. Edit / Delete / View Analytics moved into the `SelectedDeckModal` header, gated by `canEdit(deck)` and `canViewAnalytics(deck)`.
- **No per-asset aggregate results table.** Replaced with a per-deck leaderboard (`deck.results[profileId] = "{name}|{n}"`) opened in a new browser tab via `openResultsInNewTab` — the canonical "give the admin a results export" pattern.
- **No CSV download.** Same reason — superseded by the printable HTML view.
- **No `createdAt` / `updatedAt` on decks.** Unused everywhere they were written, so removed.
- **Type-suffix rename.** Every exported interface/alias gained a `*Type` suffix to match the convention used across `topia-sdk-apps`.
- **`grades` `"all"` sentinel.** Ecosystem decks default to `"all"`; only an explicit subset is stored as a `GradeType[]`. Helpers `expandGrades`/`normalizeGrades`/`isAllGrades` keep the rest of the code from caring about the encoding.
- **`useClickOnce` scope tightened.** Originally wrapping every guarded button in the modal; now only wraps the mode-card buttons (the only ones that fire a non-idempotent async side effect).
- **Decks live on Ecosystem + Visitor data objects, not the key asset.** Cross-world reach was a requirement and the key asset is per-drop, so the original "everything on the key asset" plan didn't fit.

## 14. Post-Implementation Finalization

- **README**: see `README.md` — rewritten for Study Stacks specifically.
- **CLAUDE.md**: see `CLAUDE.md` — points at `../sdk-ai-boilerplate/.ai/` as canonical source.
- **Required dropped asset**: `StudyStacks_keyAsset` (unique name).
- **Ecosystem badges**: see §9 — provision the names listed there on the ecosystem inventory.
