# Study Stacks

A customizable flash-card study app where teachers ("admins") publish class-wide decks and any visitor can also build their own personal decks.

## Introduction / Summary

Study Stacks is a single-player learning loop with three study modes (Flip, Quiz, Sprint), per-card mastery, daily streaks, and ecosystem badges. Decks come in two flavors: **ecosystem decks** (admin-authored, account-wide, every visitor sees them) and **user decks** (visitor-authored, cross-world, private to the owner). Both kinds live side-by-side in the same Library.

## Key Features

### One unified Library

Students and admins use the same Library. Eligibility-gated actions show or hide inside the per-deck modal based on `isAdmin` and the deck's `scope` — there is no separate Admin view.

- **Class decks** — every ecosystem deck (drafts hidden from non-admins).
- **My decks** — the visitor's own user decks (always visible to them, drafts included).
- **+ Create a new deck** — open to every visitor; creates a user-scoped deck by default. Admins can flip the scope to `ecosystem` inside EditDeck.

### Per-deck action modal (`SelectedDeckModal`)

Clicking any deck opens a portal-mounted modal whose header shows the deck title, card count, and difficulty, plus an icon row of whichever of these the current visitor is allowed:

- **View Analytics** — admin + ecosystem only. Opens a printable per-student leaderboard in a new browser tab via [`openResultsInNewTab`](client/src/utils/openResultsInNewTab.ts) — the canonical "give the admin a results export" pattern across Topia SDK apps (replaces CSV download).
- **Edit** — owner gate: user decks for their owner, ecosystem decks for admins. Switches to the EditDeck screen.
- **Delete** — same gate as Edit. Opens an inline `ConfirmationModal`; on confirm the DELETE fires and the dispatch updates from inside the modal itself.

Below the icon row are the three mode cards: **Flip**, **Quiz**, **Sprint**. Pick one → modal closes, the study session starts.

### Three study modes

