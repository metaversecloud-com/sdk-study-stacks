import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { BadgesTab, EditDeck, Library, Mascot, PageContainer, ProgressTab } from "@/components";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import { ErrorType, SET_CONFIG, SET_MUTED } from "@/context/types";
import { backendAPI, setErrorMessage } from "@/utils";
import Study from "./Study";
import type { Deck } from "@shared/types/StudyStacksTypes";

type StudentTab = "library" | "progress" | "badges";

const xpForLevel = (cards: number) => {
  const level = Math.floor(cards / 100) + 1;
  const into = cards % 100;
  return { level, into, max: 100 };
};

const blankUserDeck = (profileId: string, displayName: string): Deck => ({
  id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  scope: "user",
  title: "",
  subject: "other",
  grades: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  difficulty: "medium",
  status: "draft",
  cards: [],
  createdByProfileId: profileId,
  createdByDisplayName: displayName || "Student",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { ecosystemDecks, userDecks, hasInteractiveParams, isAdmin, muted, visitorStudyData } =
    useContext(GlobalStateContext);

  const [searchParams] = useSearchParams();
  const forceRefreshInventory = searchParams.get("forceRefreshInventory") === "true";
  const displayName = searchParams.get("displayName") || searchParams.get("username") || "friend";
  const profileId = searchParams.get("profileId") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<StudentTab>("library");
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);
  const [creatingDeck, setCreatingDeck] = useState<Deck | null>(null);

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

  const studyingDeck = useMemo(
    () => [...ecosystemDecks, ...userDecks].find((d) => d.id === studyingDeckId) || null,
    [ecosystemDecks, userDecks, studyingDeckId],
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

  // Anyone can edit a deck they created; admins can also edit any ecosystem
  // deck (since the server-side gate is `isAdmin` for ecosystem scope).
  const canEditStudyingDeck = Boolean(
    studyingDeck && (studyingDeck.createdByProfileId === profileId || (studyingDeck.scope === "ecosystem" && isAdmin)),
  );

  let content;
  if (studyingDeck) {
    content = (
      <Study
        deck={studyingDeck}
        onExit={() => setStudyingDeckId(null)}
        onEdit={
          canEditStudyingDeck
            ? () => {
                setStudyingDeckId(null);
                setCreatingDeck(studyingDeck);
              }
            : undefined
        }
      />
    );
  } else if (creatingDeck) {
    content = <EditDeck initial={creatingDeck} onClose={() => setCreatingDeck(null)} />;
  } else {
    content = (
      <div className="ss-page ss-page-bg">
        <section className="ss-greeting" aria-label="Welcome">
          <div className="ss-greeting__text">
            <span className="ss-mascot ss-mascot--lg">
              <Mascot />
            </span>
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
            <Library
              onPick={(deckId) => setStudyingDeckId(deckId)}
              onCreate={() => setCreatingDeck(blankUserDeck(profileId, displayName))}
            />
          )}
          {tab === "progress" && <ProgressTab />}
          {tab === "badges" && <BadgesTab />}
        </div>
      </div>
    );
  }

  return <PageContainer isLoading={isLoading}>{content}</PageContainer>;
};

export default Home;
