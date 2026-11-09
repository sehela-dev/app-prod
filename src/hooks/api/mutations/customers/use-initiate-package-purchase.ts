/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { initiatePackagePurchase } from "@/api-req/customer-app";
import { getPurchaseErrorMessage, getShareErrorMessage } from "@/api-req/customer-app/payments";
import { getVoucherErrorMessage } from "@/lib/voucher";

// A3: POST /payments/initiate — on success redirect member to snap_redirect_url.
export const useInitiatePackagePurchase = () => {
  const config = useConfig();

  return useMutation({
    mutationFn: initiatePackagePurchase,
    ...config,
  });
};

const useConfig = () => {
  const onError = useCallback((error: AxiosError<any>) => {
    const responseError = error?.response?.data?.error;
    if (error?.response && error?.response?.status < 500) {
      const fallback = getShareErrorMessage(
        responseError?.code,
        responseError?.message ?? "Unable to start payment. Please try again.",
      );
      return toast.error(responseError?.code ?? "ERROR", {
        id: "error",
        description:
          getVoucherErrorMessage(responseError?.code) ||
          getPurchaseErrorMessage(responseError?.code, fallback),
        position: "top-center",
      });
    }
    return toast.error("Something Wrong!", {
      id: "error",
      description: "Please try again later!",
      position: "top-center",
    });
  }, []);

  return { onError };
};
