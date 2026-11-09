import type { TVoucherSessionType } from "@/types/discount-voucher.interface";

export const VOUCHER_ERROR_COPY: Record<string, string> = {
  VOUCHER_NOT_FOUND: "Kode diskon tidak ditemukan.",
  VOUCHER_INVALID: "Kode diskon tidak valid.",
  VOUCHER_INACTIVE: "Kode diskon sudah tidak aktif.",
  VOUCHER_NOT_STARTED: "Kode diskon belum bisa dipakai.",
  VOUCHER_EXPIRED: "Kode diskon sudah kedaluwarsa.",
  VOUCHER_USAGE_LIMIT: "Kuota kode diskon sudah habis.",
  VOUCHER_ALREADY_USED: "Kamu sudah memakai kode ini.",
  VOUCHER_CATEGORY_MISMATCH: "Kode ini tidak berlaku untuk transaksi ini.",
  MIN_PURCHASE_NOT_MET: "Minimum belanja belum terpenuhi.",
  VOUCHER_SESSION_TYPE_MISMATCH: "Kode ini hanya berlaku untuk sesi yang sesuai.",
  VOUCHER_RESERVATION_FAILED: "Kode baru saja dipakai transaksi lain. Coba lagi.",
  VOUCHER_VALIDATION_ERROR: "Kode tidak bisa dicek, coba lagi.",
};

export const isVoucherErrorCode = (code?: string | null) =>
  !!code && (code.startsWith("VOUCHER_") || code === "MIN_PURCHASE_NOT_MET");

export const getVoucherErrorMessage = (code?: string | null, fallback?: string | null) =>
  (code ? VOUCHER_ERROR_COPY[code] : undefined) ?? fallback ?? undefined;

export const SESSION_TYPE_OPTIONS: { value: TVoucherSessionType; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "private", label: "Private" },
  { value: "special", label: "Special" },
];

const SESSION_TYPE_LABEL: Record<string, string> = {
  regular: "Regular",
  private: "Private",
  special: "Special",
};

export const formatSessionTypes = (types?: string[] | null) =>
  types?.length ? types.map((type) => SESSION_TYPE_LABEL[type] ?? type).join(", ") : "All session types";

export const getSessionTypeRestrictionCopy = (types?: string[] | null) =>
  types?.length ? `Kode ini hanya berlaku untuk sesi ${types.map((type) => type.toLowerCase()).join(", ")}.` : null;

export const VOUCHER_PREVIEW_NOTE = "Kode berhasil dicek. Kode akan dikunci saat kamu checkout.";
export const VOUCHER_HELD_NOTE = "Kode ditahan selama pembayaran. Kalau pembayaran kedaluwarsa, kode dilepas otomatis.";
export const VOUCHER_RELEASED_NOTE = "Kode sudah dilepas dan bisa dipakai lagi.";
export const PACKAGE_DISCOUNT_NOTE = "Kredit dari paket diskon bernilai sesuai nominal yang kamu bayarkan.";
