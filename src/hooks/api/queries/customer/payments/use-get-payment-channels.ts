import { getPaymentChannels } from "@/api-req/customer-app";
import { ENV } from "@/lib/config";

import { useQuery } from "@tanstack/react-query";

// Core API channels. Prod v52/v29 routes every channel through Snap, so no
// filtering is needed there. Dev is still on the old build, where these codes
// have no snap_token — hide them until dev is redeployed.
const NATIVE_ONLY_CHANNELS = new Set([
  "bca_va",
  "bni_va",
  "bri_va",
  "cimb_va",
  "permata_va",
  "echannel",
  "other_qris",
  "gopay",
]);

// Public, enabled-only channel list. One request per checkout visit; the
// endpoint also sends a 5-min cache header.
export const useGetPaymentChannels = (enabled = true) =>
  useQuery({
    queryKey: ["customer", "payment-channels", ENV === "dev" ? "snap-only" : "api"],
    queryFn: async () => {
      const res = await getPaymentChannels();
      // shortcut: dev backend still runs the pre-Snap native path; drop this
      // guard once dev is on profile v52 / payments v29.
      if (ENV !== "dev") return res;
      return { ...res, data: res.data.filter((channel) => !NATIVE_ONLY_CHANNELS.has(channel.code)) };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
