import { IResponseData } from "@/lib/config";

export interface IPackagePurchaseUser {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export interface IPackagePurchasePackage {
  id: string;
  name: string;
  credits: number;
  price_idr: number;
  validity_days: number;
  package_type: string | null;
}

export interface IPackagePurchasePayment {
  id: string;
  order_id: string | null;
  provider: string | null;
  status: string | null;
  gross_amount_idr: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
}

export interface IPackagePurchaseLedgerEntry {
  id: string;
  entry_type: "credit_issue" | "credit_spend" | "credit_refund" | "credit_expired" | "adjustment";
  amount: number;
  ref_id: string | null;
  note: string | null;
  unit_value_idr: number | null;
  total_value_idr: number | null;
  created_at: string;
  user_id?: string | null;
  package_purchase_id?: string | null;
  booking_session_id?: string | null;
  booking_session_name?: string | null;
  booking_session_start_at?: string | null;
  spender?: { id: string; full_name: string | null } | null;
  is_shared_credit?: boolean | null;
}

export interface IPackagePurchaseActionState {
  ledger_balance?: number;
  purchase?: {
    expires_at?: string | null;
    status?: string;
  };
}

export interface IPackagePurchaseManualAction {
  id: string;
  action_type: "credit_adjustment" | "expiry_override";
  actor: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  reason: string;
  before_state: IPackagePurchaseActionState;
  after_state: IPackagePurchaseActionState;
  created_ledger_ids: string[];
  restored_expired_ledger_ids: string[];
  created_at: string;
}

export interface IPackagePurchaseShareInfo {
  is_shared: boolean;
  share_id: string | null;
  shared_with_user_id: string | null;
  shared_with_user_name: string | null;
  shared_by_user_id: string | null;
}

export interface IPackagePurchaseDetail {
  id: string;
  user_id: string;
  credit_package_id: string;
  payment_id: string | null;
  pending_share_with_user_id?: string | null;
  shared?: IPackagePurchaseShareInfo | null;
  status: "pending_payment" | "paid" | "expired" | "refunded";
  purchased_at: string | null;
  expires_at: string | null;
  first_used_at: string | null;
  actual_amount_paid_idr: number | null;
  credits_remaining: number;
  credits_used: number;
  per_credit_value_idr: number | null;
  user: IPackagePurchaseUser | null;
  credit_package: IPackagePurchasePackage | null;
  payment: IPackagePurchasePayment | null;
  ledger_history: IPackagePurchaseLedgerEntry[];
  manual_action_history: IPackagePurchaseManualAction[];
}

export interface ICreditAdjustmentPayload {
  delta: number;
  reason: string;
}

export interface IExpiryOverridePayload {
  expires_at: string | null;
  reason: string;
}

export interface IPackagePurchaseActionResult {
  status: "succeeded";
  idempotent_replay: boolean;
  action: IPackagePurchaseManualAction;
}

export interface IPackagePurchaseApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface IPackagePurchaseErrorResponse {
  success: false;
  error: IPackagePurchaseApiError;
}

export type TGetPackagePurchaseDetail = (id: string) => Promise<IResponseData<IPackagePurchaseDetail>>;
export type TAdjustPackagePurchaseCredits = (args: {
  id: string;
  data: ICreditAdjustmentPayload;
  idempotencyKey: string;
}) => Promise<IResponseData<IPackagePurchaseActionResult>>;
export type TOverridePackagePurchaseExpiry = (args: {
  id: string;
  data: IExpiryOverridePayload;
  idempotencyKey: string;
}) => Promise<IResponseData<IPackagePurchaseActionResult>>;