- **Flip** — read the front (text + optional image), recall, tap to flip, self-rate (Got it / Almost / Missed).
- **Quiz** — multiple choice with the correct back + up to 3 distractors sampled from sibling cards. Decks with fewer cards still render the same UI with whatever distractors are available. Distractors are deduped case-insensitively (so a `"4+4 → 8"` and `"2+6 → 8"` pair won't produce two "8" options).
- **Sprint** — 60-second timed Quiz-style challenge with a pulsing timer.

### Spaced repetition

Server picks each session's cards using a small, explainable SM-2-style algorithm — see [Spaced repetition](#spaced-repetition).

### Engagement mechanics

- 3D card flip on tap; correct-flip micro-celebration (green burst + optional soft chime).
- Wrong-answer feedback reveals the correct back so students still learn.
- Streak ring visible during a session; pulses on increment.
- Badge grants fire a Topia toast.
- End-of-session screen with concrete numbers, streak callout, new-badge celebration, and a "Study Again" CTA that re-opens the mode picker for the same deck.
- **Mute toggle** in the Home greeting; **`prefers-reduced-motion`** disables every animation.

### Editing

- **CardEditor** — front (text + optional image URL), back, optional hint; reorder via up/down buttons.
- **ImportCardsModal** — bulk-paste / CSV import for large decks.
- Save is blocked when the deck has zero cards OR any incomplete card; the form names the offenders. A card is "complete" when it has a back **and** either front text or a front image URL (`isCardComplete` in [shared types](shared/types/StudyStacksTypes.ts)).
- Decks cap at 100 cards (`MAX_CARDS_PER_DECK`), server-enforced.
- Grades only apply to ecosystem decks. Ecosystem decks default to the `"all"` sentinel; an explicit `GradeType[]` is stored only when you pick a real subset. Helpers `expandGrades` / `normalizeGrades` / `isAllGrades` keep the rest of the code from caring about the encoding.

## Required Assets with Unique Names

Study Stacks uses the dropped asset that triggered the iframe as the entry point for the app. Decks **do not live on the key asset** — ecosystem decks live on the ecosystem data object (account-wide), and user decks live on the visitor data object (cross-world per visitor). That means dropping multiple Study Stacks desks in one world is fine: they all show the same decks and the same per-visitor mastery.

| Unique Name Pattern    | Description                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `StudyStacks_keyAsset` | (Convention) Unique name to give the desk. Optional today — the iframe-launching asset is used directly; this is reserved for v2+. |

### Ecosystem badges (provision in your Topia ecosystem)

The app calls `Ecosystem.grantInventoryItem` with the exact `name` strings below. Provision a BADGE item for each one to enable that badge. If a badge isn't provisioned, the eligibility check still runs but the grant is a no-op (logged warning) — students simply won't see that badge in the catalog until it's provisioned.

| Unique name (placeholder) | Title         | Trigger                                                      |
| ------------------------- | ------------- | ------------------------------------------------------------ |
| `FirstStep`               | First Step    | Complete your first session.                                 |
| `Bookworm`                | Bookworm      | 50 cards studied lifetime.                                   |
| `Scholar`                 | Scholar       | 250 cards studied lifetime.                                  |
| `Master`                  | Master        | 1,000 cards studied lifetime.                                |
| `DeckDone`                | Deck Done     | Reach mastery 5 on every card in any deck.                   |
| `Polyglot`                | Polyglot      | Earn Deck Done on decks in 3 different subjects.             |
| `ComebackKid`             | Comeback Kid  | Move a card from mastery 0 or 1 to mastery 5 in one session. |
| `Streaker`                | Streaker      | 7-day streak.                                                |
| `Marathoner`              | Marathoner    | 30-day streak.                                               |
| `SpeedDemon`              | Speed Demon   | Score 20+ correct in one Sprint session.                     |
| `Perfectionist`           | Perfectionist | 100% accuracy on a Quiz session of 10+ cards.                |

## Technical Architecture

### Data Objects

Study Stacks lives on two SDK-owned data objects. Nothing on the key asset, nothing on the world.

#### Ecosystem data object (account-wide)

```ts
{
  studyStacksDecks: { [deckId: string]: DeckType },  // every ecosystem deck
}
```

Each ecosystem `DeckType` carries its own `results` map for the per-deck leaderboard:

```ts
deck.results = { [profileId: string]: "{displayName}|{sessions}" }
```

(Pipe-delimited string, mirroring the leaderboard convention used elsewhere in the stack.)

#### Visitor data object (per visitor, cross-world)

```ts
{
  studyStacksDecks: { [deckId: string]: DeckType },     // this visitor's personal decks
  studyStacksData: {
    decks: { [deckId]: { cards: { [cardId]: CardMasteryType }, sessionsCompleted, lastStudiedAt } },
    streak: { current, longest, lastDay },              // lastDay is YYYY-MM-DD in UTC
    totalCardsStudied: number,
    totalSessionsCompleted: number,
  },
}
```

#### Deck and Card shape

A `DeckType` has `id`, `scope` (`"user"` | `"ecosystem"`), `title`, `subject`, `difficulty`, `status` (`"draft"` | `"published"`), and `cards`. Ecosystem decks additionally carry `grades`, `createdByProfileId`, `createdByDisplayName`, and `results`. User decks omit those four fields entirely.

A `CardType` has `id`, `front`, `back`, optional `hint`, and optional `imageUrl` (http(s) only; sanitized server-side).

Full definitions and helpers (`expandGrades`, `normalizeGrades`, `isAllGrades`, `isCardComplete`, `parseDeckResultsValue`, `formatDeckResultsValue`, `STUDY_STACK_BADGES`) live in [`shared/types/StudyStacksTypes.ts`](shared/types/StudyStacksTypes.ts).

### Spaced repetition

[`server/utils/computeNextCards.ts`](server/utils/computeNextCards.ts) is a small, explainable SM-2-style ranker:

- `priority(card) = (5 - mastery) * 2 + timesWrong + recencyPenalty(lastSeenAt)`
- `recencyPenalty` ramps from 0 to a cap of 2 as days-since-last-seen grows past 6.
- For **Flip / Quiz**, the top-N cards by priority are picked.
- For **Sprint**, the priority is bypassed — the deck is shuffled and looped until the timer expires.
- For **Quiz**, three distractors are sampled server-side per card so the client never sees an answer it doesn't render. Distractors are deduped against the correct answer AND against each other (case-insensitive trim).

### Badge evaluation

[`server/utils/evaluateBadges.ts`](server/utils/evaluateBadges.ts) is a pure function over `studyDataAfter` + the session result + the full decks map. It produces the set of badges the visitor newly qualifies for, then `awardBadge` grants each one idempotently (no-op if the visitor already owns it).

### Mastery Mechanics

#### 1. The unit: per-card mastery (0–5)

Every card you study carries a mastery level from **0 to 5** ([`MasteryLevelType`](shared/types/StudyStacksTypes.ts) is typed `0|1|2|3|4|5`). It changes each time you answer that card, in [handleAnswerCard.ts](server/controllers/handleAnswerCard.ts), then is clamped back into 0–5:

| Mode   | Result   | Mastery         |
| ------ | -------- | --------------- |
| Flip   | ✓ Got it | **+2**          |
| Flip   | ◐ Almost | 0               |
| Flip   | ✗ Missed | −1              |
| Quiz   | correct  | **+1**          |
| Quiz   | wrong    | −1              |
| Sprint | correct  | **+1**          |
| Sprint | wrong    | 0 (never drops) |

`newMastery = clamp(0, 5, prev + delta)`.

**A card is "mastered" when its mastery hits 5.** Starting from 0, that takes:

- **3** "Got it"s in Flip (0→2→4→5, the last +2 clamps at 5),
- **5** correct answers in Quiz or Sprint.

Wrong answers can knock a card back down (except Sprint, which only ever holds or raises).

#### 2. Deck-level "mastered"

This shows up in two distinct places:

**a) The mastery % ring on each deck card** ([Deck.tsx](client/src/components/Deck.tsx)) is an _average across all cards_:

