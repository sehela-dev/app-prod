"use client";

import { useEffect, useState } from "react";

/** Live milliseconds until an ISO timestamp; null when there is no usable expiry. */
export function useRemainingTime(expiresAt?: string | null): number | null {
  const target = expiresAt ? Date.parse(expiresAt) : NaN;
  const valid = Number.isFinite(target);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!valid) return;
    setNow(Date.now());
    if (target <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target, valid]);

  return valid ? Math.max(0, target - now) : null;
}
