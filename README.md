# Study Stacks

A teacher-customizable flash-card study app for Topia worlds. Teachers ("admins") build decks of study cards; students walk up to the Study Stacks desk and drop into a focused study session with spaced repetition, streaks, and badges. Designed to feel as quick and habit-forming as Duolingo or Quizlet while staying inside a Topia world.

## Introduction / Summary

Study Stacks is a single-player learning loop with three study modes (Flip, Quiz, Sprint), per-card mastery, daily streaks, and 11 ecosystem badges. Decks are authored per dropped asset, so a teacher can drop one Study Stacks desk per classroom and load it with curriculum-specific content.

## Key Features

### Student experience

- **Library tab** — published decks with per-deck mastery rings.
- **Three study modes**:
  - **Flip** — read the front, recall, tap to flip, self-rate (Got it / Almost / Missed).
  - **Quiz** — 4-button multiple choice; decks with < 4 cards fall back to True/False.
  - **Sprint** — 60-second timed Quiz-style challenge with a pulsing timer.
- **Spaced repetition** — server picks each session's cards using a small, explainable SM-2-style algorithm that surfaces low-mastery, recently-wrong, and stale cards.
- **Streak ring** — persistent indicator of the visitor's current daily streak.
- **End-of-session screen** — concrete numbers, streak callout, new-badge celebration, and a "Study again" CTA.
- **Reduced motion / mute** — every animation respects `prefers-reduced-motion`; the only sound (a soft chime on correct flips) is gated behind a header mute toggle.

### Teacher (admin) experience

- **Decks tab** (gear icon on the key asset) — create / edit / duplicate / publish / unpublish / delete decks.
- **Card editor** — front, back, optional hint; reorder via up/down buttons; deletes from a published deck prompt for confirmation.
- **Results tab** — sortable per-student table (current streak, total sessions, most-studied deck, last active) with a CSV export for full rosters.
- **Server-enforced gates** — admin-only routes 403 non-admins; decks cap at 100 cards; publishing requires a title + ≥1 grade + ≥1 valid card.

### Engagement mechanics

- 3D card flip on tap; horizontal feedback on Quiz wrong answers reveals the correct back so students still learn.
- Correct-flip micro-celebration (green burst + optional soft chime).
- Streak pulse on increment; badge grants fire a Topia toast + `explosion_float` particle.
- No anxiety patterns — no shake on wrong, no leaderboard shaming, encouragement framing on errors.

## Required Assets with Unique Names

Study Stacks uses the dropped asset that triggered the iframe as the "key asset" for that instance. Multiple desks per world are supported — each desk has its own decks and its own per-visitor mastery.

| Unique Name Pattern    | Description                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StudyStacks_keyAsset` | (Convention) Unique name to give the desk so future versions of the app can support cross-asset lookups. Optional for v1 — the iframe-launching asset is used directly. |

### Ecosystem badges (provision in your Topia ecosystem)

The app calls `Ecosystem.grantInventoryItem` with the exact `name` strings below. Provision a BADGE item for each one to enable that badge. If a badge isn't provisioned, the eligibility check still runs but the grant is a no-op (logged warning) — students simply won't see that badge in the catalog until it's provisioned.

| Unique name (placeholder) | Title         | Trigger                                                      |
| ------------------------- | ------------- | ------------------------------------------------------------ | --- |
| `FirstStep`               | First Step    | Complete your first session.                                 |
| `Bookworm`                | Bookworm      | 50 cards studied lifetime.                                   |
| `Scholar`                 | Scholar       | 250 cards studied lifetime.                                  |
| `Master`                  | Master        | 1,000 cards studied lifetime.                                |
| `DeckDone`                | Deck Done     | Reach mastery 5 on every card in any deck.                   |
| `Polyglot`                | Polyglot      | Earn Deck Done on decks in 3 different subjects.             |
| `ComebackKid`             | Comeback Kid  | Move a card from mastery 0 or 1 to mastery 5 in one session. |     |
| `SpeedDemon`              | Speed Demon   | Score 20+ correct in one Sprint session.                     |
| `Perfectionist`           | Perfectionist | 100% accuracy on a Quiz session of 10+ cards.                |

## Technical Architecture

### Data Objects

#### Key asset (the dropped desk)

```ts
{
  decks: { [deckId: string]: Deck },     // teacher-authored content
  results: { [profileId: string]: AssetResultsRow },  // aggregate per-student data
  leaderboard: { [profileId: string]: string },       // reserved (future)
}
```

A `Deck` has `id`, `title`, `subject`, `grades`, `difficulty`, `status` ("draft" | "published"), `cards`, and authorship metadata. A `Card` has `id`, `front`, `back`, and optional `hint`.

#### Visitor / User

```ts
{
  decks: { [deckId]: { cards: { [cardId]: CardMastery }, sessionsCompleted, lastStudiedAt } },
  streak: { current, longest, lastDay },        // lastDay is YYYY-MM-DD in UTC
  totalCardsStudied: number,
  totalSessionsCompleted: number,
}
```

#### World

Not used. (The v1 simple-key-asset pattern doesn't need a world-level pointer.)

### Spaced repetition

`server/utils/computeNextCards.ts` is a small, explainable SM-2-style ranker:

- `priority(card) = (5 - mastery) * 2 + timesWrong + recencyPenalty(lastSeenAt)`
- `recencyPenalty` ramps from 0 to a cap of 2 as days-since-last-seen grows past 6.
- For **Sprint**, the algorithm is bypassed — the deck is shuffled and looped until the timer expires.
- For **Quiz**, three distractors are sampled server-side per card so the client never sees an answer it doesn't render.

### Badge evaluation

`server/utils/evaluateBadges.ts` is a pure function over `studyDataAfter` + the session result + the full decks map. It produces the set of badges the visitor newly qualifies for, then `awardBadge` grants each one idempotently (no-op if the visitor already owns it).

### Mastery Mechanics

#### 1\. The unit: per-card mastery (0–5)

---

Every card you study carries a mastery level from **0 to 5** ([MasteryLevel](vscode-webview://0s4ueo536ddmrc7afvu7l721el1sgkec3lagnjkqou5go1bf91hn/topia-sdk-apps/sdk-study-stacks/shared/types/StudyStacksTypes.ts) is typed 0|1|2|3|4|5). It changes each time you answer that card, in [handleAnswerCard.ts](vscode-webview://0s4ueo536ddmrc7afvu7l721el1sgkec3lagnjkqou5go1bf91hn/topia-sdk-apps/sdk-study-stacks/server/controllers/handleAnswerCard.ts), then is clamped back into 0–5:

| Mode   | Result   | Mastery         |
| ------ | -------- | --------------- |
| Flip   | ✓ Got it | **+2**          |
| Flip   | ◐ Almost | 0               |
| Flip   | ✗ Missed | −1              |
| Quiz   | correct  | **+1**          |
| Quiz   | wrong    | −1              |
| Sprint | correct  | **+1**          |
| Sprint | wrong    | 0 (never drops) |

newMastery = clamp(0, 5, prev + delta).

**A card is "mastered" when its mastery hits 5.** Starting from 0, that takes:

- **3** "Got it"s in Flip (0→2→4→5, the last +2 clamps at 5),
- **5** correct answers in Quiz or Sprint.

Wrong answers can knock a card back down (except Sprint, which only ever holds or raises).

#### 2\. Deck-level "mastered"

---

This shows up in two distinct places:

**a) The mastery % ring on each deck card** ([DeckCard.tsx](vscode-webview://0s4ueo536ddmrc7afvu7l721el1sgkec3lagnjkqou5go1bf91hn/topia-sdk-apps/sdk-study-stacks/client/src/components/DeckCard.tsx#L24-L31)) is an _average across all cards_:

mastery% = (sum of every card's mastery) / (cardCount × 5) × 100 `

