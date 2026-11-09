import { ENV, MIDTRANS_CLIENT_KEY } from "./config";

const SNAP_SRC = ENV === "main" ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";

let pending: Promise<void> | null = null;

/**
 * Loads snap.js once. Resolves immediately when no client key is configured —
 * callers fall back to the snap_redirect_url flow.
 */
export function loadSnap(): Promise<void> {
  if (typeof window === "undefined" || !MIDTRANS_CLIENT_KEY) return Promise.resolve();
  if (window.snap) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SNAP_SRC;
    script.async = true;
    script.dataset.clientKey = MIDTRANS_CLIENT_KEY;
    script.onload = () => (window.snap ? resolve() : reject(new Error("Snap did not initialise")));
    script.onerror = () => reject(new Error("Failed to load Snap"));
    document.head.appendChild(script);
  }).catch((err) => {
    pending = null; // allow a retry after a network/CSP failure
    throw err;
  });

  return pending;
}
