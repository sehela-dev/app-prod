import { IPagiantion, IResponseData } from "@/lib/config";
import { ICommonParams } from "./general.interface";

export interface ITableOutstandingReportResponse {
  period: IPeriod;
  summary: ISummary;
  packages: IPackage[];
}

export interface IPeriod {
  start_date: string;
  end_date: string;
  days: number;
}

export interface ISummary {
  total_packages: number;
  by_status: ByStatus;
  totals: ITotals;
}

export interface ByStatus {
  active: number;
  not_started: number;
  expiring_soon: number;
  fully_used: number;
  expired: number;
}

export interface ITotals {
  total_credits_purchased: number;
  total_credits_remaining: number;
  total_credits_used: number;
  total_credits_expired: number;
  total_amount_paid_idr: number;
  total_outstanding_value_idr: number;
  total_used_value_idr: number;
  total_expired_value_idr: number;
}

export interface IPackage {
  package_status: string;
  validity_status?: string;
  package_purchase_id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  package_name: string;
  package_type: string;
  total_credits: number;
  credits_remaining: number;
  credits_used: number;
  credits_expired: number;
  original_price_idr: number;
  discount_idr: number;
  voucher_code: string;
  actual_amount_paid_idr: number;
  per_credit_value_idr: number;
  used_value_idr: number;
  expired_value_idr: number;
  outstanding_value_idr: number;
  purchased_at: string;
  first_used_at?: string;
  expires_at?: string;
  days_until_expiry?: number;
  is_shared: boolean;
  shared_with_name: string;
}

export interface IGenerateReportOutstanding {
  month: string | number;
  year: string | number;
  allow_incomplete?: boolean;
  force_regenerate?: boolean;
}

export interface IGeenrateOutstandingResponse {
  report_id: string;
  period: string;
  period_start: string;
  period_end: string;
  total_outstanding_credits: number;
  total_outstanding_value_idr: number;
  total_customers: number;
  total_active_packages: number;
  credits_issued: number;
  credits_used: number;
  credits_expired: number;
  opening_credits: number;
  closing_credits: number;
  summary_file: ISummaryFile;
  detail_file: IDetailFile;
  generated_at: string;
  is_cached: boolean;
  is_incomplete: boolean;
}

export interface ISummaryFile {
  file_name: string;
  storage_path: string;
  download_url: string;
}

export interface IDetailFile {
  file_name: string;
  storage_path: string;
  row_count: number;
  download_url: string;
}

export type TOutstandingCreditTable = (params: ICommonParams) => Promise<IResponseData<ITableOutstandingReportResponse>>;

export type TGenerateReportOutstandingCredit = (data: IGenerateReportOutstanding) => Promise<IResponseData<IGeenrateOutstandingResponse>>;

// Outstanding snapshot (as_of / year-month) — GET /admin/credits/outstanding/*
export interface IOutstandingDetailParams {
  asOf?: string; // YYYY-MM-DD, maps to ?as_of
  year?: number;
  month?: number;
  format?: "json" | "csv";
  page?: number;
  page_size?: number;
}

export interface IOutstandingDetailResponse {
  period: string;
  generated_at: string;
  total_packages: number;
  packages: IPackage[];
}

