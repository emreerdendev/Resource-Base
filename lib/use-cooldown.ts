"use client";

import { useEffect, useState } from "react";

/**
 * A short wait after sending an email, shown on the button ("Send again in
 * 42s"). Matches the server's one-minute per-address cooldown, so people
 * don't click into a limit.
 */
export function useCooldown(seconds = 60) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        setUntil(0);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  const left = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  return {
    left,
    start: () => {
      const t = Date.now();
      setNow(t);
      setUntil(t + seconds * 1000);
    },
  };
}
