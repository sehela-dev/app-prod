"use client";

import { exportSalesSummaryCsv } from "@/api-req/report";
import { BackButtonComponent } from "@/components/general/back-button";
import { CustomTable } from "@/components/general/custom-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEHELA_BRANCH } from "@/constants/sample-data";
import { useGetSalesSummary } from "@/hooks/api/queries/admin/report/outstanding-credit";
import { formatCurrency } from "@/lib/helper";
import { ISalesSummaryDay } from "@/types/report.interface";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ponytail: WIB month via Intl, same as orders/refund reports
const currentWibMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

const errorMessage = (e: unknown, fallback: string) => {
  const data = (e as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data;
  return data?.error?.message ?? (e as Error | undefined)?.message ?? fallback;
};

// "2026-09-01" -> "01 Sep 2026"; raw fallback when unparseable
const formatDayDate = (value: string) => {
  try {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "dd MMM yyyy", { locale: localeId });
  } catch {
    return value;
  }
};

export const SalesSummaryView = () => {
  const [month, setMonth] = useState(currentWibMonth());
  const [branch, setBranch] = useState("all");
  const [exporting, setExporting] = useState(false);

  const monthError = useMemo(() => {
    if (!month) return "Bulan wajib diisi.";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "Format bulan tidak valid (YYYY-MM).";
    return null;
  }, [month]);

  const { data, isLoading, isError, error } = useGetSalesSummary({ month: monthError ? "" : month, branch });

  const showOther = useMemo(
    () => [...(data?.data ?? []), ...(data?.totals ? [data.totals] : [])].some((r) => (r.other ?? 0) !== 0),
    [data],
  );

  // ponytail: no footer slot in CustomTable — append totals as a bold last row, detected by index
  const hasTotals = data?.totals != null && (data?.data ?? []).length > 0;

  const tableData: ISalesSummaryDay[] = useMemo(
    () => (hasTotals ? [...(data?.data ?? []), { ...data!.totals, date: data!.totals.date ?? "" }] : (data?.data ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const isTotalRow = (_row: ISalesSummaryDay, index: number) => hasTotals && index === tableData.length - 1;
  const cell = (row: ISalesSummaryDay, index: number, v: number) =>
    isTotalRow(row, index) ? (
      <span className="font-semibold whitespace-nowrap">{formatCurrency(v ?? 0)}</span>
    ) : (
      <span className="whitespace-nowrap">{formatCurrency(v ?? 0)}</span>
    );

  const headers = useMemo(
    () => [
      {
        id: "date",
        text: "Date",
        value: (row: ISalesSummaryDay, index: number) =>
          isTotalRow(row, index) ? (
            <span className="font-semibold whitespace-nowrap">Total ({data?.totals.month})</span>
          ) : (
            <span className="whitespace-nowrap">{formatDayDate(row.date)}</span>
          ),
      },
      { id: "online_payment", text: "Bank Transfer", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.online_payment) },
      { id: "cash", text: "Cash", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.cash) },
      { id: "edc", text: "EDC", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.edc) },
      { id: "midtrans", text: "Midtrans", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.midtrans) },
      { id: "strongbee", text: "Strongbee", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.strongbee) },
      { id: "classpass", text: "ClassPass", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.classpass) },
      ...(showOther ? [{ id: "other", text: "Other", value: (row: ISalesSummaryDay, i: number) => cell(row, i, row.other) }] : []),
      {
        id: "total",
        text: "Total",
        value: (row: ISalesSummaryDay) => <span className="font-medium whitespace-nowrap">{formatCurrency(row.total ?? 0)}</span>,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showOther, data?.totals, tableData.length],
  );

  const handleExport = async () => {
    if (monthError) {
      toast.error("Bulan tidak valid", { description: monthError });
      return;
    }
    try {
      setExporting(true);
      const blob = await exportSalesSummaryCsv({ month, branch });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = branch !== "all" ? `sales_summary_${month}_${branch}.csv` : `sales_summary_${month}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e: unknown) {
      toast.error("Gagal mengunduh", { description: errorMessage(e, "Silakan coba lagi") });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <BackButtonComponent page="/admin/report">
        <span className="text-sm font-medium text-gray-500">Back to Reports</span>
      </BackButtonComponent>
      <Card className="rounded-lg border-brand-100">
        <CardHeader className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="text-brand-999 text-2xl font-semibold">Sales Summary</h3>
            <p className="text-sm font-normal text-gray-500">Daily collected sales for one month — preview matches the exported CSV.</p>
          </div>
          <div className="flex flex-row flex-wrap justify-end gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
              className="w-44"
            />
            <Select value={branch} onValueChange={setBranch}>
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
            <Button variant="outline" className="text-sm font-medium" disabled={exporting || !!monthError} onClick={handleExport}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {monthError ? (
            <p className="text-sm text-red-500">{monthError}</p>
          ) : isError && !isLoading ? (
            <p className="text-sm text-red-500">{errorMessage(error, "Failed to load report")}</p>
          ) : !isLoading && (data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for this month — try another month or clearing filters.</p>
          ) : (
            <CustomTable
              data={tableData}
              headers={headers}
              isLoading={isLoading}
              numberOptions={{ text: "No", show: false, render: (_: unknown, idx: number) => idx + 1 }}
            />
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Collected only — refunds/voids excluded (see refund-report), credits excluded (see credits ledger).
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
