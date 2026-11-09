import { axiosx } from "@/lib/axiosx";
import { MAIN_API_URL } from "@/lib/config";
import {
  ICancelBookingParams,
  ICreateBookingRequest,
  ICreatePublicBookingRequest,
  IEligibleCreditsParams,
  TCancelBooking,
  TBookingPaymentSession,
  TCreateBooking,
  TCreatePublicBooking,
  TEligibleCreditsResponse,
  TValidateVoucher,
} from "@/types/customer-app/booking.interface";

export const getEligibleCredits: TEligibleCreditsResponse = async (params: IEligibleCreditsParams) => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/credit-packages/eligible`, {
    params,
  });
  return res.data;
};

export const createBooking: TCreateBooking = async (body: ICreateBookingRequest) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/bookings`, body);
  return res.data;
};

export const createPublicBooking: TCreatePublicBooking = async (body: ICreatePublicBookingRequest) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/bookings`, body);
  return res.data;
};

export const createBookingPaymentSession: TBookingPaymentSession = async ({ bookingId, intent, payment_channel }) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/bookings/${bookingId}/payment-session`, {
    intent,
    ...(payment_channel ? { payment_channel } : {}),
  });
  return res.data;
};

export const cancelBooking: TCancelBooking = async ({ bookingId, body }: ICancelBookingParams) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/bookings/${bookingId}/cancel`, body);
  return res.data;
};

export const validateVoucher: TValidateVoucher = async (body) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/vouchers/validate`, body);
  return res.data;
};
