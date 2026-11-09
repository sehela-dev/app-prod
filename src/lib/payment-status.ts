// Midtrans payment statuses. `refund`/`chargeback` are terminal but not failures
// for copy purposes; callers pick the list they need.
export const PAYMENT_SUCCESS_STATUSES = ["settlement", "capture", "paid"] as const;

export const PAYMENT_FAILURE_STATUSES = [
  "deny",
  "cancel",
  "cancelled",
  "canceled",
  "expire",
  "expired",
  "failure",
  "failed",
  "refund",
  "refunded",
  "chargeback",
] as const;

export const PAYMENT_RETRYABLE_STATUSES = ["deny", "cancel", "cancelled", "canceled", "expire", "expired", "failure", "failed"] as const;

export const PAYMENT_TERMINAL_STATUSES = [...PAYMENT_SUCCESS_STATUSES, ...PAYMENT_FAILURE_STATUSES] as const;

type TPaymentStatusList = readonly string[];

export const isPaymentSuccess = (status?: string | null): boolean =>
  !!status && (PAYMENT_SUCCESS_STATUSES as TPaymentStatusList).includes(status.toLowerCase());

export const isPaymentFailure = (status?: string | null): boolean =>
  !!status && (PAYMENT_FAILURE_STATUSES as TPaymentStatusList).includes(status.toLowerCase());

export const isPaymentTerminal = (status?: string | null): boolean =>
  !!status && (PAYMENT_TERMINAL_STATUSES as TPaymentStatusList).includes(status.toLowerCase());

export const isPaymentRetryable = (status?: string | null): boolean =>
  !!status && (PAYMENT_RETRYABLE_STATUSES as TPaymentStatusList).includes(status.toLowerCase());
