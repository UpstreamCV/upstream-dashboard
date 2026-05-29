"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe page-visibility hook. Returns ``true`` on the server and on the
 * first client render (assume visible), then tracks ``document.visibilityState``
 * via the ``visibilitychange`` event. Used by the live overlay (M5) to drop its
 * Supabase Realtime subscription while the tab is hidden — free-plan safety, so
 * a backgrounded tab holds no realtime connection.
 *
 * Generalizes the raw ``visibilitychange`` pattern already used inline in
 * ``token-create-dialog-next.tsx``.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update(); // sync to the real state on mount (covers a tab opened hidden)
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
