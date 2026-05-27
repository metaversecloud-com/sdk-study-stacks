import { useEffect, useRef, useState } from "react";
import type { FlipRating } from "@shared/types/StudyStacksTypes";
import type { SessionCard } from "@/context/types";

export const FlipCard = ({
  card,
  index,
  total,
  onRate,
  muted,
}: {
  card: SessionCard;
  index: number;
  total: number;
  onRate: (rating: FlipRating) => void;
  muted: boolean;
}) => {
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebrate, setCelebrate] = useState<"correct" | "wrong" | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFlipped(false);
    setShowHint(false);
    setCelebrate(null);
  }, [card.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack space/enter when a button (e.g. the hint toggle) is focused.
      if (document.activeElement instanceof HTMLButtonElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped]);

  const playChime = () => {
    if (muted) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* no-op */
    }
  };

  const handleRate = (r: FlipRating) => {
    if (r === "got_it") {
      setCelebrate("correct");
      playChime();
    } else if (r === "missed") {
      setCelebrate("wrong");
    } else {
      setCelebrate(null);
    }
    setTimeout(() => onRate(r), 350);
  };

  return (
    <div>
      <p className="p2 pb-2 text-center" style={{ color: "var(--ss-text-light)" }}>
        Card {index + 1} of {total}
      </p>

      <div
        className="ss-flip-stage"
        ref={stageRef}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Card showing back. Pick a rating below." : "Card front. Press to reveal the answer."}
        onClick={() => !flipped && setFlipped(true)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !flipped) {
            e.preventDefault();
            setFlipped(true);
          }
        }}
      >
        <div
          className={`ss-flip-card${flipped ? " ss-flip-card--flipped" : ""}${
            celebrate === "correct" ? " ss-burst" : ""
          }`}
        >
          <div className="ss-flip-card__face">
            <div>
              {card.imageUrl && <img className="ss-flip-card__image" src={card.imageUrl} alt="" loading="lazy" />}
              {card.front}
            </div>
          </div>
          <div className="ss-flip-card__face ss-flip-card__face--back">{card.back}</div>
        </div>
      </div>

      {!flipped && card.hint && (
        <div className="ss-hint-row">
          {showHint ? (
            <p className="p2" style={{ color: "var(--ss-text-light)" }}>
              💡 {card.hint}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-outline ss-hint-btn"
              onClick={() => setShowHint(true)}
              aria-expanded={false}
            >
              💡 Show hint
            </button>
          )}
        </div>
      )}

      {!flipped ? (
        <p className="p2 text-center pt-6" style={{ color: "var(--ss-text-light)" }}>
          Tap the card or press space to flip.
        </p>
      ) : (
        <div className="ss-rating-row" role="group" aria-label="Self-rate your recall">
          <button className="ss-rating-btn ss-rating-btn--missed" onClick={() => handleRate("missed")}>
            ✗ Missed
          </button>
          <button className="ss-rating-btn ss-rating-btn--almost" onClick={() => handleRate("almost")}>
            ◐ Almost
          </button>
          <button className="ss-rating-btn ss-rating-btn--got-it" onClick={() => handleRate("got_it")}>
            ✓ Got it
          </button>
        </div>
      )}
    </div>
  );
};

export default FlipCard;
