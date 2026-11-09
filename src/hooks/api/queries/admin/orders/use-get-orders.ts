import { getOrders } from "@/api-req/admin-orders";
import { ICommonParams } from "@/types/general.interface";
import { useQuery } from "@tanstack/react-query";

export const useGetOrders = (params: ICommonParams, enabled = true) =>
  useQuery({
    queryKey: ["dashboard", "orders", params],
    queryFn: () => getOrders(params),
    refetchOnWindowFocus: false,
    enabled: !!params && enabled,
  });
