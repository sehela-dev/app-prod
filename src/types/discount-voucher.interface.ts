import { IResponseData } from "@/lib/config";
import { ICommonParams } from "./general.interface";

export type TDiscountType = "percentage" | "fixed";
export type TCategoryVoucher = "booking" | "package_purchase" | "order" | "universal";
export type TVoucherSessionType = "regular" | "private" | "special";

export interface IVouchersListItem {
  id: string;
  name: string;
  code: string;
  description: string;
  categories: string[];
  category?: string;
  session_types?: TVoucherSessionType[] | null;
  discount_type: TDiscountType;
  discount_value: number;
  min_purchase_idr: number;
  max_discount_idr: number;
  usage_limit: number;
  usage_count: number;
  one_per_user: boolean;
  valid_from: string;
  valid_until: string;
  valid_time_from: string;
  valid_time_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ICreateVoucherPaylaod {
  name: string;
  code: string;
  categories: string[];
  discount_type: TDiscountType;
  discount_value: number;
  min_purchase_idr: number;
  max_discount_idr?: number;
  usage_limit: number;
  one_per_user: boolean;
  valid_from: string;
  valid_until: string;
  valid_time_from: string;
  valid_time_until: string;
  session_types?: TVoucherSessionType[] | null;
}

export interface IApplyDiscountPaylaod {
  code: string;
  transaction_type: string | TCategoryVoucher;
  cart_total_idr: number;
  user_id?: string | null;
}
export interface IApplyDiscountResponse {
  voucher_id: string;
  voucher_name: string;
  discount_type: string;
  discount_value: number;
  calculated_discount: number;
  original_amount: number;
  final_amount: number;
}

export type TGetVouchers = (params: ICommonParams) => Promise<IResponseData<IVouchersListItem[]>>;
export type TCreateVouchers = (data: ICreateVoucherPaylaod) => Promise<IResponseData<IVouchersListItem>>;
export type TEditVouchers = ({ data, id }: { data: ICreateVoucherPaylaod; id: string }) => Promise<IResponseData<IVouchersListItem>>;
export type TGetDiscountDetail = (data: string) => Promise<IResponseData<IVouchersListItem>>;
export type TApplyDiscount = (data: IApplyDiscountPaylaod) => Promise<IResponseData<IApplyDiscountResponse>>;
