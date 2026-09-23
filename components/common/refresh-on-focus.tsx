"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Re-renders the page with fresh server data when the tab comes back into
 * view: a timer started on the phone shows up on the computer as soon as you
 * look at it. Throttled, and nothing polls in the background — on Vercel's
 * free plan every request spends a shared monthly CPU budget.
 */
export function RefreshOnFocus({ minIntervalMs = 15_000 }: { minIntervalMs?: number }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < minIntervalMs) return;
      lastRefresh.current = now;
      router.refresh();
    }

    lastRefresh.current = Date.now();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router, minIntervalMs]);

  return null;
}
