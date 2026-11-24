"use client";

import { exportOrdersReportCsv } from "@/api-req/report";
import { DateRangePicker } from "@/components/base/date-range-picker";
import { buildNumber, CustomTable } from "@/components/general/custom-table";
import { BackButtonComponent } from "@/components/general/back-button";
import { CustomPagination } from "@/components/general/pagination-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEHELA_BRANCH } from "@/constants/sample-data";
import { useGetOrdersReport } from "@/hooks/api/queries/admin/report/outstanding-credit";
import { useAdminPermission } from "@/hooks/use-role-access";
import { defaultDate, formatCurrency } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { IOrdersReportRow } from "@/types/report.interface";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Banknote, Clock, CreditCard, Download, Landmark, Loader2, Package, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAYMENT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "edc", label: "EDC" },
  { value: "transfer", label: "Transfer" },
  { value: "midtrans", label: "Midtrans" },
  { value: "third_party", label: "Third Party" },
  { value: "paylater", label: "Paylater" },
  { value: "dp", label: "DP" },
];

const TRANSACTION_TYPES = [
  { value: "package", label: "Package" },
  { value: "class", label: "Class" },
  { value: "product", label: "Product" },
  { value: "product-sale", label: "Product Sale" },
  { value: "product-rent", label: "Product Rent" },
  { value: "mixed", label: "Mixed" },
];

const productTypeClass: Record<string, string> = {
  sale: "border-green-200 bg-green-50 text-green-700",
  rental: "border-blue-200 bg-blue-50 text-blue-700",
  "sale, rental": "border-amber-200 bg-amber-50 text-amber-700",
};

const transactionTypeClass: Record<string, string> = {
  package: "border-violet-200 bg-violet-50 text-violet-700",
  class: "border-blue-200 bg-blue-50 text-blue-700",
  product: "border-green-200 bg-green-50 text-green-700",
  mixed: "border-amber-200 bg-amber-50 text-amber-700",
};

// "2026-09-15 15:20" (WIB wall time) -> "15 September 2026, 15:20"; raw fallback when unparseable
const formatWibDate = (value: string) => {
  try {
    const parsed = new Date(value.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMMM yyyy, HH:mm", { locale: localeId });
  } catch {
    return value;
  }
};

const branchLabel = (value: string) => {
  if (!value) return "-";
  return SEHELA_BRANCH.find((b) => b.value === value)?.label ?? value.replace(/_/g, " ");
};

const salesStatusClass = (status?: string) => {
  const base = (status ?? "").split(" (")[0].toLowerCase();
  switch (base) {
    case "paid":
      return "border-green-200 bg-green-50 text-green-700";
    case "refunded":
      return "border-red-200 bg-red-50 text-red-600";
    case "voided":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "failed":
      return "border-red-200 bg-red-50 text-red-600";
    case "unpaid":
    case "pending":
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "";
  }
};

const paymentTypeStyle: Record<string, { className: string; icon: LucideIcon }> = {
  cash: { className: "border-green-200 bg-green-50 text-green-700", icon: Banknote },
  edc: { className: "border-amber-200 bg-amber-50 text-amber-700", icon: CreditCard },
  transfer: { className: "border-blue-200 bg-blue-50 text-blue-700", icon: Landmark },
  midtrans: { className: "border-violet-200 bg-violet-50 text-violet-700", icon: Zap },
  third_party: { className: "border-cyan-200 bg-cyan-50 text-cyan-700", icon: Package },
  paylater: { className: "border-orange-200 bg-orange-50 text-orange-700", icon: Clock },
  dp: { className: "border-sky-200 bg-sky-50 text-sky-700", icon: Banknote },
};

const errorMessage = async (e: unknown, fallback: string) => {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { error?: { code?: string; message?: string } };
      return parsed.error?.message ?? fallback;
    } catch {
      return fallback;
    }
  }
  return (data as { error?: { message?: string } } | undefined)?.error?.message ?? fallback;
};

