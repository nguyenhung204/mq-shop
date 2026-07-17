"use client";

import { useEffect, useState } from "react";

function endTimeFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Stable window: 1–4 days from a fixed epoch bucket, so SSR/CSR match within a day
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const bucket = Math.floor(now / dayMs);
  const offsetDays = 1 + (hash % 4);
  return (bucket + offsetDays) * dayMs + (hash % dayMs);
}

function formatParts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d : ${pad(hours)}h : ${pad(mins)}m : ${pad(secs)}s`;
}

export function SaleCountdown({ seed }: { seed: string }) {
  const [label, setLabel] = useState("00d : 00h : 00m : 00s");

  useEffect(() => {
    const end = endTimeFromSeed(seed);
    const tick = () => setLabel(formatParts(end - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [seed]);

  return (
    <div className="mq-countdown" aria-live="polite">
      {label}
    </div>
  );
}