export interface IOutstandingSummaryData {
  period: string;
  generated_at: string;
  summary: {
    // legacy compat — keep fallback
    total_outstanding_credits: number;
    total_outstanding_value_idr: number;
    total_customers: number;
    total_active_packages: number;
    avg_credits_per_customer: number;
    opening_credits: number;
    opening_value_idr?: number;
    credits_issued: number;
    issued_value_idr?: number;
    credits_used: number;
    used_value_idr?: number;
    credits_expired: number;
    expired_value_idr?: number;
    credits_adjusted?: number;
    adjusted_value_idr?: number;
    closing_credits: number;
    closing_value_idr?: number;
    report_period?: string;
    // dual-track reconciliation WIB 23:59:59 — per CONTEXT.md Outstanding Bulanan
    pembelian_units?: number;
    pembelian_value_idr?: number;
    pemakaian_units?: number;
    pemakaian_value_idr?: number;
    expired_units?: number;
    expired_value?: number;
    reversal_units?: number;
    reversal_value_idr?: number;
    refund_units?: number;
    refund_value_idr?: number;
    admin_adj_units?: number;
    admin_adj_value_idr?: number;
    system_units?: number;
    system_value_idr?: number;
    // BE may send system_adj_* alias
    system_adj_units?: number;
    system_adj_value_idr?: number;
    net_breakage_units?: number;
    net_breakage_value_idr?: number;
    closing_snapshot_units?: number;
    closing_snapshot_value_idr?: number;
    closing_formula_units?: number;
    closing_formula_value_idr?: number;
    diff_units?: number;
    diff_value_idr?: number;
    report_generated_at?: string;
  };
  previous_month?: {
    period: string;
    closing_credits: number;
    closing_value_idr: number;
    opening_credits: number;
    opening_value_idr: number;
  };
  previous_previous_month?: {
    period: string;
    closing_credits: number;
    closing_value_idr: number;
    opening_credits: number;
    opening_value_idr: number;
  };
  by_expiry_status: { validity_status: string; credits: number; value_idr: number; packages: number }[];
  by_package_type: { package_id: string; package_name: string; package_type?: string; credits: number; value_idr: number; packages?: number; percentage: number }[];
}

export interface IOutstandingReportsParams {
  year?: number;
  month?: number;
  page?: number;
  page_size?: number;
}

export interface IOutstandingReportItem {
  report_id: string;
  period: string;
  period_start?: string;
  period_end?: string;
  summary_file: ISummaryFile;
  detail_file: IDetailFile;
  generated_at: string;
  is_incomplete: boolean;
  // mirrors summary buckets for list rows — optional until edge ships
  total_outstanding_credits?: number;
  total_outstanding_value_idr?: number;
  credits_issued?: number;
  credits_used?: number;
  credits_expired?: number;
  opening_credits?: number;
  opening_value_idr?: number;
  closing_credits?: number;
  closing_value_idr?: number;
  reversal_units?: number;
  reversal_value_idr?: number;
  refund_units?: number;
  refund_value_idr?: number;
  admin_adj_units?: number;
  admin_adj_value_idr?: number;
  system_units?: number;
  system_value_idr?: number;
  system_adj_units?: number;
  system_adj_value_idr?: number;
  net_breakage_units?: number;
  net_breakage_value_idr?: number;
  closing_snapshot_units?: number;
  closing_snapshot_value_idr?: number;
  closing_formula_units?: number;
  closing_formula_value_idr?: number;
  diff_units?: number;
  diff_value_idr?: number;
}

export type TOutstandingDetail = (params: IOutstandingDetailParams) => Promise<IResponseData<IOutstandingDetailResponse>>;
export type TOutstandingSummary = (params: Omit<IOutstandingDetailParams, "format">) => Promise<IResponseData<IOutstandingSummaryData>>;
export type TOutstandingReports = (params: IOutstandingReportsParams) => Promise<IResponseData<IOutstandingReportItem[]>>;

// /reports/cash-movement

export interface IParamsCashFlowReport extends ICommonParams {
  branch?: string;
  date?: string;
}
export interface ICashFlowResponse {
  date: string;
  branch: string | null;
  summary: ISummaryCashFlow;
  by_payment_method: ICashFlowByPaymentMethod[];
  total_transactions: number;
  transactions: ICashFlowTransaction[];
  pagination: IPagiantion;
}

export interface ISummaryCashFlow {
  collected: number;
  collected_count: number;
  refund: number;
  refund_count: number;
  voided: number;
  voided_count: number;
  outstanding: number;
  outstanding_count: number;
  net_movement: number;
}

export interface ICashFlowByPaymentMethod {
  payment_method: string;
  collected: number;
  refund: number;
  voided: number;
  outstanding: number;
  net: number;
  transaction_count: number;
}

export interface ICashFlowTransaction {
  id: string;
  order_id: string;
  payment_method: string;
  branch?: string | null;
  amount_idr: number;
  movement_type: string;
  raw_status: string;
  status: string;
  created_at: string;
  customer_name?: string;
  package_name?: string;
  package_purchase_id?: string;
  session?: {
    id: string;
    name: string;
    start_datetime: string;
  } | null;
}

// GET /admin/credits/ledger — handoff 2026-09-10 (admin v239) + reversal update.
// BE dev (admin v246): legacy `adjustment` removed, 6 ENTRY_TYPES, validation rejects `adjustment`.
export type LedgerEntryType =
  | "credit_issue"
  | "credit_spend"
  | "credit_refund"
  | "credit_expired"
  | "admin_adjustment"
  | "system_adjustment";

// Response entry_type labels (BE returns Title-case in data rows; plus snake_case adjust rows)
export type LedgerRowEntryType =
  | "Issue"
  | "Spend"
  | "Expired"
  | "Refund"
  | "Adjustment"
  | "Admin Adjustment"
  | "System Adjustment"
  | "admin_adjustment"
  | "system_adjustment";

export const REVERSAL_STATUS = "Reversal of Breakage - Reduce Revenue";
export const REVERSAL_JOURNAL = "Dr Revenue / Cr Deferred";

export type RecognitionStatus =
  | "Recognized Revenue"
  | "Deferred Future Revenue"
  | "Credit Reserved"
  | "Credit Refunded"
  | "Refund Future Revenue"
  | typeof REVERSAL_STATUS;

export type LedgerAttendance = "attended" | "no_show" | null;

// BE admin v322 (dev only): movement_reason derive post-enrich + ref_id trace key.
export type MovementReason =
  | "purchase"
  | "refund_reissue"
  | "rollover_reissue"
  | "booking_spend"
  | "booking_cancel_refund"
  | "expired_breakage"
  | "void_cancel_sale"
  | "expiry_restore"
  | "manual_correction";

export interface ICreditsLedgerParams {
  user_id?: string;
  package_purchase_id?: string;
  entry_type?: string; // csv e.g. "credit_spend,credit_refund"
  status?: string; // csv of RecognitionStatus labels (post-enrich filter)
  movement_reason?: string; // csv of MovementReason (post-enrich filter, BE v322+)
  branch?: string; // csv e.g. "studio_kemang" atau "studio_kemang,studio_pd_labu" (BE admin v295/v38+)
  start_date?: string; // YYYY-MM-DD
  end_date?: string;
  purchased_month?: string; // YYYY-MM — bulan paket dibeli (WIB)
  recognition_month?: string; // YYYY-MM — bulan pengakuan pendapatan (WIB); kosong = ikut purchased_month (BE default 7 Okt). Baris recognized bulan lain dibuang; Deferred/Reserved (month null) tetap ikut
  q?: string; // customer name OR package name OR note
  page?: number;
  page_size?: number;
  order?: "asc" | "desc";
  format?: "json" | "csv";
}

export interface ICreditsLedgerItem {
  id: string;
  entry_type: LedgerRowEntryType;
  movement_reason?: MovementReason | null;
  customer_name: string | null;
  branch: string | null; // studio_kemang / studio_pd_labu / null bila tak terlacak (BE v295/v38+)
  amount: number;
  nilai_idr: number;
  nilai_idr_gross?: number | null;
  original_amount_idr?: number | null;
  discount_idr?: number | null;
  voucher_code?: string | null;
  actual_amount_paid_idr?: number | null;
  per_credit_value_idr?: number | null;
  package_name: string | null;
  purchased_at: string | null;
  purchased_at_wib: string;
  expiry_date: string | null;
  session_date: string | null;
  attendance: LedgerAttendance;
  recognition_status: RecognitionStatus;
  recognition_month: string | null; // YYYY-MM
  note: string | null;
  ref_id?: string | null;
  recognized_at: string | null;
  created_at: string;
  created_at_wib: string;
}

export interface ICreditsLedgerMeta {
  periode: string;
  generated_at?: string;
  generated_at_wib: string;
  filters: {
    user_id?: string | null;
    package_purchase_id?: string | null;
    entry_type?: string | string[] | null;
    status?: string[] | null;
    movement_reason?: string[] | null;
    branch?: string[] | null;
    start_date: string | null;
    end_date: string | null;
    purchased_month?: string | null;
    recognition_month?: string | null;
    q: string | null;
    order?: string | null;
  };
  total_items: number;
}

export interface IDeferredBucket {
  count: number;
  credits: number;
  value_idr: number;
  journal: string;
}

export interface ICreditsLedgerSummary {
  period: string;
  // legacy alias (BE used `periode` before 2026-09-11)
  periode?: string;
  total_movements: number;
  by_type: Record<string, { count: number; credits: number; value_idr: number }>;
  by_status?: Record<string, { count: number; credits: number; value_idr: number; journal: string }>;
  net_credits: number;
  net_value_idr: number;
  outstanding: { packages: number; credits: number; value_idr: number };
  // flat aliases (keep optional for BE compat)
  outstanding_packages?: number;
  outstanding_credits?: number;
  outstanding_value_idr?: number;
  filters?: {
    user_id?: string | null;
    package_purchase_id?: string | null;
    entry_type?: string | null;
    branch?: string[] | null;
    start_date: string | null;
    end_date: string | null;
    purchased_month?: string | null;
    recognition_month?: string | null;
    q?: string | null;
  };
  deferred_buckets?: {
    // new keys (BE >= 2026-09-11)
    sold?: IDeferredBucket;
    recognized_attended?: IDeferredBucket;
    recognized_no_show?: IDeferredBucket;
    breakage?: IDeferredBucket;
    reversal?: IDeferredBucket;
    cash?: {
      sold: { count: number; value_idr: number; journal: string };
      recognized_attended: { count: number; value_idr: number; journal: string };
      recognized_no_show: { count: number; value_idr: number; journal: string };
    };
    recognized_total?: { value_idr: number; journal: string };
    ending_deferred_balance?: { value_idr: number; credits: number; packages: number; journal: string };
    // legacy keys (BE < 2026-09-11)
    terjual?: IDeferredBucket;
    diakui_hadir?: IDeferredBucket;
    diakui_no_show?: IDeferredBucket;
    diakui_total?: { value_idr: number; journal: string };
    saldo_tangguhan_akhir?: { value_idr: number; credits: number; packages: number; journal: string };
  };
}

export type TCreditsLedger = (params: ICreditsLedgerParams) => Promise<IResponseData<ICreditsLedgerItem[]> & { meta?: ICreditsLedgerMeta }>;

export type TCreditsLedgerSummary = (params: Omit<ICreditsLedgerParams, "page" | "page_size" | "order" | "format" | "status">) => Promise<IResponseData<ICreditsLedgerSummary>>;

export interface IRecognitionRunResult {
  job_date: string;
  credit_attended: number;
  credit_no_show: number;
  cash_attended: number;
  cash_no_show: number;
  breakage: number;
}

export type TCashFlowReport = (data: IParamsCashFlowReport) => Promise<IResponseData<ICashFlowResponse>>;

// GET /admin/orders?month&type&branch — monthly orders report preview (handoff: orders-monthly-csv-export).
// Now daterange-based (start_date/end_date, 90d max). `month` kept as fallback for old BE.
export type OrdersReportType = "money" | "credits" | "all";

export interface IOrdersReportParams {
  month?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  type?: OrdersReportType;
  branch?: string;
  payment_type?: string;
  transaction_type?: string;
  page?: number;
  page_size?: number;
}

export interface IOrdersReportRow {
  branch: string;
  transactionId: string;
  paymentId: string | null;
  transactionDate: string;
  customerName: string;
  totalPaid: number;
  paymentType: string;
  admin: string;
  productName: string;
  salesStatus: string;
  notes: string;
  transactionType: string;
  originalPrice: number;
  discount: number;
  voucherCode: string;
  commissionFee: number;
  sourcePlatform: string;
  commisionPct?: number | null; // BE spelling (single-s); percent, 15 = 15%
  commissionPct?: number | null;
  commissionPercentage?: number | null;
}

export interface IOrdersReportPreview {
  success: boolean;
  data: IOrdersReportRow[];
  pagination: IPagiantion;
  totals: { row_count: number; total_paid_idr: number; total_original_idr: number; total_discount_idr: number; total_commission_idr: number };
  filters: { month: string; type: string; branch: string | null; payment_type?: string | null; transaction_type?: string | null; start_date?: string | null; end_date?: string | null };
}

export type TOrdersReportPreview = (params: IOrdersReportParams) => Promise<IOrdersReportPreview>;

// GET /admin/refund-report — refund/void report preview (JSON) + CSV export.
// Rows = refunds rows only (cancel-none never appears). Oldest-first, `no` is global.
export type RefundReportStatus = "requested" | "processing" | "succeeded" | "failed";
export type RefundReportType = "refund" | "void";

export interface IRefundReportParams {
  month: string; // YYYY-MM, required
  status?: RefundReportStatus | "all";
  type?: RefundReportType | "all";
  payment_method?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface IRefundReportRow {
  no: number;
  customerName: string;
  session: string;
  paymentMethod: string;
  verdict: "Refund" | "Void";
  amountIdr: number;
  requestedAt: string;
  confirmedAt: string;
  reviewer: string;
  movement: "refund" | "voided";
  statusDisplay: string;
  transactionBy: string;
  refundId: string;
  bookingId: string | null;
  paymentId: string | null;
  refundType: string;
  rawStatus: string;
  reviewerNote: string;
}

export interface IRefundReportPreview {
  success: boolean;
  data: IRefundReportRow[];
  pagination: IPagiantion;
  totals: { row_count: number; total_amount_idr: number };
  filters: {
    month: string;
    status: string;
    type: string;
    payment_method: string | null;
    search: string | null;
  };
}

export type TRefundReportPreview = (params: IRefundReportParams) => Promise<IRefundReportPreview>;

// GET /admin/sales-summary — daily collected-sales summary for one WIB month.
// One zero-filled row per calendar day (oldest-first) + month `totals` footer.
export interface ISalesSummaryParams {
  month?: string; // YYYY-MM, defaults to current WIB month server-side
  branch?: string; // exact match; absent/blank = all
}

export interface ISalesSummaryDay {
  date: string; // YYYY-MM-DD
  online_payment: number;
  cash: number;
  edc: number;
  midtrans: number;
  strongbee: number;
  classpass: number;
  other: number;
  total: number;
}

export interface ISalesSummaryTotals extends Omit<ISalesSummaryDay, "date"> {
  month: string; // YYYY-MM
  date?: string; // BE may or may not echo a date on the footer — don't rely on it
}

export interface ISalesSummaryResponse {
  success: boolean;
  data: ISalesSummaryDay[];
  totals: ISalesSummaryTotals;
  filters: { month: string; branch: string | null };
}

export type TSalesSummary = (params: ISalesSummaryParams) => Promise<ISalesSummaryResponse>;

// GET /admin/customer-loyalty — per-customer loyalty summary (proposed endpoint, not built yet).
// One row per student (dormant included). Default sort: total_penjualan DESC, nama_customer ASC.
// WIB datetime strings render as-is — no TZ conversion.
export interface ICustomerLoyaltyRow {
  nama_customer: string;
  kontak: string | null;
  sesi_terakhir: string | null; // YYYY-MM-DD HH24:MI WIB
  jumlah_kehadiran: number;
  penjualan_terakhir_tgl: string | null; // YYYY-MM-DD HH24:MI WIB
  penjualan_terakhir_idr: number;
  total_penjualan: number;
}

export interface ICustomerLoyaltyParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: CustomerLoyaltySortBy; // BE aliases: sort, sortBy
  order?: "asc" | "desc"; // BE alias: sort_order
}

export type CustomerLoyaltySortBy = "total_penjualan" | "nama_customer" | "jumlah_kehadiran" | "sesi_terakhir";

export interface ICustomerLoyaltyResponse {
  success: boolean;
  data: ICustomerLoyaltyRow[];
  pagination?: IPagiantion;
  filters?: { search?: string | null };
}

export type TCustomerLoyalty = (params: ICustomerLoyaltyParams) => Promise<ICustomerLoyaltyResponse>;
