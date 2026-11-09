import { axiosx } from "@/lib/axiosx";
import { MAIN_API_URL } from "@/lib/config";
import { IResponseData } from "@/lib/config";

export interface IPaymentChannel {
  code: string;
  label: string;
  group_label: string;
  sort_order: number;
  icon_url?: string | null;
}

export const getPaymentChannels = async (): Promise<IResponseData<IPaymentChannel[]>> => {
  const res = await axiosx().get(`${MAIN_API_URL}/public/payment-channels`);
  return res.data;
};
