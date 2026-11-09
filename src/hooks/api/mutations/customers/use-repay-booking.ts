/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createBookingPaymentSession } from "@/api-req/customer-app";
import { getVoucherErrorMessage } from "@/lib/voucher";

const ERROR_COPY: Record<string, string> = {
  PAYMENT_STILL_ACTIVE: "Your payment is still active. Reopen the existing payment window.",
  PAYMENT_ALREADY_SETTLED: "Pembayaran sudah lunas",
  PAYMENT_NOT_PENDING: "This payment is no longer pending. Refresh the page.",
  CHANNEL_UNAVAILABLE: "This payment method is unavailable. Please pick another one.",
  CHANNEL_DISABLED: "This payment method is unavailable. Please pick another one.",
  PAYMENT_INSTRUCTIONS_UNAVAILABLE: "We couldn't prepare this payment. Please try again.",
  BOOKING_EXPIRED: "This booking has expired. Please make a new booking.",
  MIDTRANS_UNREACHABLE: "Tidak bisa memverifikasi pembayaran, coba lagi.",
};

export const useRepayBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBookingPaymentSession,
    ...useConfig(queryClient),
  });
};

const useConfig = (queryClient: ReturnType<typeof useQueryClient>) => {
  const onError = useCallback(
    (error: AxiosError<any>) => {
      const responseError = error?.response?.data?.error;
      const code = responseError?.code as string | undefined;

      if (code === "BOOKING_EXPIRED" || error?.response?.status === 410) {
        queryClient.invalidateQueries({ queryKey: ["user", "profile", "my-session"] });
      }
      if (code === "PAYMENT_STILL_ACTIVE" || code === "PAYMENT_ALREADY_SETTLED" || code === "PAYMENT_NOT_PENDING") {
        queryClient.invalidateQueries({ queryKey: ["user", "profile", "my-session"] });
      }
      if (code === "CHANNEL_UNAVAILABLE" || code === "CHANNEL_DISABLED") {
        queryClient.invalidateQueries({ queryKey: ["customer", "payment-channels"] });
      }

      return toast.error(code ?? "ERROR", {
        id: "error",
        description: getVoucherErrorMessage(code) || (code && ERROR_COPY[code]) || responseError?.message || "Unable to start a payment. Please try again.",
        position: "top-center",
      });
    },
    [queryClient],
  );

  const onSuccess = useCallback(
    (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["user", "profile", "my-session"] });
      queryClient.invalidateQueries({ queryKey: ["user", "payments"] });
      toast.success("New payment session created", {
        id: "success",
        description: "Opening the payment window...",
        position: "top-center",
      });
      return data;
    },
    [queryClient],
  );

  return { onError, onSuccess };
};
