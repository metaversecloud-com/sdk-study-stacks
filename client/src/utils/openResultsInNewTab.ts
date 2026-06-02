import type { DeckType } from "@shared/types/StudyStacksTypes";
import { parseDeckResultsValue } from "@shared/types/StudyStacksTypes";

// Lightweight HTML escape — `displayName` is user-supplied, so the rendered
// page would be an XSS sink without this.
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Open a printable / shareable HTML view of a deck's per-student results
 * in a new browser tab.
 *
 * This is the canonical pattern for "give the admin a results export" in
 * Topia SDK apps going forward — replaces the older CSV-download approach.
 * Mirrors the equivalent helper in sdk-trivia but with HTML escaping and
 * scoped to the Study Stacks per-deck leaderboard shape.
 */
export const openResultsInNewTab = (deck: DeckType): void => {
  const parsed = Object.entries(deck.results || {}).map(([profileId, value]) => {
    const { displayName, sessions } = parseDeckResultsValue(value);
    return { profileId, displayName, sessions };
  });
  parsed.sort((a, b) => b.sessions - a.sessions);

  const title = escapeHtml(deck.title || "(untitled)");
  const subject = escapeHtml(deck.subject || "");
  const generatedAt = new Date().toLocaleString();

  const rows = parsed
    .map(
      (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(r.displayName)}</td>
          <td class="num">${r.sessions}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Study Stacks Results · ${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1a1a1a; }
      header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
      h1 { font-size: 1.25rem; margin: 0; }
      .meta { color: #666; font-size: 0.85rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr:nth-child(even) td { background: #fafafa; }
      .empty { color: #666; padding: 1rem 0; }
      @media print { body { margin: 0.5rem; } }
    </style>
  </head>
  <body>
    <header>
      <h1>Study Stacks Results · ${title}</h1>
      <span class="meta">${subject ? `${subject} · ` : ""}Generated ${escapeHtml(generatedAt)}</span>
    </header>
    ${
      parsed.length === 0
        ? `<p class="empty">No one has studied this deck yet.</p>`
        : `<table>
            <thead><tr><th>#</th><th>Display Name</th><th class="num">Sessions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`
    }
  </body>
</html>`;

  const tab = window.open("", "_blank");
  if (tab) {
    tab.document.write(html);
    tab.document.close();
  }
};
