// Normalized Midtrans instructions from BE-16. `type` decides rendering:
// native rows have no snap token; `redirect` keeps the Snap flow.
export type PaymentInstructions =
  | {
      type: "va";
      expires_at: string;
      va: {
        bank: string;
        va_number: string | null;
        biller_code: string | null;
        bill_key: string | null;
      };
    }
  | {
      type: "qris";
      expires_at: string;
      qris: { qr_string: string | null; qr_url: string | null };
    }
  | {
      type: "ewallet";
      expires_at: string;
      ewallet: {
        deeplink_url: string | null;
        qr_string: string | null;
        qr_url: string | null;
      };
    }
  | { type: "redirect"; expires_at: string; redirect_url: string };
