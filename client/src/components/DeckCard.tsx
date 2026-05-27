import { Deck, Subject, VisitorStudyData } from "@shared/types/StudyStacksTypes";
import MasteryRing from "./MasteryRing";

const SUBJECT_ICON: { [key in Subject]: string } = {
  math: "➕",
  ela: "📖",
  science: "🔬",
  history: "🏛️",
  language: "🗣️",
  art: "🎨",
  other: "✨",
};

const SUBJECT_CLASS: { [key in Subject]: string } = {
  math: "ss-deck-card--math",
  ela: "ss-deck-card--ela",
  science: "ss-deck-card--science",
  history: "ss-deck-card--history",
  language: "ss-deck-card--language",
  art: "ss-deck-card--art",
  other: "ss-deck-card--other",
};

const computeMasteryPct = (deck: Deck, studyData?: VisitorStudyData): number => {
  if (deck.cards.length === 0) return 0;
  const progress = studyData?.decks?.[deck.id];
  if (!progress) return 0;
  const total = deck.cards.reduce((acc, c) => acc + (progress.cards[c.id]?.mastery ?? 0), 0);
  const max = deck.cards.length * 5;
  return max === 0 ? 0 : (total / max) * 100;
};

const formatLastStudied = (ts?: number): string => {
  if (!ts) return "Never studied";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
};

export const DeckCard = ({
  deck,
  studyData,
  recommended,
  onClick,
}: {
  deck: Deck;
  studyData?: VisitorStudyData;
  recommended?: boolean;
  onClick: () => void;
}) => {
  const pct = computeMasteryPct(deck, studyData);
  const lastStudied = studyData?.decks?.[deck.id]?.lastStudiedAt;
  const subjectClass = SUBJECT_CLASS[deck.subject] || "ss-deck-card--other";

  return (
    <button
      type="button"
      className={`ss-deck-card ${subjectClass}${recommended ? " ss-deck-card--recommended" : ""}`}
      onClick={onClick}
      aria-label={`${recommended ? "Recommended. " : ""}Study ${deck.title}. ${deck.cards.length} cards. Mastery ${Math.round(
        pct,
      )} percent.`}
    >
      <div className="ss-deck-card__header">
        <div className="ss-deck-card__header-row">
          <span className="ss-deck-card__icon" aria-hidden="true">
            {SUBJECT_ICON[deck.subject] || "✨"}
          </span>
          <div className="ss-deck-card__title">{deck.title}</div>
          <span className="ss-deck-card__ring-wrap">
            <MasteryRing pct={pct} />
          </span>
        </div>
      </div>
      <div className="ss-deck-card__body">
        <div className="ss-deck-card__meta">
          {deck.subject} · {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"} · {deck.difficulty}
        </div>
        <div className="ss-deck-card__meta">{formatLastStudied(lastStudied)}</div>
        {deck.status === "draft" && (
          <div className="ss-deck-card__meta" style={{ color: "var(--ss-coral)", fontWeight: 700 }}>
            Draft
          </div>
        )}
      </div>
    </button>
  );
};

export default DeckCard;
