import { useContext, useEffect, useRef, useState } from "react";
import type { Deck, FlipRating, StudyMode, SessionSummary } from "@shared/types/StudyStacksTypes";
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
import { EndOfSession, FlipCard, ModePicker, QuizCard, SprintHUD, StreakRing } from "@/components";

type Phase = "picking-mode" | "in-session" | "ended";

export const Study = ({
  deck,
  onExit,
  onEdit,
}: {
  deck: Deck;
  onExit: () => void;
  /** Optional — when provided, the mode picker shows an Edit button so the
   * deck's owner can jump straight into the editor. */
  onEdit?: () => void;
}) => {
  const dispatch = useContext(GlobalDispatchContext);
  const { muted, visitorStudyData } = useContext(GlobalStateContext);

  const [phase, setPhase] = useState<Phase>("picking-mode");
  const [session, setSession] = useState<ActiveClientSession | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const sprintStartedRef = useRef<number>(0);
  const [now, setNow] = useState<number>(Date.now());

  const startSession = async (mode: StudyMode) => {
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

  const recordAnswer = async (payload: { cardId: string; isCorrect?: boolean; rating?: FlipRating }) => {
    if (!session) return;
    try {
      await backendAPI.post("/session/answer", {
        sessionId: session.sessionId,
        cardId: payload.cardId,
        mode: session.mode,
        rating: payload.rating,
        isCorrect: payload.isCorrect,
      });
    } catch (err) {
      setErrorMessage(dispatch, err as ErrorType);
    }
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
      const res = await backendAPI.post("/session/complete", { sessionId: s.sessionId });
      if (res.data?.success) {
        setSummary(res.data.summary);
        dispatch!({
          type: SET_VISITOR_DATA,
          payload: { visitorStudyData: res.data.visitorStudyData },
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
    setPhase("picking-mode");
  };

  const handleExit = () => {
    setSummary(null);
    setSession(null);
    dispatch!({ type: CLEAR_SESSION });
    onExit();
  };

  if (loading && !session) {
    return <p className="ss-empty-state">Starting session…</p>;
  }

  if (phase === "picking-mode") {
    return <ModePicker deck={deck} onPick={startSession} onCancel={handleExit} onEdit={onEdit} />;
  }

  if (phase === "ended" && summary) {
    return <EndOfSession summary={summary} onStudyAgain={handleStudyAgain} onLibrary={handleExit} />;
  }

  if (!session) return null;

  const currentCard = session.cards[session.index];
  if (!currentCard) {
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
          onRate={async (rating) => {
            await recordAnswer({ cardId: currentCard.id, rating });
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
          onAnswer={async (isCorrect) => {
            await recordAnswer({ cardId: currentCard.id, isCorrect });
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
