import type { Card } from "@shared/types/StudyStacksTypes";
import { MAX_CARDS_PER_DECK } from "@shared/types/StudyStacksTypes";

export interface ParseCardsResult {
  cards: Card[];
  /** rows the parser had to drop (blank, missing front/back, over the deck limit) */
  skipped: number;
  /** delimiter that was auto-detected — useful to surface to the user */
  delimiter: "csv" | "tsv";
  /** non-fatal warnings worth showing in the UI */
  warnings: string[];
  /** true if a header row was detected and skipped */
  headerDetected: boolean;
}

const HEADER_KEYS = new Set([
  "front",
  "back",
  "hint",
  "image",
  "question",
  "answer",
  "term",
  "definition",
]);

const newId = (i: number) => `c_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;

/** Keep only public http(s) URLs; anything else is dropped silently. */
const cleanImageUrl = (raw: string): string | undefined => {
  const value = raw.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return value.slice(0, 2000);
  } catch {
    return undefined;
  }
};

/**
 * Tokenize a CSV-like string. Honors quoted fields with `""` as an escape and
 * allows newlines inside quotes (matches RFC 4180 closely enough for spreadsheet
 * exports from Excel / Google Sheets / Numbers).
 */
const tokenize = (text: string, delim: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cur += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delim) {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // swallow \r\n as a single line break
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  // final field/row
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
};

const looksLikeHeader = (row: string[]): boolean => {
  const lower = row.slice(0, 3).map((c) => c.trim().toLowerCase());
  // At least two of {front, back, hint} (or their aliases) appear in the first three cells.
  const matches = lower.filter((c) => HEADER_KEYS.has(c)).length;
  return matches >= 2;
};

/**
 * Parse the user's pasted/imported text into a card list. Pure — no IO.
 */
export const parseCardsImport = (rawText: string): ParseCardsResult => {
  const text = (rawText || "").replace(/^﻿/, ""); // strip BOM
  if (!text.trim()) {
    return { cards: [], skipped: 0, delimiter: "csv", warnings: [], headerDetected: false };
  }

  // Sniff delimiter from the first non-empty line.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delim: "csv" | "tsv" = tabCount > commaCount ? "tsv" : "csv";
  const delimChar = delim === "tsv" ? "\t" : ",";

  const rows = tokenize(text, delimChar).filter((r) => r.some((c) => c.trim().length > 0));

  const warnings: string[] = [];
  let headerDetected = false;
  let start = 0;
  if (rows.length > 0 && looksLikeHeader(rows[0])) {
    headerDetected = true;
    start = 1;
  }

  const cards: Card[] = [];
  let skipped = 0;
  let droppedForLimit = 0;
  for (let i = start; i < rows.length; i++) {
    if (cards.length >= MAX_CARDS_PER_DECK) {
      droppedForLimit++;
      continue;
    }
    const row = rows[i];
    const front = (row[0] || "").trim().slice(0, 1000);
    const back = (row[1] || "").trim().slice(0, 1000);
    const hint = (row[2] || "").trim().slice(0, 500);
    const imageUrl = cleanImageUrl(row[3] || "");
    if (!front || !back) {
      skipped++;
      continue;
    }
    cards.push({
      id: newId(cards.length),
      front,
      back,
      ...(hint ? { hint } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }

  if (droppedForLimit > 0) {
    warnings.push(
      `Only the first ${MAX_CARDS_PER_DECK} cards were imported — ${droppedForLimit} row${
        droppedForLimit === 1 ? " was" : "s were"
      } dropped.`,
    );
  }
  if (skipped > 0) {
    warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped — Front and Back are both required.`);
  }

  return { cards, skipped, delimiter: delim, warnings, headerDetected };
};
