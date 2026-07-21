"use client";

import { useEffect, useState } from "react";

export const OTP_TTL_SECONDS = 10 * 60;

export function formatOtpClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Countdown from `ttlSeconds`; restart when `resetKey` changes. */
export function useOtpCountdown(ttlSeconds = OTP_TTL_SECONDS, resetKey = 0) {
  const [remaining, setRemaining] = useState(ttlSeconds);

  useEffect(() => {
    setRemaining(ttlSeconds);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRemaining(Math.max(0, ttlSeconds - elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, [ttlSeconds, resetKey]);

  return {
    remaining,
    expired: remaining <= 0,
    progress: ttlSeconds > 0 ? remaining / ttlSeconds : 0,
    label: formatOtpClock(remaining),
  };
}
