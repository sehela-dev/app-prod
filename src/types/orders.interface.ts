import { IResponseData } from "@/lib/config";
import { ICommonParams } from "./general.interface";
import { IEligiblePackage } from "./customers.interface";

export interface IOrderItem {
  order_id: string;
  customer_name: string;
  date_purchased: string;
  payment_method: string;
  type: string;
  price_idr: number;
  price_formatted: string;
  status: string;
  id: string;
  branch?: string;
  transfer_details?: unknown;
  detail?: IOrderDetail | null;
}

export interface IOrderDetailRefund {
  refund_id?: string;
  refund_type?: string;
  refund_status?: string;
  amount_idr?: number;
  reason?: string | null;
  requested_at?: string | null;
  confirmed_at?: string | null;
  reviewer_name?: string | null;
  reviewer_note?: string | null;
}

export interface IOrderDetailBooking {
  id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  payment_method?: string;
  booking_status?: string;
  price_idr?: number;
  revenue_idr?: number;
  cancel_reason?: string | null;
  canceled_at?: string | null;
  session?: {
    id?: string;
    session_name?: string;
    start_datetime?: string;
    place?: string;
    type?: string;
  } | null;
}

export interface IOrderDetail {
  booking?: IOrderDetailBooking | null;
  refund?: IOrderDetailRefund | null;
  refunds_count?: number;
}

export interface ICustomerData {
  name?: string;
  id?: string | number;
  phone: string;
  email: string;
  role?: string;
  is_active?: string;
  type?: string;
  package?: IEligiblePackage;
  third_party?: IThirdPartyApp;
  booking_id?: string;
  branch?: string;
}

export interface IAdminCartItemData {
  id: number | string;
  name: string;
  description?: string;
  variant?: string;
  badge?: string;
  price: number;
  quantity: number;
  subtotal: number;
  type?: string;
  share_with_user_id?: string;
  location_id?: string;
  location_name?: string;
  share_with_user_ids?: string[];
  share_with_users?:
    | {
        id: string;
        name: string;
        phone: string;
        email: string;
      }[]
    | null;
  shared_with_user?: {
    id: string;
    name: string;
    phone: string;
    email: string;
  } | null;
}
export interface IAdminCartData {
  customer?: ICustomerData;
  cart?: IAdminCartItemData[];
}
export interface IClassData {
  id: number | string;
  class: string;
  session: string;
  instructor: string;
  date: string;
  joined: number;
  capacity: number;
  price: string;
  qty: number;
}

export interface IDetailOrder {
  order_id: string;
  payment_method: string;
  status: string;
  date: string;
  discount?: number;
  discount_formatted?: string;
  subtotal: number;
  subtotal_formatted: string;
  time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  items: IOrderedItem[];
  total_price: number;
  total_price_formatted: string;
  voucher?: {
    code: string;
    name: string;
    discount_applied: number;
  };
}

export interface IOrderedItem {
  name: string;
  variant?: string;
  qty: number;
  total_price: number;
  booked_for?: {
    user_id: string;
    name: string;
  }[];
  shared_with?: {
    name: string;
    user_id: string;
  };
}

export interface IAddTransactionPayload {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  user_id?: string;
  sessions?: ISession[] | [];
  products?: IProduct[] | [];
  notes: string;
  status: string;
  transfer_details?: {
    account_name_from?: string;
    account_bank_from?: string;
    account_bank_to?: string;
  };
  branch?: string;
}

export interface ISession {
  class_session_id: string;
}
export interface IPackages {
  package_id: string;
  share_with_user_id?: string;
}

export interface IProduct {
  variant_id: string;
  quantity: number;
  location_id: string;
}

// creatae new manual trx
export interface ICreatManualTrxResponse {
  payment_id: string;
  order_code: string;
  total_price_idr: number;
  status: string;
  bookings: IBooking[];
  order: IOrder;
}

export interface IBooking {
  id: string;
  price_idr: number;
  booking_status: string;
  class_session: IClassSession;
}

export interface IClassSession {
  id: string;
  type: string;
  level: string;
  place: string;
  session_name: string;
  start_datetime: string;
}

export interface IOrder {
  id: string;
  total_price_idr: number;
  fulfillment_status: string;
  items: Item[];
}

export interface Item {
  id: string;
  quantity: number;
  product_name: string;
  variant_name: string;
  unit_price_idr: number;
  total_price_idr: number;
}

export interface IBookingPayload {
  class_session_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  user_id?: string;
  status: string;

  third_party_id?: string;

  payment_method?: string;
  package_purchase_id?: string;
}

export interface IBookingResponseData {
  booking_id: string;
  payment_id: string;
  order_id: string;
  status: string;
  payment_method: string;
  booking: Booking;
}

export interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_status: string;
  payment_method: string;
  price_idr: number;
  revenue_idr: number;
  credit_unit_value_idr: number;
  source_platform: string;
  platform_fee_idr: number;
  third_party_id: string;
  channel: string;
  created_at: string;
  class_session: ClassSession;
  third_party: ThirdParty;
}

export interface ClassSession {
  id: string;
  type: string;
  level: string;
  place: string;
  session_name: string;
  start_datetime: string;
}

export interface ThirdParty {
  id: string;
  name: string;
  deduction_type: string;
  deduction_value: number;
}

export interface IThirdPartyApp {
  id: string;
  name: string;
  deduction_type: string;
  deduction_value: number;
  deduction_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IChangeAttendance {
  id: string;
  notes?: string | null;
  attendance_status: IAttendanceStatus;
}
export interface ICancelBooking {
  id: string;
  refund_type: string;
  cancel_reason: string;
  refund_validity_days?: string | number;
  refund_amount_idr?: number;
}

export type IAttendanceStatus = "attended" | "no_show" | null;

export interface IChangeAttendanceResponse {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_status: string;
  attendance_status: string;
  payment_method: string;
  price_idr: number;
  notes?: string | null;
  class_session: IClassSession;
}
export interface IClassSession {
  id: string;
  type: string;
  place: string;
  session_name: string;
  start_datetime: string;
}

export interface IReschedulePaylaod {
  id: string;
  new_session_id: string;
  notes?: string;
}

export interface IBooking {
  id: string;
  customer_name: string;
  booking_status: string;
  attendance_status: IAttendanceStatus;
  payment_method: string;
  price_idr: number;
  rescheduled_from_booking_id: string;
  class_session: ClassSession;
}
export interface IReschdueResponse {
  message: string;
  original_booking: IBooking;
  new_bookings: IBooking;
}

export interface ISendEmailReceipt {
  id: string;
  recipient_email: string;
}

export interface IResponseSendReceipt {
  email_sent: boolean;
  recipient_email: string;
  order_code: string;
  payment_id: string;
}
export type TOrderList = (param: ICommonParams) => Promise<IResponseData<IOrderItem[]>>;
export type TOrderDetail = (id: string) => Promise<IResponseData<IDetailOrder>>;
export type TCreateManualOrder = (payload: IAddTransactionPayload) => Promise<IResponseData<ICreatManualTrxResponse>>;

export type TBookingsSession = (data: IBookingPayload) => Promise<IResponseData<IBookingResponseData>>;
export type TThirdPartyApp = () => Promise<IResponseData<IThirdPartyApp[]>>;

export type TChangeAttendanceStatus = (data: IChangeAttendance) => Promise<IResponseData<IChangeAttendanceResponse>>;
export type TRescheduleSessionCust = (data: IReschedulePaylaod) => Promise<IResponseData<IReschdueResponse>>;

export type TSendEmailReceipt = (data: ISendEmailReceipt) => Promise<IResponseData<IResponseSendReceipt>>;

export type TCancelBooking = (data: ICancelBooking) => Promise<IResponseData<unknown>>;

//void preview

export interface IVoidPreviewData {
  found: boolean;
  effects: IEffectsVoid;
  payment: IVoidPayment;
  blockers?: {
    code: string;
    message: string;
  }[];
  possible: boolean;
  warnings?: {
    code: string;
    message: string;
  }[];
  preview_token: string;
  already_voided: boolean;
  financial_disposition: FinancialDisposition;
  requires_rental_recovery_confirmation: boolean;
}

export interface IEffectsVoid {
  orders: unknown[];
  refund: Refund;
  payment: Payment;
  voucher: unknown;
  bookings: unknown[];
  packages: Package[];
  inventory: unknown[];
  reactivations: unknown[];
  rental_releases: unknown[];
  location_inventory: unknown[];
}

export interface Refund {
  status: string;
  amount_idr: number;
  refund_type: string;
  when_disposition: string;
}

export interface Payment {
  to_status: string;
  payment_id: string;
  from_status: string;
}

export interface Package {
  to_status: string;
  root_purchase: boolean;
  balance_before: number;
  ledger_adjustment: number;
  clear_pending_share: boolean;
  package_purchase_id: string;
  preserve_share_history: boolean;
}

export interface IVoidPayment {
  id: string;
  status: string;
  order_id: string;
  provider: string;
  created_at: string;
  payable_type: string;
  gross_amount_idr: number;
}

export interface FinancialDisposition {
  required: boolean;
  amount_idr: number;
  allowed_dispositions: string[];
}
export interface ICommitVoidTrx {
  preview_token: string;
  reason: string;
  financial_disposition: string;
  external_refrence?: string;
  rental_recovery_confirmed?: boolean;
}

export type TVoidPreview = (data: string) => Promise<IResponseData<IVoidPreviewData>>;
export type TCommitVoid = ({ id, payload }: { id: string; payload: ICommitVoidTrx }) => Promise<IResponseData<unknown>>;
