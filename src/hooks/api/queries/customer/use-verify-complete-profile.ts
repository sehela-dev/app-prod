import { verifyCompleteProfileToken } from "@/api-req/customer-app/auth";
import { useQuery } from "@tanstack/react-query";

export const useVerifyCompleteProfile = (email?: string | null, token?: string | null, enabled = true) =>
  useQuery({
    queryKey: ["verify-complete-profile", email, token],
    queryFn: () => verifyCompleteProfileToken(email, token!),
    enabled: !!token && enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });
