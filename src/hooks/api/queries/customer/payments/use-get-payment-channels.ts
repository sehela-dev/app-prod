import { getPaymentChannels } from "@/api-req/customer-app";

import { useQuery } from "@tanstack/react-query";

// Public, enabled-only channel list. One request per checkout visit; the
// endpoint also sends a 5-min cache header.
export const useGetPaymentChannels = (enabled = true) =>
  useQuery({
    queryKey: ["customer", "payment-channels"],
    queryFn: getPaymentChannels,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
