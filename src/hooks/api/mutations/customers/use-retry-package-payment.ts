/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { retryPackagePayment } from "@/api-req/customer-app/payments";
import { getVoucherErrorMessage } from "@/lib/voucher";

const ERROR_COPY: Record<string, string> = {
  PAYMENT_ALREADY_SETTLED: "This package is already paid.",
  PAYMENT_NOT_PENDING: "This payment is no longer pending. Refresh the page.",
  PACKAGE_UNAVAILABLE: "This package is no longer available.",
  CHANNEL_DISABLED: "This payment method is unavailable. Please pick another one.",
  CHANNEL_UNAVAILABLE: "This payment method is unavailable. Please pick another one.",
  PAYMENT_INSTRUCTIONS_UNAVAILABLE: "We couldn't prepare this payment. Please try again.",
  MIDTRANS_UNREACHABLE: "Couldn't close the current payment. Please try again.",
};

export const useRetryPackagePayment = () =>
  useMutation({
    mutationFn: retryPackagePayment,
    onError: (error: AxiosError<any>) => {
      const responseError = error?.response?.data?.error;
      const code = responseError?.code as string | undefined;
      toast.error(code ?? "ERROR", {
        id: "package-retry-error",
        description: getVoucherErrorMessage(code) || (code && ERROR_COPY[code]) || responseError?.message || "Unable to start a new payment. Please try again.",
        position: "top-center",
      });
    },
  });
