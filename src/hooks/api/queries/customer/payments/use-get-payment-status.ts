import { useEffect, useRef } from "react";

import { getPaymentStatus } from "@/api-req/customer-app";
import { isPaymentTerminal } from "@/lib/payment-status";

import { useQuery } from "@tanstack/react-query";

// Backoff 3s → 10s after 1 min → 30s after 3 min; hard stop at the 15-min
// Midtrans window so no interval outlives the payment.
const FAST_POLL_MS = 60 * 1000;
const SLOW_POLL_MS = 3 * 60 * 1000;
const MAX_POLL_MS = 15 * 60 * 1000;

export const useGetPaymentStatus = (orderId: string | null) => {
  const startedAt = useRef(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
  }, [orderId]);

  return useQuery({
    queryKey: ["user", "payments", "status", orderId],
    queryFn: () => getPaymentStatus(orderId!),
    enabled: !!orderId,
    refetchOnWindowFocus: true,
    refetchInterval: (res) => {
      // BE may return `status` instead of `transaction_status` — stop on either.
      const status = res?.data?.transaction_status ?? res?.data?.status;
      if (isPaymentTerminal(status)) return false;

      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= MAX_POLL_MS) return false;
      if (elapsed >= SLOW_POLL_MS) return 30000;
      if (elapsed >= FAST_POLL_MS) return 10000;
      return 3000;
    },
    retry: 1,
  });
};
