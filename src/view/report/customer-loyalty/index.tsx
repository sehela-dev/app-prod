"use client";

import { buildCustomerLoyaltyCsv, exportCustomerLoyaltyCsv } from "@/api-req/report";
import { BackButtonComponent } from "@/components/general/back-button";
import { CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useGetCustomerLoyalty } from "@/hooks/api/queries/admin/report/outstanding-credit";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import { CustomerLoyaltySortBy, ICustomerLoyaltyRow } from "@/types/report.interface";
import { TableSortState } from "@/types/table.interface";
import { Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const dash = <span className="text-muted-foreground">—</span>;

// WIB wall time already — "2026-09-17 08:30" -> "17 September 2026, 08:30", raw fallback when unparseable
const formatWib = (value: string | null) => (value ? formatDateHelper(value.replace(" ", "T"), "dd MMMM yyyy, HH:mm") || value : null);

const errorMessage = (e: unknown, fallback: string) => {
  const data = (e as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data;
  return data?.error?.message ?? (e as Error | undefined)?.message ?? fallback;
};

export const CustomerLoyaltyView = () => {
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  // ponytail: server owns order — BE defaults total_penjualan desc / nama_customer asc
  const [sort, setSort] = useState<TableSortState>({ key: "total_penjualan", direction: "desc" });
  const limit = 20;

  const { data, isLoading, isError, error } = useGetCustomerLoyalty({
    page,
    page_size: limit,
    sort_by: (sort.key as CustomerLoyaltySortBy | undefined) ?? "total_penjualan",
    order: sort.direction ?? "desc",
  });

  const handleSort = (s: TableSortState) => {
    setSort(s);
    setPage(1);
  };

  // Server-paginated: the API returns one page at a time plus pagination totals.
  const rows = useMemo(() => data?.data ?? [], [data]);
  const totalPages = Math.max(1, data?.pagination?.total_pages ?? 1);
  const totalItems = data?.pagination?.total_items ?? rows.length;

  const headers = [
    { id: "nama_customer", text: "Nama Customer", sortable: true, value: (row: ICustomerLoyaltyRow) => row.nama_customer || "-" },
    { id: "kontak", text: "Kontak", value: (row: ICustomerLoyaltyRow) => row.kontak || dash },
    {
      id: "sesi_terakhir",
      text: "Sesi Terakhir",
      sortable: true,
      value: (row: ICustomerLoyaltyRow) =>
        row.sesi_terakhir ? <span className="whitespace-nowrap">{formatWib(row.sesi_terakhir)}</span> : dash,
    },
    {
      id: "jumlah_kehadiran",
      text: "Jumlah kehadiran",
      sortable: true,
      value: (row: ICustomerLoyaltyRow) => <span className="whitespace-nowrap">{row.jumlah_kehadiran ?? 0}</span>,
    },
    {
      id: "penjualan_terakhir",
      text: "Penjualan Terakhir",
      value: (row: ICustomerLoyaltyRow) =>
        row.penjualan_terakhir_tgl ? (
          <span className="flex flex-col whitespace-nowrap">
            <span>{formatWib(row.penjualan_terakhir_tgl)}</span>
            <span className="font-medium">{formatCurrency(row.penjualan_terakhir_idr)}</span>
          </span>
        ) : (
          dash
        ),
    },
    {
      id: "total_penjualan",
      text: "Total Penjualan",
      sortable: true,
      value: (row: ICustomerLoyaltyRow) => <span className="font-medium whitespace-nowrap">{formatCurrency(row.total_penjualan)}</span>,
    },
  ];

  const handleExport = async () => {
    try {
      setExporting(true);
      // ponytail: server CSV until the endpoint ships format=csv — client-side fallback needs no UI change later
      const blob = await exportCustomerLoyaltyCsv({
        sort_by: (sort.key as CustomerLoyaltySortBy | undefined) ?? "total_penjualan",
        order: sort.direction ?? "desc",
      }).catch(() => new Blob(["\uFEFF" + buildCustomerLoyaltyCsv(rows)], { type: "text/csv;charset=utf-8" }));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customer_loyalty.csv";
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
            <h3 className="text-brand-999 text-2xl font-semibold">Customer Loyalty</h3>
            <p className="text-sm font-normal text-gray-500">Per-customer attendance and purchase summary — preview matches the exported CSV.</p>
          </div>
          <Button variant="outline" className="text-sm font-medium" disabled={exporting || rows.length === 0} onClick={handleExport}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {isError && !isLoading ? (
            <p className="text-sm text-red-500">{errorMessage(error, "Failed to load report")}</p>
          ) : !isLoading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data — the endpoint is not available yet.</p>
          ) : (
            <CustomTable
              data={rows}
              headers={headers}
              isLoading={isLoading}
              sort={sort}
              setSort={handleSort}
              numberOptions={{ text: "No", show: true, render: (_: unknown, idx: number) => (page - 1) * limit + idx + 1 }}
            />
          )}
        </CardContent>
        <CardFooter className="flex w-full flex-col gap-2">
          <CustomPagination
            onPageChange={setPage}
            currentPage={page}
            showTotal
            hasPrevPage={data?.pagination?.has_prev ?? page > 1}
            hasNextPage={data?.pagination?.has_next ?? page < totalPages}
            totalItems={totalItems}
            totalPages={totalPages}
            limit={limit}
          />
          <p className="text-xs text-muted-foreground">
            Hadir = confirmed + attended only; penjualan = settled payments, gross (see sales-summary for method split, refund-report for refunds).
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
