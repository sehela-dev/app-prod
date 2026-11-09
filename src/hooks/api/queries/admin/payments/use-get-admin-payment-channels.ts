import { getAdminPaymentChannels } from "@/api-req/admin-payments";

import { useQuery } from "@tanstack/react-query";

export const useGetAdminPaymentChannels = () =>
  useQuery({
    queryKey: ["dashboard", "payment-channels"],
    queryFn: getAdminPaymentChannels,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
