import { getEligibleCredits } from "@/api-req/customer-app";
import { IEligibleCreditsParams } from "@/types/customer-app/booking.interface";
import { useQuery } from "@tanstack/react-query";

export const useGetEligibleCredits = (params?: IEligibleCreditsParams) =>
  useQuery({
    queryKey: ["user", "profile", "eligible-credits", params],
    queryFn: () => getEligibleCredits(params as IEligibleCreditsParams),
    enabled: !!params?.class_session_id || (!!params?.class_id && !!params?.session_type && !!params?.place),
    refetchOnWindowFocus: false,
  });
