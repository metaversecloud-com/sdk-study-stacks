import { useEffect, useMemo, useState } from "react";
import type { SessionCard } from "@/context/types";

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const QuizCard = ({
  card,
  index,
  total,
  onAnswer,
  trueFalseFallback,
  autoAdvance,
}: {
  card: SessionCard;
  index: number;
  total: number;
  onAnswer: (isCorrect: boolean) => void;
  trueFalseFallback?: boolean;
  autoAdvance?: boolean;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Options are stable per card render.
  const options = useMemo(() => {
    if (trueFalseFallback || (card.distractors?.length ?? 0) < 3) {
      // True/False: show the back, plus a random other "fake" string.
      const fake = card.distractors?.[0] || "Not quite — try again";
      const allTrue = Math.random() < 0.5;
      const shown = allTrue ? card.back : fake;
      return [
        { text: shown, isCorrect: allTrue, label: "True" },
        { text: "Different answer", isCorrect: !allTrue, label: "False" },
      ];
    }
    const opts = shuffle([
      { text: card.back, isCorrect: true },
      ...card.distractors!.map((d) => ({ text: d, isCorrect: false })),
    ]);
    return opts;
  }, [card.id, trueFalseFallback]);

  useEffect(() => {
    setPicked(null);
    setRevealed(false);
    setShowHint(false);
  }, [card.id]);

  const handlePick = (option: { text: string; isCorrect: boolean }) => {
    if (picked) return;
    setPicked(option.text);
    setRevealed(true);
    if (autoAdvance) {
      setTimeout(() => onAnswer(option.isCorrect), 350);
    } else {
      setTimeout(() => onAnswer(option.isCorrect), 1100);
    }
  };

  return (
    <div>
      <p className="p3 text-center" style={{ color: "var(--ss-text-dim)" }}>
        Card {index + 1} of {total}
      </p>
      <div className="card ss-quiz-prompt">
        {card.imageUrl && <img className="ss-quiz-prompt__image" src={card.imageUrl} alt="" loading="lazy" />}
        <h3 className="h3" style={{ marginBottom: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {card.front}
        </h3>
        {card.hint &&
          (showHint ? (
            <p className="p3 mt-2" style={{ color: "var(--ss-text-dim)", overflowWrap: "anywhere" }}>💡 {card.hint}</p>
          ) : (
            <button
              type="button"
              className="btn btn-outline ss-hint-btn mt-2"
              onClick={() => setShowHint(true)}
              aria-expanded={false}
            >
              💡 Show hint
            </button>
          ))}
      </div>

      <div className="ss-quiz-options" role="group" aria-label="Answer choices">
        {options.map((opt, i) => {
          const isPicked = picked === opt.text;
          const className =
            "btn ss-quiz-option" +
            (revealed && isPicked && opt.isCorrect ? " ss-quiz-option--correct" : "") +
            (revealed && isPicked && !opt.isCorrect ? " ss-quiz-option--wrong" : "") +
            (revealed && !isPicked && opt.isCorrect ? " ss-quiz-option--correct" : "");
          return (
            <button
              key={`${card.id}-${i}`}
              className={className}
              onClick={() => handlePick(opt)}
              disabled={Boolean(picked)}
            >
              {("label" in opt && (opt as any).label) ? `${(opt as any).label}: ` : ""}
              {opt.text}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className={`ss-quiz-feedback ${
            options.find((o) => o.text === picked)?.isCorrect
              ? "ss-quiz-feedback--correct"
              : "ss-quiz-feedback--wrong"
          }`}
          role="status"
        >
          {options.find((o) => o.text === picked)?.isCorrect
            ? "✅ Nice!"
            : `↩️ Let's circle back. The answer was: ${card.back}`}
        </div>
      )}
    </div>
  );
};

export default QuizCard;