```
mastery% = (sum of every card's mastery) / (cardCount × 5) × 100
```

So the ring reads 100% only when **every card is at level 5**. It's a continuous progress indicator, not a pass/fail flag.

**b) "Fully mastered" for the Deck Done badge** ([evaluateBadges.ts](server/utils/evaluateBadges.ts)) — the strict definition:

> A deck is fully mastered when it has at least one card **and every card's mastery ≥ 5.**

This is evaluated server-side at the end of each session ([handleCompleteSession.ts](server/controllers/handleCompleteSession.ts)). When it's true:

- you earn the **Deck Done** badge, and
- if you've fully mastered decks across **3+ different subjects**, you also earn **Polyglot**.

Both definitions agree: a deck is "mastered" ⟺ 100% ring ⟺ all cards at level 5.

## API Endpoints

All routes accept the standard Topia session credentials (assetId, interactiveNonce, interactivePublicKey, profileId, sceneDropId, urlSlug, visitorId, …) via query parameters — [`client/src/utils/backendAPI.ts`](client/src/utils/backendAPI.ts) attaches them automatically.

| Method   | Route                   | Body / Query                                                  | Description                                                                                                      | Admin gate?    |
| -------- | ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| `GET`    | `/api/config`           | —                                                             | Merged config: ecosystem decks (drafts hidden from non-admins), user decks, visitor study data, badges, isAdmin. | —              |
| `GET`    | `/api/decks/:deckId`    | `?scope=user\|ecosystem`                                      | One deck + this visitor's mastery for it.                                                                        | —              |
| `POST`   | `/api/decks`            | `{ deck, scope }`                                             | Create or update a deck. Routes to the right data object by `scope`.                                             | Ecosystem only |
| `DELETE` | `/api/decks/:deckId`    | `?scope=user\|ecosystem`                                      | Delete a deck. (Visitor mastery is keyed by `cardId` and is preserved.)                                          | Ecosystem only |
| `POST`   | `/api/session/start`    | `{ deckId, mode, scope }`                                     | Mint a sessionId and return the chosen card sequence (plus distractors for quiz/sprint).                         | —              |
| `POST`   | `/api/session/answer`   | `{ sessionId, cardId, mode, rating? \| isCorrect?, msTaken }` | Record one card answer; returns the updated mastery.                                                             | —              |
| `POST`   | `/api/session/complete` | `{ sessionId }`                                               | Finalize the session: update streak/totals, evaluate badges, write per-deck leaderboard row for ecosystem scope. | —              |
| `GET`    | `/api/system/health`    | —                                                             | Health check (build version + env names).                                                                        | —              |

