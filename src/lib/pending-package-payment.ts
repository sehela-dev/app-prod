// Pending package-purchase payment, persisted so a refresh or a return from
// the Snap tab doesn't lose the resume URL. Mirrors the booking repay flow:
// resume the stored snap URL, never re-initiate (each initiate = new payment row).

export interface PendingPackagePayment {
  order_id: string;
  package_id: string;
  /** Null for native VA/QRIS/GoPay rows — the payment page renders instructions. */
  snap_redirect_url: string | null;
  /** Epoch ms when initiate succeeded — Midtrans payment window is 15 min from here. */
  initiated_at: number;
}

const STORAGE_KEY = "sehela:pending-package-payment";

/** Midtrans Snap payment window for package purchases. */
export const PACKAGE_PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

export const PACKAGE_PAYMENT_SUCCESS_STATUSES = ["settlement", "capture"];
export const PACKAGE_PAYMENT_FAILURE_STATUSES = ["deny", "cancel", "expire", "failure", "refund", "chargeback"];

export function getPendingPackagePayment(): PendingPackagePayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPackagePayment>;
    if (!parsed.order_id) return null;
    return {
      order_id: parsed.order_id,
      package_id: parsed.package_id ?? "",
      snap_redirect_url: parsed.snap_redirect_url ?? null,
      initiated_at: parsed.initiated_at ?? 0,
    };
  } catch {
    return null;
  }
}

export function setPendingPackagePayment(value: PendingPackagePayment) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — pending state still works in-memory
  }
}

export function clearPendingPackagePayment() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Opens the Snap page in a new tab. The URL must be passed directly —
 * pre-opening a blank tab and navigating it later is blocked by some
 * browsers (tab opens, Midtrans never loads). Falls back to same-tab
 * navigation when the popup is blocked. Returns false on fallback.
 */
export function openSnapInNewTab(url: string): boolean {
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (!tab) {
    window.location.href = url;
    return false;
  }
  tab.opener = null;
  return true;
}

/** Customer-readable label for a Midtrans transaction status. */
export function humanizePaymentStatus(status?: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "settlement":
    case "capture":
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "deny":
    case "failure":
    case "failed":
      return "Failed";
    case "cancel":
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "expire":
    case "expired":
      return "Expired";
    case "refund":
    case "refunded":
      return "Refunded";
    case "chargeback":
      return "Charged back";
    default:
      return status ? String(status) : "Pending";
  }
}
/** ms left before the 15-min payment window closes (<= 0 = expired). */
export function getPaymentExpiryRemainingMs(initiatedAt: number, now: number = Date.now()): number {
  return PACKAGE_PAYMENT_EXPIRY_MS - (now - initiatedAt);
}

/** Formats a countdown duration as m:ss. */
export function formatExpiryCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
