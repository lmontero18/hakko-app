import { useEffect } from "react";

/**
 * Locks the document body's vertical scroll while `active` is true.
 * Restores the original overflow value when unmounted or deactivated.
 *
 * Used by modal/dialog components so the page behind them doesn't
 * scroll when the user scrolls inside the modal content.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}
