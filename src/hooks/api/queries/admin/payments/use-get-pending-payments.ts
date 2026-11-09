import { getPendingPayments, type IPendingPaymentParams } from "@/api-req/admin-payments";

import { useQuery } from "@tanstack/react-query";

export const useGetPendingPayments = (params: IPendingPaymentParams, enabled = true) =>
  useQuery({
    queryKey: ["dashboard", "pending-payments", params],
    queryFn: () => getPendingPayments(params),
    refetchOnWindowFocus: false,
    enabled,
  });