export const OrdersReportView = () => {
  const { isManager } = useAdminPermission();
  const _d = defaultDate();
  const [startDate, setStartDate] = useState(_d.formattedOneMonthAgo);
  const [endDate, setEndDate] = useState(_d.formattedToday);
  const [branch, setBranch] = useState("all");
  const [paymentType, setPaymentType] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const resetPage = () => setPage(1);
  const handleRangeChange = (s: string, e?: string) => {
    if (!s && !e) {
      const d = defaultDate();
      setStartDate(d.formattedOneMonthAgo);
      setEndDate(d.formattedToday);
    } else {
      if (s) setStartDate(s);
      if (e) setEndDate(e);
      // single-day selection (e undefined) -> sync end to start so preview stays consistent
      if (s && !e) setEndDate(s);
    }
    resetPage();
  };
  // BE money-only: credits excluded, always send type=money; 90-day max enforced by picker
  const { data, isLoading, isError, error } = useGetOrdersReport({
    start_date: startDate,
    end_date: endDate,
    type: "money",
    branch,
    payment_type: paymentType,
    transaction_type: transactionType,
    page,
    page_size: limit,
  });

  // Old BE ignores month/type/branch and returns the legacy bare-array list.
  // Never map it into report rows — totals/credits would be silently wrong.
  const isLegacyShape = Array.isArray(data);

  const headers = [
    { id: "branch", text: "Branch", value: (row: IOrdersReportRow) => branchLabel(row.branch) },
    {
      id: "transactionId",
      text: "Transaction ID",
      value: (row: IOrdersReportRow) =>
        row.transactionId ? (
          row.paymentId ? (
            <a
              href={`/admin/orders/${row.paymentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-semibold whitespace-nowrap text-brand-500 underline-offset-2 hover:underline"
            >
              {row.transactionId}
            </a>
          ) : (
            <span className="font-mono whitespace-nowrap">{row.transactionId}</span>
          )
        ) : (
          <span className="text-muted-foreground italic">tanpa ID</span>
        ),
    },
    {
      id: "transactionDate",
      text: "Transaction Date",
      value: (row: IOrdersReportRow) => <span className="whitespace-nowrap">{formatWibDate(row.transactionDate)}</span>,
    },
    { id: "customerName", text: "Customer Name", value: "customerName" },
    {
      id: "paymentType",
      text: "Payment Type",
      value: (row: IOrdersReportRow) => {
        const key = (row.paymentType ?? "").toLowerCase();
        const style = paymentTypeStyle[key];
        const Icon = style?.icon;
        const isThirdParty = key === "third_party";
        const pct = row.commisionPct ?? row.commissionPct ?? row.commissionPercentage;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className={cn("capitalize", style?.className)}>
              {Icon && <Icon />}
              {row.paymentType?.replace(/_/g, " ") || "-"}
            </Badge>
            {isThirdParty && (row.sourcePlatform || typeof pct === "number") ? (
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {row.sourcePlatform || "Third party"}
                {typeof pct === "number" ? ` • ${pct}%` : ""}
              </span>
            ) : null}
          </div>
        );
      },
    },
    { id: "admin", text: "Admin", value: (row: IOrdersReportRow) => row.admin || "-" },
    {
      id: "productName",
      text: "Product Name",
      value: (row: IOrdersReportRow) =>
        row.productName ? (
          <p className="max-w-56 whitespace-normal break-words" title={row.productName}>
            {row.productName}
          </p>
        ) : (
          "-"
        ),
    },
    {
      id: "productType",
      text: "Product Type",
      value: (row: IOrdersReportRow) =>
        row.productType ? (
          <Badge variant="outline" className={cn("capitalize", productTypeClass[row.productType.toLowerCase()])}>
            {row.productType}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      id: "salesStatus",
      text: "Sales Status",
      value: (row: IOrdersReportRow) => (
        <Badge variant="outline" className={cn("capitalize", salesStatusClass(row.salesStatus))}>
          {row.salesStatus}
        </Badge>
      ),
    },
    {
      id: "notes",
      text: "Invoice notes",
      value: (row: IOrdersReportRow) =>
        row.notes ? (
          <p className="max-w-56 truncate" title={row.notes}>
            {row.notes}
          </p>
        ) : (
          "-"
        ),
    },
    {
      id: "transactionType",
      text: "Transaction Type",
      value: (row: IOrdersReportRow) => (
        <Badge variant="outline" className={cn("capitalize", transactionTypeClass[(row.transactionType ?? "").toLowerCase()])}>
          {row.transactionType?.replace(/_/g, " ") || "-"}
        </Badge>
      ),
    },
    {
      id: "originalPrice",
      text: "Original Price",
      value: (row: IOrdersReportRow) =>
        typeof row.originalPrice === "number" ? (
          <span className="whitespace-nowrap">{formatCurrency(row.originalPrice)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "discount",
      text: "Discount",
      value: (row: IOrdersReportRow) =>
        (row.discount ?? 0) > 0 ? (
          <span className="font-medium whitespace-nowrap text-amber-700">{formatCurrency(row.discount)}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      id: "voucherCode",
      text: "Voucher Code",
      value: (row: IOrdersReportRow) =>
        (row.discount ?? 0) > 0 && row.voucherCode ? (
          <span className="font-mono whitespace-nowrap">{row.voucherCode}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      id: "commissionFee",
      text: "Commission Fee",
      value: (row: IOrdersReportRow) =>
        (row.paymentType ?? "").toLowerCase() === "third_party" ? (
          <span className="whitespace-nowrap">{formatCurrency(row.commissionFee ?? 0)}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
    {
      id: "totalPaid",
      text: "Total Paid",
      value: (row: IOrdersReportRow) => <span className="font-medium whitespace-nowrap">{formatCurrency(row.totalPaid)}</span>,
    },
    {
      id: "balanceDue",
      text: "Balance Due",
      value: (row: IOrdersReportRow) =>
        (row.balanceDue ?? 0) > 0 ? (
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-medium text-amber-700">{formatCurrency(row.balanceDue)}</span>
            <span className="text-xs text-muted-foreground">{row.balanceDueDate || "-"}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
  ];

  const numberOptions = {
    text: "No",
    show: true,
    render: (_: unknown, idx: number) => buildNumber(idx, limit, page),
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportOrdersReportCsv({
        start_date: startDate,
        end_date: endDate,
        type: "money",
        branch,
        payment_type: paymentType,
        transaction_type: transactionType,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${startDate}_${endDate}_money${branch !== "all" ? `_${branch}` : ""}${paymentType !== "all" ? `_${paymentType}` : ""}${transactionType !== "all" ? `_${transactionType}` : ""
        }.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e: unknown) {
      const data = (e as { response?: { data?: unknown } })?.response?.data;
      let code: string | undefined;
      if (data instanceof Blob) {
        try {
          code = (JSON.parse(await data.text()) as { error?: { code?: string } }).error?.code;
        } catch {
          code = undefined;
        }
      } else {
        code = (data as { error?: { code?: string } } | undefined)?.error?.code;
      }
      toast.error("Gagal mengunduh", {
        description: code === "EXPORT_TOO_LARGE" ? "Too many rows — narrow filters (type or branch)." : await errorMessage(e, "Silakan coba lagi"),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex w-full items-center justify-between gap-2">
        <BackButtonComponent page="/admin/report">
          <span className="text-sm font-medium text-gray-500">Back to Reports</span>
        </BackButtonComponent>
        {isManager && (
          <Button variant="outline" className="text-sm font-medium shrink-0" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        )}
      </div>
      <Card className="rounded-lg border-brand-100">
        <CardHeader className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="text-brand-999 text-2xl font-semibold">Orders Report</h3>
            <p className="text-sm font-normal text-gray-500">Money payments only — preview matches the exported CSV (max 90 days).</p>
          </div>
          <div className="flex flex-row flex-wrap justify-end gap-2">
            <div>

              <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={handleRangeChange} maxSelectionDays={90} />
            </div>
            <Select
              value={branch}
              onValueChange={(value) => {
                setBranch(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {SEHELA_BRANCH.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentType}
              onValueChange={(value) => {
                setPaymentType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Payment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {PAYMENT_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={transactionType}
              onValueChange={(value) => {
                setTransactionType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLegacyShape ? (
            <p className="text-sm text-amber-600">
              Report API belum update — response masih format lama (list), bukan preview. Deploy edge admin dulu, lalu refresh halaman ini.
            </p>
          ) : isError && !isLoading ? (
            <p className="text-sm text-red-500">
              {(error as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message ??
                (error as Error | undefined)?.message ??
                "Failed to load report"}
            </p>
          ) : (
            <CustomTable data={data?.data ?? []} headers={headers} isLoading={isLoading} numberOptions={numberOptions} />
          )}
        </CardContent>
        <CardFooter className="flex w-full flex-col gap-2">
          {!isLegacyShape && data?.totals ? (
            <p className="text-sm font-medium">
              {data.totals.row_count} transaksi • bayar {formatCurrency(data.totals.total_paid_idr)}
              {typeof data.totals.total_original_idr === "number" ? ` (sblm. diskon ${formatCurrency(data.totals.total_original_idr)})` : ""}
              {typeof data.totals.total_discount_idr === "number" ? ` • diskon ${formatCurrency(data.totals.total_discount_idr)}` : ""}
              {typeof data.totals.total_commission_idr === "number" ? ` • komisi ${formatCurrency(data.totals.total_commission_idr)}` : ""}
            </p>
          ) : null}
          {!isLegacyShape && (
            <CustomPagination
              onPageChange={setPage}
              currentPage={page}
              showTotal
              hasPrevPage={data?.pagination?.has_prev}
              hasNextPage={data?.pagination?.has_next}
              totalItems={data?.pagination?.total_items as number}
              totalPages={data?.pagination?.total_pages as number}
              limit={limit}
            />
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
