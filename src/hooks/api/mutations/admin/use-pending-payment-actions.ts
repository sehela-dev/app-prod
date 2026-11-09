/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { expirePendingPayment, expirePendingPayments, recheckPendingPayment } from "@/api-req/admin-payments";

const errorToast = (error: AxiosError<any>) => {
  const code = error?.response?.data?.error?.code as string | undefined;
  const copy =
    code === "MIDTRANS_UNREACHABLE"
      ? "Midtrans is unreachable. Please try again."
      : code === "PAYMENT_ALREADY_SETTLED"
        ? "This payment is already settled."
        : code === "PAYMENT_NOT_PENDING"
          ? "This payment is no longer pending."
          : code === "PAYMENT_NOT_FOUND"
            ? "Payment not found. Refreshing the list."
            : code === "VALIDATION_ERROR"
              ? "A reason is required."
              : (error?.response?.data?.error?.message ?? "Please try again.");
  toast.error(code ?? "Unable to update payment", { id: "error", description: copy, position: "top-center" });
};

export const useRecheckPendingPayment = () =>
  useMutation({
    mutationFn: recheckPendingPayment,
    onError: errorToast,
  });

export const useExpirePendingPayment = () =>
  useMutation({
    mutationFn: expirePendingPayment,
    onError: errorToast,
  });

export const useBulkExpirePendingPayments = () =>
  useMutation({
    mutationFn: expirePendingPayments,
    onError: errorToast,
  });