Every endpoint returns `{ success: true, ...data }` on success or `{ success: false, message }` on failure (per `.ai/rules.md` RESPONSE SCHEMA).

### `forceRefreshInventory`

When ecosystem inventory is updated, append `?forceRefreshInventory=true` to the iframe URL — the client reads it from `useSearchParams` and forwards it to `/api/config`, which busts the 6-hour ecosystem inventory cache.

## Environment Variables

Create a `.env` file in the repo root (one level above this app's directory).

| Variable             | Description                                                                        | Required |
| -------------------- | ---------------------------------------------------------------------------------- | -------- |
| `INTERACTIVE_KEY`    | Topia interactive app key                                                          | Yes      |
| `INTERACTIVE_SECRET` | Topia interactive app secret                                                       | Yes      |
| `INSTANCE_DOMAIN`    | Topia API domain (`api.topia.io` for production, `api-stage.topia.io` for staging) | Yes      |
| `INSTANCE_PROTOCOL`  | `https` for production/staging, `http` only for local                              | Yes      |
| `NODE_ENV`           | Node environment                                                                   | No       |
| `PORT`               | Server port (defaults to `3000`)                                                   | No       |

`INTERACTIVE_KEY` / `INTERACTIVE_SECRET` come from the [Topia integrations dashboard](https://topia.io/t/dashboard/integrations) (or [dev dashboard](https://dev.topia.io/t/dashboard/integrations) for staging).

## Getting Started

```bash
# from this app's root
npm install
cd client && npm install && cd ../server && npm install && cd ..

# create a .env one level above the app root, populated with the variables above

# run the dev server (Vite client + Express server concurrently)
npm run dev

# server-only
npm run dev --workspace=server

# run server tests (Jest)
npm --prefix server test
```

## For Developers

### Built With

#### Client

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

#### Server

![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white)
![Jest](https://img.shields.io/badge/jest-%23C21325.svg?style=for-the-badge&logo=jest&logoColor=white)

### Styling

This project uses the Topia SDK's CSS classes for chrome (`.btn`, `.card`, `.input`, `.h1`–`.h4`, `.p1`–`.p4`), layered with Tailwind for layout via CSS cascade layers (`@layer tailwind, sdk;`). App-specific component classes are prefixed `.ss-*` and live unlayered in [`client/src/styles/components.css`](client/src/styles/components.css). Design tokens (`--ss-*`) live in [`client/src/styles/tokens.css`](client/src/styles/tokens.css).

### Accessibility

Every UI change must meet **WCAG 2.1 AA**. The Study Stacks UI in particular:

- All interactive elements are `<button>` / `<a>` / `<input>` with visible `:focus-visible` rings.
- Card flip + correct/wrong feedback all gate on `prefers-reduced-motion`.
- Min student body text 18px; admin authoring uses ~16px to fit the dense forms.
- Tap targets ≥ 44px in student flows.
- No information conveyed by color alone — correct/wrong always pair color with an icon and a text label.

### SDK fundamentals

If anything about how the SDK _works_ is unclear (Interactive Keys, JWT signing, iframes vs webhooks, session credentials, dropped-asset operations, backend validation), read [`.ai/sdk-fundamentals.md`](.ai/sdk-fundamentals.md).

### Helpful links

- [SDK Developer docs](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- Implementation reference: [`.ai/templates/plan.md`](.ai/templates/plan.md)
- Style guide: [`.ai/style-guide.md`](.ai/style-guide.md) · Accessibility: [`.ai/accessibility.md`](.ai/accessibility.md)
