import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BadgesTab, EditDeck, Library, SelectedDeckModal, PageContainer, ProgressTab } from "@/components";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { ErrorType, SET_CONFIG, SET_MUTED } from "@/context/types";
import { backendAPI, openResultsInNewTab, setErrorMessage } from "@/utils";
import Study from "./Study";
import type { DeckType, StudyModeType } from "@shared/types/StudyStacksTypes";

import mascotBlue from "@/assets/mascot_blue.png";

type StudentTab = "library" | "progress" | "badges";

const xpForLevel = (cards: number) => {
  const level = Math.floor(cards / 100) + 1;
  const into = cards % 100;
  return { level, into, max: 100 };
};

const blankUserDeck = (): DeckType => ({
  id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  scope: "user",
  title: "",
  subject: "other",
  difficulty: "medium",
  status: "draft",
  cards: [],
  // User decks intentionally omit `grades` and `createdBy*` — see Deck type.
});

export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { classDecks, userDecks, hasInteractiveParams, isAdmin, muted, visitorStudyData } =
    useContext(GlobalStateContext);

  const [searchParams] = useSearchParams();
  const forceRefreshInventory = searchParams.get("forceRefreshInventory") === "true";
  const displayName = searchParams.get("displayName") || searchParams.get("username") || "friend";

  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<StudentTab>("library");
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);
  const [creatingDeck, setCreatingDeck] = useState<DeckType | null>(null);
  // Mode selection lives at this level now (was inside Study): clicking a deck
  // in the Library sets `pickingDeckId`, which pops `<SelectedDeckModal>` as a modal
  // over the Library. Once the user picks a mode, both `playingMode` and
  // `studyingDeckId` get set together and Study mounts with the chosen mode.
  const [pickingDeckId, setPickingDeckId] = useState<string | null>(null);
  const [playingMode, setPlayingMode] = useState<StudyModeType | null>(null);

  useEffect(() => {
    if (!hasInteractiveParams) return;
    backendAPI
      .get("/config", { params: { forceRefreshInventory } })
      .then((res) => {
        if (res.data?.success) dispatch!({ type: SET_CONFIG, payload: res.data });
      })
      .catch((err) => setErrorMessage(dispatch, err as ErrorType))
      .finally(() => setIsLoading(false));
  }, [hasInteractiveParams, forceRefreshInventory, dispatch]);

  // Defensive `d &&` — a deleted deck can momentarily linger as a null slot
  // in the data object (Topia's delete-by-setting-null pattern). Guard keeps
  // this from crashing on a stale payload.
  const findDeckById = (id: string | null): DeckType | null =>
    id ? [...classDecks, ...userDecks].find((d) => d && d.id === id) || null : null;

  const studyingDeck = useMemo(
    () => findDeckById(studyingDeckId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classDecks, userDecks, studyingDeckId],
  );
  const pickingDeck = useMemo(
    () => findDeckById(pickingDeckId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classDecks, userDecks, pickingDeckId],
  );

  // Tint the whole app background to the selected deck's subject color. We theme
  // <body> (not an inner div) so the wash covers the full viewport behind the
  // page padding. Cleared when no deck is selected / on unmount.
  useEffect(() => {
    if (!studyingDeck) return;
    const subjectClass = `ss-body--${studyingDeck.subject}`;
    document.body.classList.add("ss-body--subject", subjectClass);
    return () => {
      document.body.classList.remove("ss-body--subject", subjectClass);
    };
  }, [studyingDeck]);

  const totalCards = visitorStudyData?.totalCardsStudied || 0;
  const xp = xpForLevel(totalCards);
  // const streak = visitorStudyData?.streak || { current: 0, longest: 0, lastDay: "" };
  const firstName = displayName.split(" ")[0];

  // User decks are always the current visitor's own, so they're always
  // editable; class decks are editable only by admins (matching the
  // server-side `isAdmin` gate for class scope).
  const canEdit = (deck: DeckType | null): boolean =>
    Boolean(deck && (deck.scope === "user" || (deck.scope === "class" && isAdmin)));

  // Per-deck analytics only exist for class decks — user decks don't
  // accumulate a leaderboard. Admin-gated to match the old AdminView access.
  const canViewAnalytics = (deck: DeckType | null): boolean => Boolean(deck && deck.scope === "class" && isAdmin);

  let content;
  if (studyingDeck) {
    content = (
      <Study
        deck={studyingDeck}
        mode={playingMode || "flip"}
        onExit={() => {
          setStudyingDeckId(null);
          setPlayingMode(null);
        }}
        onChangeMode={() => {
          // "Study again" — pop the mode picker back up for the same deck.
          setPickingDeckId(studyingDeck.id);
          setStudyingDeckId(null);
          setPlayingMode(null);
        }}
      />
    );
  } else if (creatingDeck) {
    content = <EditDeck initial={creatingDeck} onClose={() => setCreatingDeck(null)} />;
  } else {
    content = (
      <div className="ss-page ss-page-bg">
        <section className="ss-greeting" aria-label="Welcome">
          <div className="ss-greeting__text">
            <img
              src={mascotBlue}
              width={80}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ objectFit: "contain", display: "block" }}
            />
            <div>
              <div className="flex justify-between">
                <div>
                  <h1 className="ss-greeting__hi">Hi, {firstName}! </h1>
                  <p className="ss-greeting__sub">Ready to study?</p>
                </div>
                <div className="ss-greeting__right">
                  <div className="tooltip">
                    <div className="tooltip-content p3" style={{ top: "-20px" }}>
                      {muted ? "Unmute" : "Mute"}
                    </div>
                    <button
                      type="button"
                      className="btn btn-icon"
                      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                      aria-pressed={muted}
                      onClick={() => dispatch!({ type: SET_MUTED, payload: { muted: !muted } })}
                      style={{ height: "30px", padding: "0" }}
                    >
                      {muted ? "🔇" : "🔊"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="ss-xp" aria-label={`Level ${xp.level}, ${xp.into} of ${xp.max} cards to next level`}>
                <div className="ss-xp__label">
                  <span>Lv {xp.level}</span>
                  <span>
                    {xp.into} / {xp.max} cards
                  </span>
                </div>
                <div className="ss-xp__track">
                  <div className="ss-xp__fill" style={{ width: `${(xp.into / xp.max) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="ss-tab-bar" role="tablist" aria-label="Study Stacks sections">
          <button className="ss-tab" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>
            Library
          </button>
          <button className="ss-tab" role="tab" aria-selected={tab === "progress"} onClick={() => setTab("progress")}>
            Progress
          </button>
          <button className="ss-tab" role="tab" aria-selected={tab === "badges"} onClick={() => setTab("badges")}>
            Badges
          </button>
        </nav>

        <div role="tabpanel">
          {tab === "library" && (
            <Library onPick={(deckId) => setPickingDeckId(deckId)} onCreate={() => setCreatingDeck(blankUserDeck())} />
          )}
          {tab === "progress" && <ProgressTab />}
          {tab === "badges" && <BadgesTab />}
        </div>
      </div>
    );
  }

  return (
    <PageContainer isLoading={isLoading}>
      {content}
      {/* Mode picker overlays whatever `content` is — Library while studying,
          EndOfSession after "Study again", etc. createPortal handles the
          stacking so it sits above the page. */}
      {pickingDeck && (
        <SelectedDeckModal
          deck={pickingDeck}
          onPick={(mode) => {
            setPlayingMode(mode);
            setStudyingDeckId(pickingDeck.id);
            setPickingDeckId(null);
          }}
          onCancel={() => setPickingDeckId(null)}
          onViewAnalytics={canViewAnalytics(pickingDeck) ? () => openResultsInNewTab(pickingDeck) : undefined}
          onEdit={
            canEdit(pickingDeck)
              ? () => {
                  setCreatingDeck(pickingDeck);
                  setPickingDeckId(null);
                }
              : undefined
          }
          onDelete={canEdit(pickingDeck) ? () => setPickingDeckId(null) : undefined}
        />
      )}
    </PageContainer>
  );
};

export default Home;
