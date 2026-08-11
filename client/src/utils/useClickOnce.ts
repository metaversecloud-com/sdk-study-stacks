import { useCallback, useRef, useState } from "react";

/**
 * Rage-click guard for a group of buttons. Returns a `disabled` flag plus a
 * `guard` wrapper for click handlers: the first guarded click locks the group
 * (synchronously, via a ref — so a fast double-click can't slip a second action
 * through before the re-render) and flips `disabled` to true so every button
 * sharing the guard is disabled.
 *
 * Call `reset()` to re-enable — e.g. after an async action fails, or when the
 * screen moves on to a fresh item (a new card) while staying mounted.
 */
export const useClickOnce = () => {
  const [disabled, setDisabled] = useState(false);
  const lockedRef = useRef(false);

  const guard = useCallback(
    (fn?: () => void) => () => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setDisabled(true);
      fn?.();
    },
    [],
  );

  const reset = useCallback(() => {
    lockedRef.current = false;
    setDisabled(false);
  }, []);

  return { disabled, guard, reset };
};

export default useClickOnce;
