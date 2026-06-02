import { useContext, useEffect, useRef, useState } from "react";
import type { DeckType, FlipRatingType, StudyModeType, SessionSummaryType } from "@shared/types/StudyStacksTypes";
import { SPRINT_DURATION_MS } from "@shared/types/StudyStacksTypes";
import { GlobalDispatchContext, GlobalStateContext } from "@context/GlobalContext";
import {
  ActiveClientSession,
  CLEAR_SESSION,
  ErrorType,
  SessionCard,
  SET_SESSION,
  SET_VISITOR_DATA,
} from "@/context/types";
import { backendAPI, setErrorMessage } from "@/utils";
import { EndOfSession, FlipCard, QuizCard, SprintHUD, StreakRing } from "@/components";

// Mode is now picked at the Home level via `<ModePicker>` rendered as a
// modal over the Library, so this page no longer owns a `picking-mode` phase.
type Phase = "in-session" | "ended";

export const Study = ({
  deck,
  mode,
  onExit,
  onChangeMode,
}: {
  deck: DeckType;
  mode: StudyModeType;
  onExit: () => void;
  /** Called from EndOfSession's "Study again" so Home can pop the mode
   * picker back open (lets the player swap modes or restart). */
  onChangeMode?: () => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { muted, visitorStudyData } = useContext(GlobalStateContext);

  const [phase, setPhase] = useState<Phase>("in-session");
  const [session, setSession] = useState<ActiveClientSession | null>(null);
  const [summary, setSummary] = useState<SessionSummaryType | null>(null);
  const [loading, setLoading] = useState(false);
  const sprintStartedRef = useRef<number>(0);
  // In-flight answer saves. The UI advances optimistically without waiting for
  // these; we only block on them at completion so the final summary/badges
  // (computed server-side from accumulated answers) include every card.
  const pendingAnswersRef = useRef<Promise<unknown>[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  const startSession = async (mode: StudyModeType) => {
    setLoading(true);
    try {
      const res = await backendAPI.post("/session/start", {
        deckId: deck.id,
        scope: deck.scope,
        mode,
      });
      if (res.data?.success) {
        const next: ActiveClientSession = {
          sessionId: res.data.sessionId,
          deckId: deck.id,
          deckScope: deck.scope,
          mode,
          cards: res.data.cards as SessionCard[],
          startedAt: Date.now(),
          index: 0,
          correctCount: 0,
          totalAnswered: 0,
        };
        setSession(next);
        dispatch!({ type: SET_SESSION, payload: { session: next } });
        sprintStartedRef.current = Date.now();
        setPhase("in-session");
      }
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    } finally {
      setLoading(false);
    }
  };

  // Sprint timer tick
  useEffect(() => {
    if (phase !== "in-session" || session?.mode !== "sprint") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase, session?.mode]);

  // Sprint auto-end when timer hits 0
  useEffect(() => {
    if (phase !== "in-session" || session?.mode !== "sprint") return;
    const elapsed = now - sprintStartedRef.current;
    if (elapsed >= SPRINT_DURATION_MS) {
      completeSession();
    }
  }, [now, phase, session?.mode]);

  // Fire-and-forget: kick off the save and track it so completeSession can wait
  // for it, but don't make the UI block on it before advancing.
  const recordAnswer = (payload: { cardId: string; isCorrect?: boolean; rating?: FlipRatingType }) => {
    if (!session) return;
    const promise = backendAPI
      .post("/session/answer", {
        sessionId: session.sessionId,
        cardId: payload.cardId,
        mode: session.mode,
        rating: payload.rating,
        isCorrect: payload.isCorrect,
      })
      .catch((err) => setErrorMessage(dispatch, err as ErrorType))
      .finally(() => {
        pendingAnswersRef.current = pendingAnswersRef.current.filter((p) => p !== promise);
      });
    pendingAnswersRef.current.push(promise);
  };

  const advance = (wasCorrect: boolean) => {
    if (!session) return;
    const updated: ActiveClientSession = {
      ...session,
      index: session.index + 1,
      correctCount: session.correctCount + (wasCorrect ? 1 : 0),
      totalAnswered: session.totalAnswered + 1,
    };

    if (session.mode === "sprint") {
      // Sprint loops the deck until time runs out.
      if (updated.index >= session.cards.length) updated.index = 0;
      setSession(updated);
      dispatch!({ type: SET_SESSION, payload: { session: updated } });
      return;
    }

    if (updated.index >= session.cards.length) {
      setSession(updated);
      dispatch!({ type: SET_SESSION, payload: { session: updated } });
      completeSession(updated);
      return;
    }

    setSession(updated);
    dispatch!({ type: SET_SESSION, payload: { session: updated } });
  };

  const completeSession = async (override?: ActiveClientSession) => {
    const s = override || session;
    if (!s) return;
    setLoading(true);
    try {
      // Ensure every answer write has landed so the summary + badges include them.
      if (pendingAnswersRef.current.length) await Promise.allSettled(pendingAnswersRef.current);
      const res = await backendAPI.post("/session/complete", { sessionId: s.sessionId });
      if (res.data?.success) {
        setSummary(res.data.summary);
        dispatch!({
          type: SET_VISITOR_DATA,
          payload: { visitorStudyData: res.data.visitorStudyData, visitorInventory: res.data.visitorInventory },
        });
        setPhase("ended");
      }
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    } finally {
      setLoading(false);
    }
  };

  const handleStudyAgain = () => {
    setSummary(null);
    setSession(null);
    dispatch!({ type: CLEAR_SESSION });
    // Bubble back to Home so it can re-open the mode-picker modal — that's
    // where mode selection lives now. Falls back to a plain exit if the
    // parent doesn't supply a handler.
    if (onChangeMode) onChangeMode();
    else onExit();
  };

  const handleExit = () => {
    setSummary(null);
    setSession(null);
    dispatch!({ type: CLEAR_SESSION });
    onExit();
  };

  // Mode is picked at the Home level before mounting Study, so kick off the
  // first session as soon as the deck + mode are in hand. `startSession` is
  // already defensive (dispatches errors), and the loading state below covers
  // the in-flight window.
  useEffect(() => {
    if (session || loading) return;
    startSession(mode);
    // We intentionally only fire when the targeted (deck, mode) pair changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id, mode]);

  if (loading && !session) {
    return <p className="ss-empty-state">Starting session…</p>;
  }

  if (phase === "ended" && summary) {
    return <EndOfSession summary={summary} onStudyAgain={handleStudyAgain} onLibrary={handleExit} />;
  }

  if (!session) return null;

  const currentCard = session.cards[session.index];
  // `loading` here means completeSession is in flight (e.g. "End session" was
  // clicked) — show the same wrap-up state so it doesn't look frozen.
  if (!currentCard || loading) {
    return (
      <div className="ss-empty-state">
        <p>Wrapping up…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="ss-header-row">
        <StreakRing current={visitorStudyData?.streak?.current || 0} longest={visitorStudyData?.streak?.longest || 0} />
      </div>

      {session.mode === "sprint" && (
        <SprintHUD remainingMs={SPRINT_DURATION_MS - (now - sprintStartedRef.current)} score={session.correctCount} />
      )}

      {session.mode === "flip" && (
        <FlipCard
          card={currentCard}
          index={session.index}
          total={session.cards.length}
          muted={muted}
          onRate={(rating) => {
            recordAnswer({ cardId: currentCard.id, rating });
            advance(rating === "got_it");
          }}
        />
      )}

      {(session.mode === "quiz" || session.mode === "sprint") && (
        <QuizCard
          card={currentCard}
          index={session.index}
          total={session.cards.length}
          trueFalseFallback={(currentCard.distractors?.length ?? 0) < 3}
          autoAdvance={session.mode === "sprint"}
          muted={muted}
          onAnswer={(isCorrect) => {
            recordAnswer({ cardId: currentCard.id, isCorrect });
            advance(isCorrect);
          }}
        />
      )}

      <button className="btn btn-outline mt-6" onClick={() => completeSession()}>
        End session
      </button>
    </div>
  );
};

export default Study;
