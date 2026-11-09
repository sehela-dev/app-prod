import { IResponseData } from "@/lib/config";
import type { PaymentInstructions } from "./payment.interface";

// ----------------------------------------------------------------------
// GET /credit-packages/eligible
// ----------------------------------------------------------------------

export interface IEligibleCreditsParams {
  class_session_id?: string;
  class_id?: string;
  session_type?: string;
  place?: string;
}

export interface IEligibleCreditPackage {
  package_purchase_id: string;
  package_id?: string;
  package_name: string;
  package_description: string | null;
  credits_remaining: number;
  total_credits: number;
  first_used_at: string | null;
  expires_at: string | null;
  validity_days: number;
  validity_status: string;
  session_type_restriction?: string | string[] | null;
  place_restriction?: string | string[] | null;
  class_ids_restriction?: string[] | null;
  instructor_ids_restriction?: { id: string; name: string }[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
  is_owner: boolean;
  is_shared: boolean;
  is_shareable?: boolean | null;
}

export type TEligibleCreditsResponse = (params: IEligibleCreditsParams) => Promise<IResponseData<IEligibleCreditPackage[]>>;

// ----------------------------------------------------------------------
// POST /profile/bookings (credits path)
// ----------------------------------------------------------------------

export interface ICreateBookingRequest {
  class_session_id: string;
  payment_method: "credits";
  package_purchase_id: string;
  credits_to_use?: number;
  notes?: string;
}

export interface ICreateBookingResponse {
  booking_id: string;
  ledger_id: string;
  status: string;
  payment_method: string;
  credits_used: number;
  credit_unit_value_idr: number;
  revenue_idr: number;
}

export type TCreateBooking = (body: ICreateBookingRequest) => Promise<IResponseData<ICreateBookingResponse>>;

// ----------------------------------------------------------------------
// POST /profile/bookings (cash/drop-in path) - migrated from /public/bookings 2026-08
// ----------------------------------------------------------------------

export interface ICreatePublicBookingRequest {
  class_session_id: string;
  payment_method: "credits" | "midtrans";
  voucher_code?: string;
  payment_channel?: string;
  notes?: string;
}

export interface ICreatePublicBookingResponse {
  booking_id: string;
  payment_id: string;
  order_id: string;
  amount_idr: number;
  original_amount_idr?: number;
  voucher_code?: string | null;
  voucher_discount_idr?: number;
  class_name: string;
  start_datetime: string;
  booking_status: string;
  payment_status: string;
  payment_method: string;
  snap_token?: string;
  snap_redirect_url?: string;
  enabled_payments?: string[];
  payment_instructions?: PaymentInstructions | null;
}

export type TCreatePublicBooking = (body: ICreatePublicBookingRequest) => Promise<IResponseData<ICreatePublicBookingResponse>>;

// ----------------------------------------------------------------------
// POST /profile/vouchers/validate (alias /profile/bookings/validate-voucher)
// ----------------------------------------------------------------------
export interface IValidateVoucherRequest {
  voucher_code: string;
  class_session_id?: string;
  package_id?: string;
  cart_total_idr?: number;
  transaction_type?: "booking" | "package_purchase" | "order";
}

export interface IValidateVoucherResponse {
  is_valid: boolean;
  voucher_code?: string;
  voucher_id?: string | null;
  voucher_name?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  calculated_discount: number;
  cart_total_idr: number;
  discounted_total_idr: number;
  session_types?: string[] | null;
  error_code?: string | null;
  error_message?: string | null;
}

export type TValidateVoucher = (
  body: IValidateVoucherRequest,
) => Promise<{ success: boolean; data: IValidateVoucherResponse }>;

// ----------------------------------------------------------------------
// POST /profile/bookings/:booking_id/cancel (member self-cancel)
// Probe with {} first: free window cancels immediately, penalty window
// returns requires_choice and the member must pick burn | refund_with_penalty.
// ----------------------------------------------------------------------

export type TCancelBookingChoice = "burn" | "refund_with_penalty";

export interface ICancelBookingRequest {
  cancel_reason?: string;
  choice?: TCancelBookingChoice;
}

export interface ICancelBookingParams {
  bookingId: string;
  body: ICancelBookingRequest;
}

export interface ICancelBookingData {
  window: "free" | "penalty" | "unpaid";
  booking_id?: string;
  booking_status?: string;
  requires_choice?: boolean;
  result?: "burned" | "penalty_pending" | "payment_voided";
  choices?: TCancelBookingChoice[];
  message?: string;
  hours_until_start?: number;
  penalty_amount_idr?: number;
  refund?: string;
  refund_type?: string;
  refund_id?: string | null;
  credits_refunded?: number;
  refund_package_purchase_id?: string | null;
  payment_status?: string;
  penalty_payment_id?: string;
  order_id?: string;
  snap_token?: string;
  snap_redirect_url?: string;
}

export type TCancelBooking = (params: ICancelBookingParams) => Promise<IResponseData<ICancelBookingData>>;

// ----------------------------------------------------------------------
// POST /profile/bookings/:booking_id/payment-session { intent: "retry" }
// ----------------------------------------------------------------------

export interface IRepayBookingResponse {
  booking_id: string;
  payment_id: string;
  order_id: string;
  amount_idr?: number;
  intent?: "retry" | "change";
  channel?: string | null;
  channel_label?: string | null;
  snap_token?: string;
  snap_redirect_url?: string;
  payment_instructions?: PaymentInstructions | null;
}

export interface IBookingPaymentSessionParams {
  bookingId: string;
  intent: "retry" | "change";
  payment_channel?: string;
}

export type TBookingPaymentSession = (params: IBookingPaymentSessionParams) => Promise<IResponseData<IRepayBookingResponse>>;
export type TRepayBooking = (params: IBookingPaymentSessionParams) => Promise<IResponseData<IRepayBookingResponse>>;
