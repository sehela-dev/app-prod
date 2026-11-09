import { axiosx } from "@/lib/axiosx";
import { MAIN_API_URL } from "@/lib/config";
import type { IResponseData } from "@/lib/config";

// ----------------------------------------------------------------------
// Admin payment channels (FE-13/FE-14)
// ----------------------------------------------------------------------

export interface IAdminPaymentChannel {
  code: string;
  label: string;
  group_label: string;
  sort_order: number;
  is_enabled: boolean;
  icon_url?: string | null;
  midtrans_active: boolean | null;
}

export const getAdminPaymentChannels = async (): Promise<IResponseData<IAdminPaymentChannel[]>> => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/admin/payment-channels`);
  return res.data;
};

export const updateAdminPaymentChannels = async (
  channels: { code: string; is_enabled: boolean }[],
): Promise<IResponseData<IAdminPaymentChannel[]>> => {
  const res = await axiosx(true).patch(`${MAIN_API_URL}/admin/payment-channels`, { channels });
  return res.data;
};

// ----------------------------------------------------------------------
// Admin pending payments (FE-15/FE-16)
// ----------------------------------------------------------------------

export interface IPendingPayment {
  payment_id: string;
  order_id: string;
  amount_idr: number;
  status: string;
  channel: string;
  created_at: string;
  age_minutes: number;
  is_stale: boolean;
  booking_id?: string | null;
  booking_status?: string | null;
  session_name?: string | null;
  start_datetime?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  branch?: string | null;
}

export interface IPendingPaymentParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch?: string;
  stale_only?: boolean;
}

export interface IPendingPaymentRecheck {
  payment_id: string;
  order_id: string;
  status: string;
  transaction_status: string;
  booking_id?: string | null;
  booking_status?: string | null;
  late_settlement: boolean;
}

export interface IPendingExpireResult {
  checked: number;
  expired: number;
  settled: number;
  failed: number;
  remaining: number;
}

export const getPendingPayments = async (params: IPendingPaymentParams): Promise<IResponseData<IPendingPayment[]>> => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/admin/pending-payments`, {
    params: {
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.q ? { q: params.q } : {}),
      ...(params.branch && params.branch !== "all" ? { branch: params.branch } : {}),
      ...(params.stale_only ? { stale_only: true } : {}),
    },
  });
  return res.data;
};

export const recheckPendingPayment = async (paymentId: string): Promise<IResponseData<IPendingPaymentRecheck>> => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/admin/pending-payments/${paymentId}/recheck`);
  return res.data;
};

export const expirePendingPayment = async ({
  paymentId,
  reason,
}: {
  paymentId: string;
  reason: string;
}): Promise<IResponseData<IPendingExpireResult>> => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/admin/pending-payments/${paymentId}/expire`, { reason });
  return res.data;
};

export const expirePendingPayments = async ({
  payment_ids,
  reason,
}: {
  payment_ids: string[];
  reason: string;
}): Promise<IResponseData<IPendingExpireResult>> => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/admin/pending-payments/expire`, { payment_ids, reason });
  return res.data;
};
