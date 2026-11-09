import { axiosx } from "@/lib/axiosx";
import { MAIN_API_URL } from "@/lib/config";
import { IResponseData } from "@/lib/config";
import type { PaymentInstructions } from "@/types/customer-app/payment.interface";

// ----------------------------------------------------------------------
// GET /payments/status/:order_id
// ----------------------------------------------------------------------

export interface IPaymentStatus {
  id?: string;
  order_id: string;
  payment_id?: string;
  provider_txn_id?: string | null;
  booking_id?: string | null;
  /** BE returns `status` today; `transaction_status` is the new contract. */
  status?: string;
  /** Always a string: BE falls back to the local payment status before the webhook lands. */
  transaction_status: string;
  payable_type?: string | null;
  channel?: string | null;
  channel_label?: string | null;
  amount_idr?: number;
  gross_amount_idr?: number;
  snap_token?: string | null;
  snap_redirect_url?: string | null;
  payment_instructions?: PaymentInstructions | null;
  created_at?: string;
  updated_at?: string;
  payment_type?: string;
  gross_amount?: number;
  status_message?: string;
}

export type TGetPaymentStatus = (orderId: string) => Promise<IResponseData<IPaymentStatus>>;

export const getPaymentStatus: TGetPaymentStatus = async (orderId) => {
  const clean = orderId.replace(/^#+/, "").trim();
  const res = await axiosx(true).get(`${MAIN_API_URL}/payments/status/${encodeURIComponent(clean)}`);
  return res.data;
};

// ----------------------------------------------------------------------
// POST /payments/initiate (A3) — member JWT required; redirect to snap_redirect_url
// ----------------------------------------------------------------------

export interface IInitiatePackagePurchaseRequest {
  package_id: string;
  share_with_user_id?: string | null;
  share_with_email?: string | null;
  payment_channel?: string;
  voucher_code?: string;
}

export interface IInitiatePackagePurchaseResponse {
  payment_id: string;
  package_purchase_id: string;
  order_id: string;
  amount_idr: number;
  original_amount_idr?: number;
  voucher_code?: string | null;
  voucher_discount_idr?: number;
  payment_status?: string;
  snap_token: string | null;
  snap_redirect_url: string | null;
  payment_instructions?: PaymentInstructions | null;
  test_mode?: boolean;
}

export type TInitiatePackagePurchase = (
  body: IInitiatePackagePurchaseRequest,
) => Promise<IResponseData<IInitiatePackagePurchaseResponse>>;

export const initiatePackagePurchase: TInitiatePackagePurchase = async (body) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/payments/initiate`, {
    ...body,
    share_with_email: body.share_with_email?.trim().toLowerCase() || null,
  });
  return res.data;
};

// ----------------------------------------------------------------------
// POST /payments/retry — new attempt for the same package purchase.
// Omit payment_channel to retry the current method; send it to change method.
// ----------------------------------------------------------------------

export interface IRetryPackagePaymentRequest {
  order_id: string;
  payment_channel?: string;
}

export interface IRetryPackagePaymentResponse {
  payment_id: string;
  package_purchase_id: string;
  order_id: string;
  amount_idr: number;
  snap_token: string | null;
  snap_redirect_url: string | null;
  payment_instructions?: PaymentInstructions | null;
  channel?: string | null;
  channel_label?: string | null;
  test_mode?: boolean;
}

export type TRetryPackagePayment = (
  body: IRetryPackagePaymentRequest,
) => Promise<IResponseData<IRetryPackagePaymentResponse>>;

export const retryPackagePayment: TRetryPackagePayment = async (body) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/payments/retry`, body);
  return res.data;
};

// ----------------------------------------------------------------------
// POST /profile/packages/:id/share — member post-purchase share by email.
// Unused-only, no revoke. 201 → { share_id, package_purchase_id, shared_with }.
// ----------------------------------------------------------------------

export interface ISharePackagePurchaseResponse {
  share_id: string;
  package_purchase_id: string;
  shared_with: { id: string; name: string | null; email: string | null };
}

export const sharePackagePurchase = async (
  purchaseId: string,
  body: { email: string },
): Promise<IResponseData<ISharePackagePurchaseResponse>> => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/packages/${encodeURIComponent(purchaseId)}/share`, {
    email: body.email.trim().toLowerCase(),
  });
  return res.data;
};

const SHARE_ERROR_COPY: Record<string, string> = {
  SHARED_USER_NOT_FOUND: "This email is not registered. Please sign up first at book.sehelaspace.com",
  SHARE_USED: "This package has already been used, so it can no longer be shared.",
  SHARE_ALREADY: "This package has already been shared. Shared packages cannot be revoked.",
  SHARE_NOT_PAID: "This package is not paid yet. You can share it once payment settles.",
  SHARE_NOT_SHAREABLE: "This package type cannot be shared.",
  SHARE_FORBIDDEN: "You can only share your own package.",
};

export const getShareErrorMessage = (code?: string, fallback?: string) =>
  (code && SHARE_ERROR_COPY[code]) || fallback || "Unable to share this package. Please try again.";

// POST /payments/initiate|package-purchase — purchase-limit guards (source of truth).
const PURCHASE_ERROR_COPY: Record<string, string> = {
  ALREADY_PURCHASED: "You already own this one-time package.",
  NEW_USERS_ONLY: "This package is for new members only.",
};

export const getPurchaseErrorMessage = (code?: string, fallback?: string) =>
  (code && PURCHASE_ERROR_COPY[code]) || fallback || "Unable to start payment. Please try again.";

// ----------------------------------------------------------------------
// GET /payments/history (A4) — member transaction history list
// ----------------------------------------------------------------------

export interface IPackagePaymentHistoryItem {
  payment_id?: string;
  order_id?: string;
  package_id?: string;
  payable_type?: string;
  payable_id?: string;
  package_name?: string;
  package_credits?: number;
  status?: string;
  gross_amount_idr?: number;
  provider_txn_id?: string | null;
  created_at?: string;
  updated_at?: string;
  snap_token?: string;
  session_name?: string | null;
  class_name?: string | null;
  // BE contract (requested): pending rows carry these so FE can resume + count down
  // without re-initiating (each initiate creates a new payment row).
  expires_at?: string;
  snap_redirect_url?: string;
  [key: string]: unknown;
}

export type TGetPaymentHistory = (params?: {
  page?: number;
  page_size?: number;
}) => Promise<IResponseData<IPackagePaymentHistoryItem[]>>;

export const getPaymentHistory: TGetPaymentHistory = async (params) => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/payments/history`, {
    params: { page: params?.page ?? 1, page_size: params?.page_size ?? 20 },
  });
  return res.data;
};

// ----------------------------------------------------------------------
// GET /payments/history/:ref — history detail (:ref = payment uuid,
// readable order_id, or PKG-…; member JWT, own payment only else 404).
// Row plus lifecycle fields: top-ups add purchase_status/purchased_at/
// expires_at, bookings add booking_status, both add voucher_code/
// discount_idr. Snap URLs pending-only.
// ----------------------------------------------------------------------

export interface IPaymentHistoryDetail extends IPackagePaymentHistoryItem {
  purchase_status?: string | null;
  purchased_at?: string | null;
  booking_status?: string | null;
  fulfillment_status?: string | null;
  voucher_code?: string | null;
  discount_idr?: number | null;
}

export type TGetPaymentHistoryDetail = (ref: string) => Promise<IResponseData<IPaymentHistoryDetail>>;

export const getPaymentHistoryDetail: TGetPaymentHistoryDetail = async (ref) => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/payments/history/${encodeURIComponent(ref)}`);
  return res.data;
};
