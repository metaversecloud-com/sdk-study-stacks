/**
 * Plain-CSV template Study Stacks offers users. Header + a few realistic example
 * rows that demonstrate:
 *  - the column order (Front, Back, Hint, Image)
 *  - quoting for fields that contain commas or quotes
 *  - leaving Hint and/or Image blank
 *  - Image is an optional public http(s) URL shown on the front of the card
 */
export const CARDS_TEMPLATE_CSV = `Front,Back,Hint,Image
What is the capital of France?,Paris,Think of the Eiffel Tower,https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg
Photosynthesis,The process plants use to convert sunlight into energy,Starts with "photo",
"Who wrote ""Romeo and Juliet""?",William Shakespeare,Elizabethan playwright,
2 + 2,4,,
`;

export const CARDS_TEMPLATE_FILENAME = "study-stack-deck-template.csv";

export const downloadCardsTemplate = () => {
  const blob = new Blob([CARDS_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = CARDS_TEMPLATE_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari finishes the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const copyCardsTemplate = async (): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(CARDS_TEMPLATE_CSV);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = CARDS_TEMPLATE_CSV;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};
