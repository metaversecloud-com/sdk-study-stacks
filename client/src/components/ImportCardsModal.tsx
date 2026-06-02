import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CardType } from "@shared/types/StudyStacksTypes";
import { copyCardsTemplate, parseCardsImport } from "@/utils";

type ImportMode = "append" | "replace";

export const ImportCardsModal = ({
  existingCount,
  onConfirm,
  onCancel,
}: {
  existingCount: number;
  onConfirm: (cards: CardType[], mode: ImportMode) => void;
  onCancel: () => void;
}) => {
  const titleId = useId();
  const textareaId = useId();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ImportMode>(existingCount > 0 ? "append" : "replace");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const parsed = useMemo(() => parseCardsImport(text), [text]);

  // Escape closes; focus the close button on mount for keyboard users.
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleCopy = async () => {
    const ok = await copyCardsTemplate();
    setCopyState(ok ? "ok" : "err");
    setTimeout(() => setCopyState("idle"), 1800);
  };

  const canImport = parsed.cards.length > 0;
  const previewCount = Math.min(parsed.cards.length, 5);

  return (
    <div className="modal-container ss-modal-container">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={containerRef}>
        <h4 id={titleId}>Import cards</h4>
        <p className="p3" style={{ color: "var(--ss-text-dim)" }}>
          Drop in a CSV or TSV (e.g. exported from Google Sheets/Excel). Columns:
          <strong> Front, Back, Hint, Image</strong> (Hint and Image are optional).
        </p>

        <div className="ss-import-toolbar">
          {/* <button type="button" className="btn btn-outline" onClick={downloadCardsTemplate}>
            ⬇ Download template
          </button> */}
          <button type="button" className="btn btn-outline" onClick={handleCopy}>
            {copyState === "ok" ? "✓ Copied" : copyState === "err" ? "Copy failed" : "📋 Copy template"}
          </button>
          <label className="btn btn-outline p-3 ss-import-file">
            📁 Choose file
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <label htmlFor={textareaId} className="ss-field__label mt-3">
          Or paste your cards
        </label>
        <textarea
          id={textareaId}
          className="input ss-import-textarea"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Front,Back,Hint,Image\nWhat is the capital of France?,Paris,Think Eiffel Tower,https://example.com/eiffel.jpg\n2 + 2,4,,"
          }
          spellCheck={false}
        />

        {parsed.cards.length === 0 && text.trim().length > 0 && (
          <p className="p3 mt-2" style={{ color: "var(--ss-coral)" }} role="alert">
            No valid cards found. Make sure each row has Front and Back values.
          </p>
        )}

        {parsed.cards.length > 0 && (
          <div className="mt-3">
            <p className="p3" style={{ color: "var(--ss-text-dim)" }}>
              Detected <strong>{parsed.delimiter.toUpperCase()}</strong>
              {parsed.headerDetected ? " · header row skipped" : ""} · {parsed.cards.length} card
              {parsed.cards.length === 1 ? "" : "s"} ready to import.
            </p>
            <div className="ss-import-preview">
              <table className="ss-import-preview__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Front</th>
                    <th>Back</th>
                    <th>Hint</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.cards.slice(0, previewCount).map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td>{c.front}</td>
                      <td>{c.back}</td>
                      <td style={{ color: "var(--ss-text-dim)" }}>{c.hint || "—"}</td>
                      <td style={{ color: "var(--ss-text-dim)" }}>
                        {c.imageUrl ? (
                          <img
                            className="ss-import-preview__thumb"
                            src={c.imageUrl}
                            alt={`Image for card ${i + 1}`}
                            loading="lazy"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.cards.length > previewCount && (
                <p className="p3 mt-1" style={{ color: "var(--ss-text-dim)", textAlign: "center" }}>
                  …and {parsed.cards.length - previewCount} more.
                </p>
              )}
            </div>

            {parsed.warnings.map((w, i) => (
              <p key={i} className="p3 mt-2" style={{ color: "var(--ss-coral)" }}>
                ⚠ {w}
              </p>
            ))}

            {existingCount > 0 && (
              <fieldset className="ss-import-mode mt-3">
                <legend className="ss-field__label">When importing</legend>
                <label className="ss-checkbox-row">
                  <input
                    type="radio"
                    name="import-mode"
                    value="append"
                    checked={mode === "append"}
                    onChange={() => setMode("append")}
                  />
                  Add to the {existingCount} existing card{existingCount === 1 ? "" : "s"}
                </label>
                <label className="ss-checkbox-row">
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  Replace all existing cards
                </label>
              </fieldset>
            )}
          </div>
        )}

        <div className="actions mt-4">
          <button id="close" ref={cancelRef} className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onConfirm(parsed.cards, mode)}
            disabled={!canImport}
            aria-disabled={!canImport}
          >
            Import {parsed.cards.length || ""} {parsed.cards.length === 1 ? "card" : "cards"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportCardsModal;
