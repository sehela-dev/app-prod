/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createPublicBooking } from "@/api-req/customer-app";
import { getVoucherErrorMessage } from "@/lib/voucher";

export const useCreatePublicBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPublicBooking,
    ...useConfig(queryClient),
  });
};

const ERROR_COPY: Record<string, string> = {
  CHANNEL_DISABLED: "Metode pembayaran tidak tersedia. Please pick another one.",
  CHANNEL_UNAVAILABLE: "Metode pembayaran tidak tersedia. Please pick another one.",
  MIDTRANS_ERROR: "Payment failed. The slot has been released — please try again.",
  MIDTRANS_CONNECTION_ERROR: "Payment failed. The slot has been released — please try again.",
  PAYMENT_INSTRUCTIONS_UNAVAILABLE: "We couldn't prepare this payment. Please try again.",
  SESSION_FULL: "This session is now full.",
  DUPLICATE_BOOKING: "You already have a booking for this session.",
};

const useConfig = (queryClient: ReturnType<typeof useQueryClient>) => {
  const onError = useCallback((error: AxiosError<any>) => {
    const responseError = error?.response?.data?.error;
    const code = responseError?.code as string | undefined;
    if (error?.response) {
      return toast.error(code ?? "ERROR", {
        id: "error",
        description: getVoucherErrorMessage(code) || (code && ERROR_COPY[code]) || responseError?.message || "Something went wrong. Please try again.",
        position: "top-center",
      });
    }
    return toast.error("Something Wrong!", {
      id: "error",
      description: "Please try again later!",
      position: "top-center",
    });
  }, []);

  const onSuccess = useCallback(
    (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["user", "profile", "my-session"] });
      const result = data?.data;
      const isPaid = result?.payment_status === "paid" || Number(result?.amount_idr ?? 1) === 0;
      toast.success(isPaid ? "Booking Confirmed!" : "Booking Created!", {
        id: "success",
        description: isPaid ? "Gratis — your spot is confirmed." : "Redirecting to payment page...",
        position: "top-center",
      });
      // Return data so component can use it for redirect
      return data;
    },
    [queryClient],
  );

  return { onError, onSuccess };
};