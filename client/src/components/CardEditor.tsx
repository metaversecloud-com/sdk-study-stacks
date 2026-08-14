import { useState } from "react";
import type { CardType } from "@shared/types/StudyStacksTypes";

export const CardEditor = ({
  card,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: {
  card: CardType;
  index: number;
  total: number;
  onChange: (next: CardType) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) => {
  const id = `card-${card.id}`;
  const [imageError, setImageError] = useState(false);
  const trimmedImageUrl = (card.imageUrl ?? "").trim();
  const showPreview = trimmedImageUrl.length > 0 && !imageError;
  return (
    <div className="ss-card-editor" role="group" aria-label={`Card ${index + 1} of ${total}`}>
      {showPreview && (
        <img
          className="ss-card-editor__preview"
          src={trimmedImageUrl}
          alt={`Front image preview for card ${index + 1}`}
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
      )}
      <div className="ss-card-editor__field">
        <label htmlFor={`${id}-front`}>Front</label>
        <input
          id={`${id}-front`}
          className="input"
          value={card.front}
          onChange={(e) => onChange({ ...card, front: e.target.value })}
          placeholder="Prompt"
          maxLength={1000}
        />
      </div>
      <div className="ss-card-editor__field ss-card-editor__field--image">
        <label htmlFor={`${id}-image`}>Front image URL</label>
        <input
          id={`${id}-image`}
          className="input"
          type="url"
          value={card.imageUrl ?? ""}
          onChange={(e) => {
            setImageError(false);
            onChange({ ...card, imageUrl: e.target.value });
          }}
          placeholder="https://example.com/image.png"
          maxLength={2000}
        />
        {trimmedImageUrl.length > 0 && imageError && (
          <p className="ss-card-editor__preview-error" role="status">
            Couldn’t load this image. Check the URL is public and points to an image.
          </p>
        )}
      </div>
      <div className="ss-card-editor__field">
        <label htmlFor={`${id}-back`}>Back</label>
        <input
          id={`${id}-back`}
          className="input"
          value={card.back}
          onChange={(e) => onChange({ ...card, back: e.target.value })}
          placeholder="Answer"
          maxLength={1000}
        />
      </div>
      <div className="ss-card-editor__field">
        <label htmlFor={`${id}-hint`}>Hint</label>
        <input
          id={`${id}-hint`}
          className="input"
          value={card.hint ?? ""}
          onChange={(e) => onChange({ ...card, hint: e.target.value })}
          placeholder="Optional hint shown to the student"
          maxLength={1000}
        />
      </div>
      <div className="ss-card-editor__actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Move card ${index + 1} up`}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Move card ${index + 1} down`}
        >
          ↓
        </button>
        <button
          type="button"
          className="btn btn-outline btn-danger-outline"
          onClick={onDelete}
          aria-label={`Delete card ${index + 1}`}
        >
          <div className="h-4 w-4 bg-red-600 [mask-image:url('https://sdk-style.s3.amazonaws.com/icons/delete.svg')] [mask-size:contain] [mask-repeat:no-repeat]" />
        </button>
      </div>
    </div>
  );
};

export default CardEditor;