So the ring reads 100% only when **every card is at level 5**. It's a continuous progress indicator, not a pass/fail flag.

**b) "Fully mastered" for the Deck Done badge** ([evaluateBadges.ts](vscode-webview://0s4ueo536ddmrc7afvu7l721el1sgkec3lagnjkqou5go1bf91hn/topia-sdk-apps/sdk-study-stacks/server/utils/evaluateBadges.ts#L36-L45)) — the strict definition:

> A deck is fully mastered when it has at least one card **and every card's mastery ≥ 5.**

This is evaluated server-side at the end of each session ([handleCompleteSession.ts](vscode-webview://0s4ueo536ddmrc7afvu7l721el1sgkec3lagnjkqou5go1bf91hn/topia-sdk-apps/sdk-study-stacks/server/controllers/handleCompleteSession.ts)). When it's true:

- you earn the **Deck Done** badge, and
- if you've fully mastered decks across **3+ different subjects**, you also earn **Polyglot**.

Both definitions agree: a deck is "mastered" ⟺ 100% ring ⟺ all cards at level 5.

## API Endpoints

All routes accept the standard Topia session credentials (assetId, interactiveNonce, interactivePublicKey, profileId, sceneDropId, urlSlug, visitorId, …) via query parameters — `client/src/utils/backendAPI.ts` attaches them automatically.

| Method   | Route                   | Description                                                                          | Admin? |
| -------- | ----------------------- | ------------------------------------------------------------------------------------ | ------ |
| `GET`    | `/api/config`           | Merged config: decks (drafts hidden from students), visitor study data, badges, etc. | —      |
| `GET`    | `/api/decks/:deckId`    | One deck + this visitor's mastery for it.                                            | —      |
| `POST`   | `/api/decks`            | Create or update a deck. Body: `{ deck }`.                                           | Admin  |
| `DELETE` | `/api/decks/:deckId`    | Delete a deck (visitor mastery is preserved).                                        | Admin  |
| `POST`   | `/api/session/start`    | Mint a sessionId and return the chosen card sequence. Body: `{ deckId, mode }`.      | —      |
| `POST`   | `/api/session/answer`   | Record one card answer; returns the updated mastery.                                 | —      |
| `POST`   | `/api/session/complete` | Finalize the session, update streak/aggregates, evaluate badges.                     | —      |
| `GET`    | `/api/system/health`    | Health check (build version + env names).                                            | —      |

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

This project uses the Topia SDK's CSS classes for chrome (`.btn`, `.card`, `.input`, `.h1`-`.h4`, `.p1`-`.p4`), layered with Tailwind for layout via CSS cascade layers (`@layer tailwind, sdk;`). App-specific component classes are prefixed `.ss-*` and live unlayered in `client/src/styles/components.css`. Design tokens (`--ss-*`) live in `client/src/styles/tokens.css`.

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
- Plan for this app: [`.ai/templates/plan.md`](.ai/templates/plan.md)
- Style guide: [`.ai/style-guide.md`](.ai/style-guide.md) · Accessibility: [`.ai/accessibility.md`](.ai/accessibility.md)
