import { getPaymentHistory } from "@/api-req/customer-app";
import { useQuery } from "@tanstack/react-query";

// A4: member transaction history list — rows include package_name, status, gross_amount_idr.
export const useGetPaymentHistory = (page = 1, pageSize = 20, enabled = true) =>
  useQuery({
    queryKey: ["user", "payments", "history", page, pageSize],
    queryFn: () => getPaymentHistory({ page, page_size: pageSize }),
    refetchOnWindowFocus: false,
    enabled,
  });
