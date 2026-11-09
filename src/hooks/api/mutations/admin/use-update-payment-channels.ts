/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosError } from "axios";

import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateAdminPaymentChannels } from "@/api-req/admin-payments";

const ERROR_COPY: Record<string, string> = {
  CHANNEL_NOT_ACTIVE_MIDTRANS: "Channel belum aktif di Midtrans",
  CHANNEL_NOT_FOUND: "Channel not found. Refreshing the list.",
  VALIDATION_ERROR: "Invalid channel change.",
};

export const useUpdateAdminPaymentChannels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminPaymentChannels,
    onSuccess: (data) => {
      // PATCH returns the full list — replace the cache, no refetch.
      queryClient.setQueryData(["dashboard", "payment-channels"], data);
      toast.success("Payment methods updated", { id: "success", position: "top-center" });
    },
    onError: (error: AxiosError<any>) => {
      const code = error?.response?.data?.error?.code as string | undefined;
      toast.error(code ?? "Unable to update payment methods", {
        id: "error",
        description: (code && ERROR_COPY[code]) || error?.response?.data?.error?.message,
        position: "top-center",
      });
      if (code === "CHANNEL_NOT_FOUND") {
        queryClient.invalidateQueries({ queryKey: ["dashboard", "payment-channels"] });
      }
    },
  });
};
