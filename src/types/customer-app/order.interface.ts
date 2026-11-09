import { IPublicPagination } from "./public.interface";
import type { PaymentInstructions } from "./payment.interface";

export type TFulfillmentStatus = "pending" | "ready_for_pickup" | "shipped" | "completed" | "canceled";
export type TDeliveryMethod = "pickup" | "third_party";

export interface IAddress {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address: string;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface IAddressPayload {
  label?: string;
  recipient_name: string;
  phone: string;
  address: string;
  notes?: string;
  is_default?: boolean;
}

export interface ICreateOrderItem {
  variant_id: string;
  quantity: number;
}

export interface ICreateOrderPayload {
  location_id: string;
  delivery_method: TDeliveryMethod;
  address_id?: string;
  items: ICreateOrderItem[];
  notes?: string;
  payment_channel?: string;
  voucher_code?: string;
}

export interface ICreateOrderResponse {
  order_id: string;
  order_code: string;
  amount_idr: number;
  original_amount_idr?: number;
  voucher_code?: string | null;
  voucher_discount_idr?: number;
  fulfillment_status: TFulfillmentStatus;
  delivery_method: TDeliveryMethod;
  payment_status: string;
  snap_token?: string | null;
  snap_redirect_url?: string | null;
  payment_instructions?: PaymentInstructions | null;
}

export interface IOrderListItem {
  id: string;
  product_variant_id: string;
  quantity: number;
  unit_price_idr: number;
  total_price_idr: number;
  product_name: string;
  variant_name: string;
  created_at: string;
}

export interface IMemberOrder {
  id: string;
  user_id: string;
  payment_id: string;
  location_id: string;
  total_price_idr: number;
  fulfillment_status: TFulfillmentStatus;
  delivery_method: TDeliveryMethod;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_recipient_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
  cancel_reason: string | null;
  order_code: string;
  payment_status: string;
  voucher_code?: string | null;
  voucher_discount_idr?: number | null;
  items: IOrderListItem[];
  payment?: { order_id: string; status: string; provider: string } | null;
  payment_instructions?: PaymentInstructions | null;
  rental?: {
    id: string;
    status: string;
    items: { product_variant_id: string; quantity_rented: number; quantity_returned: number }[];
  } | null;
}

export interface IMemberOrdersParams {
  page?: number;
  page_size?: number;
  status?: TFulfillmentStatus;
}

export interface IMemberOrdersResponse {
  success: boolean;
  data: IMemberOrder[];
  pagination: IPublicPagination;
}

// Admin backoffice view of a product order (/admin/orders).
export interface IAdminProductOrder extends IMemberOrder {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  user?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
}

export interface IAdminProductOrdersParams {
  page?: number;
  page_size?: number;
  fulfillment_status?: TFulfillmentStatus;
}

export interface IAdminProductOrdersResponse {
  success: boolean;
  data: IAdminProductOrder[];
  pagination: IPublicPagination;
}

export interface IAdminProductOrderUpdate {
  fulfillment_status?: TFulfillmentStatus;
  delivery_method?: TDeliveryMethod;
  tracking_number?: string | null;
  tracking_url?: string | null;
}

export interface IAdminProductOrderUpdateResponse {
  success: boolean;
  data: IAdminProductOrder;
  email_sent?: boolean;
  message?: string;
}
