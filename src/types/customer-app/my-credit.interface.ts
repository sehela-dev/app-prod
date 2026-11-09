import { IResponseData } from "@/lib/config";

export interface IMyCreditItem {
  package_purchase_id: string;
  package_id: string;
  package_name: string;
  package_description: string | null;
  package_type?: string | null;
  total_credits: number;
  credits_remaining: number;
  credits_used: number;
  price_paid_idr: number;
  purchased_at: string;
  first_used_at: string | null;
  expires_at: string | null;
  validity_days: number;
  status: string;
  validity_status: string;
  is_expired: boolean;
  session_type_restriction?: string | string[] | null;
  place_restriction?: string | string[] | null;
  class_ids_restriction?: string[] | null;
  class_type_restriction?: string | string[] | null;
  instructor_ids_restriction?: { id: string; name: string }[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
  is_owner: boolean;
  is_shared: boolean;
  is_shareable?: boolean | null;
  shared_with_user_id?: string | null;
  shared_with_user_name?: string | null;
  shared_by_user_id?: string | null;
  shared_by_user_name?: string | null;
}

export interface IMyCreditParams {
  is_expired?: boolean;
  page?: number;
  page_size?: number;
  limit?: number;
}

export type TMyCreditResponse = (params?: IMyCreditParams) => Promise<IResponseData<IMyCreditItem[]>>;
