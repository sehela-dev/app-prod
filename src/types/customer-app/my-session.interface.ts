import { IResponseData } from "@/lib/config";
import { ICommonParams } from "../general.interface";
import type { PaymentInstructions } from "./payment.interface";

export interface IMySessionItem {
  id: string;
  booking_status: string;
  attendance_status: string;
  credits_used: number;
  cancel_reason: string;
  canceled_at: string;
  notes: string;
  created_at: string;
  voucher_code?: string | null;
  voucher_discount_idr?: number | null;
  total_paid_idr?: number | null;
  class_session: IClassSession;
  payment?: ISessionPayment;
}

export interface ISessionPayment {
  payment_id: string;
  order_id: string;
  status: string;
  provider: string;
  snap_token: string | null;
  snap_redirect_url: string | null;
  payment_instructions?: PaymentInstructions | null;
  channel?: string | null;
  channel_label?: string | null;
  /** Set on the newest row when it replaced an earlier payment. */
  supersedes?: string | null;
}

export interface IClassSession {
  id: string;
  type: string;
  level: string;
  place: string;
  status: string;
  computed_status?: string;
  is_ended?: boolean;
  room_id: string;
  location: string;
  end_datetime: string;
  meeting_link?: string;
  session_name: string;
  start_datetime: string;
  instructor_name: string;
  location_address: string;
}

export interface IMySessionDetail {
  booking_id: string;
  booking_status: string;
  attendance_status: string;
  customer_name: string;
  class_name: string;
  session_name: string;
  instructor_name: string;
  type: string;
  level: string;
  place: string;
  location: string;
  location_address: string;
  location_maps_url: string;
  meeting_link: string;
  start_datetime: string;
  order_id: string | null;
  end_datetime: string;
  room_id: string;
  payment_method: string;
  price_idr: number;
  original_amount_idr?: number | null;
  voucher_code: string;
  voucher_discount_idr: number;
  total_paid_idr: number;
  amount_paid_idr?: number | null;
  credits_used: number;
  cancel_reason: string;
  canceled_at: string;
  notes: string;
  created_at: string;
  payment?: ISessionPayment;
}

export type TMySession = (params: ICommonParams) => Promise<IResponseData<IMySessionItem[]>>;
export type TMySessionDetail = (id: string) => Promise<IResponseData<IMySessionDetail>>;
