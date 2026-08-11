import correctSound from "@/assets/correct.mp3";
import incorrectSound from "@/assets/incorrect.mp3";

/**
 * Play the answer-feedback sound. Respects the user's mute setting and never
 * throws (autoplay can be blocked before the first user gesture).
 */
export const playAnswerSound = (kind: "correct" | "incorrect", muted: boolean) => {
  if (muted) return;
  try {
    const audio = new Audio(kind === "correct" ? correctSound : incorrectSound);
    audio.volume = 0.5;
    void audio.play().catch(() => {
      /* autoplay blocked — ignore */
    });
  } catch {
    /* no-op */
  }
};
