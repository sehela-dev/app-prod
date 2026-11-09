"use client";

import { DateRangePicker } from "@/components/base/date-range-picker";
import { BackButtonComponent } from "@/components/general/back-button";
import { CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";
import { GeneralTabComponent } from "@/components/general/tabs-component";
import { CardRevenueComponent } from "@/components/page/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_LIST, SEHELA_BRANCH, YEAR_LIST, branchLabel } from "@/constants/sample-data";
import { exportCreditsLedger, exportOutstandingDetailCsv, runRecognition } from "@/api-req/report";
import { useGenerateOutstandingReport } from "@/hooks/api/mutations/admin";
import { useGetCreditsLedger } from "@/hooks/api/queries/admin/report/outstanding-credit/use-get-credits-ledger";
import { useGetCreditsLedgerSummary } from "@/hooks/api/queries/admin/report/outstanding-credit/use-get-credits-ledger-summary";
import { useGetOutstandingDetail } from "@/hooks/api/queries/admin/report/outstanding-credit/use-get-outstanding-detail";
import { useGetOutstandingSummary } from "@/hooks/api/queries/admin/report/outstanding-credit/use-get-outstanding-summary";
import { useListOutstandingReports } from "@/hooks/api/queries/admin/report/outstanding-credit/use-list-outstanding-reports";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import {
  ICreditsLedgerItem,
  ICreditsLedgerSummary,
  IGeenrateOutstandingResponse,
  IOutstandingReportItem,
  IPackage,
  LedgerEntryType,
  MovementReason,
  REVERSAL_JOURNAL,
  REVERSAL_STATUS,
  RecognitionStatus,
} from "@/types/report.interface";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BadgeDollarSign,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  FileText,
  Hourglass,
  Landmark,
  Loader2,
  PencilLine,
  Repeat,
  RotateCcw,
  Search,
  ShoppingBag,
  TimerOff,
  Undo2,
  UserX,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useGetCustomers } from "@/hooks/api/queries/admin/customers";
import { useAdminPermission } from "@/hooks/use-role-access";
import { useDebounce } from "@/hooks";
import ReactSelect from "react-select";

// Tailwind needs literal classes — do not use `bg-${color}` (purged)
const PACKAGE_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-500 text-white border-green-600" },
  not_started: { label: "Not Started", className: "bg-gray-400 text-white border-gray-500" },
  expiring_soon: { label: "Expires Soon", className: "bg-yellow-200 text-yellow-900 border-yellow-300" },
  fully_used: { label: "Fully Used", className: "bg-blue-800 text-white border-blue-900" },
  expired: { label: "Expired", className: "bg-red-500 text-white border-red-600" },
  // BE validity_status aliases
  expiring_0_7_days: { label: "Expires Soon", className: "bg-yellow-200 text-yellow-900 border-yellow-300" },
  t_started: { label: "Not Started", className: "bg-gray-400 text-white border-gray-500" },
};

const tabOption = [
  {
    name: "Ringkasan (Sisa)",
    value: "snapshot",
  },
  {
    name: "Log (Pergerakan)",
    value: "log",
  },
];

const snapshotTabOption = [
  { name: "Pratinjau", value: "preview" },
  { name: "Ekspor", value: "export" },
];

const defaultValues = {
  month: "",
  year: "",
};

export const OutstandingCreditView = () => {
  const methods = useForm({ defaultValues });
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isManager } = useAdminPermission();
  const legacyView = searchParams.get("view");
  const initialTab = legacyView === "log" ? "log" : "snapshot";
  const initialSubTab = searchParams.get("subview") === "export" || legacyView === "export" ? "export" : "preview";
  const [tabs, setTabs] = useState(initialTab);
  const [snapshotTab, setSnapshotTab] = useState(initialSubTab);

  const todayStr = new Date().toISOString().slice(0, 10);
  // YYYY-MM is source of truth for monthly closing (wib_month_end) — as_of is lazy daily preview only
  const initialYear = Number(searchParams.get("year") ?? searchParams.get("as_of")?.slice(0, 4) ?? todayStr.slice(0, 4));
  const initialMonth = Number(searchParams.get("month") ?? searchParams.get("as_of")?.slice(5, 7) ?? todayStr.slice(5, 7));
  const initialAsOf = searchParams.get("as_of") ?? "";
  const [closingYear, setClosingYear] = useState(initialYear);
  const [closingMonth, setClosingMonth] = useState(initialMonth);
  const [previewAsOf, setPreviewAsOf] = useState(initialAsOf);
  const [page, setPage] = useState(1);
  const [csvExporting, setCsvExporting] = useState(false);
  const [snapshotMetric, setSnapshotMetric] = useState<"idr" | "units">("idr");

  const handleClosingChange = (y: number, m: number) => {
    setClosingYear(y);
    setClosingMonth(m);
    setPage(1);
  };
  const handlePreviewAsOfChange = (startDate: string) => {
    if (startDate && startDate > todayStr) {
      toast.error("Tanggal tidak boleh di masa depan");
      return;
    }
    setPage(1);
    setPreviewAsOf(startDate);
  };
  const todayYear = Number(todayStr.slice(0, 4));
  const todayMonth = Number(todayStr.slice(5, 7));
  const isPreviewFilterDirty = previewAsOf !== "" || closingYear !== todayYear || closingMonth !== todayMonth;
  const handleResetPreviewFilter = () => {
    setClosingYear(todayYear);
    setClosingMonth(todayMonth);
    setPreviewAsOf("");
    setPage(1);
  };

  // sync tab + YYYY-MM / as_of to URL — closing book is year+month, as_of daily preview is optional
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (tabs === "log") {
      p.set("view", "log");
      p.delete("subview");
      p.delete("as_of");
      p.delete("year");
      p.delete("month");
    } else {
      p.delete("view");
      if (snapshotTab === "export") p.set("subview", "export");
      else p.delete("subview");
      if (snapshotTab === "preview") {
        if (previewAsOf) p.set("as_of", previewAsOf);
        else p.delete("as_of");
        // always persist closing month so refresh lands same book — even when as_of drives query
        p.set("year", String(closingYear));
        p.set("month", String(closingMonth));
      } else if (snapshotTab !== "preview") {
        p.delete("as_of");
        p.delete("year");
        p.delete("month");
      }
    }
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, snapshotTab, previewAsOf, closingYear, closingMonth]);

  const formField = methods.watch();

  const [generatedFile, setGeneratedFile] = useState<IGeenrateOutstandingResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forceRegen, setForceRegen] = useState(false);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [periodNotEnded, setPeriodNotEnded] = useState(false);

  const runGenerate = async (opts: { allow_incomplete?: boolean; force_regenerate?: boolean }) => {
    const payload = {
      month: formField.month as string,
      year: formField.year as string,
      ...(opts.allow_incomplete ? { allow_incomplete: true } : {}),
      ...(opts.force_regenerate ? { force_regenerate: true } : {}),
    };
    try {
      setPeriodNotEnded(false);
      const res = await mutateAsync(payload);
      if (res) setGeneratedFile(res?.data);
    } catch (e: unknown) {
      const code = (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      if (code === "PERIOD_NOT_ENDED") setPeriodNotEnded(true);
    }
  };

  const onSubmit = methods.handleSubmit(() => setConfirmOpen(true));

  // Closing book is YYYY-MM (prev_end→curr_end via wib_month_end) — as_of is optional daily preview deriving WIB month
  const outstandingQuery = previewAsOf ? { asOf: previewAsOf } : { year: closingYear, month: closingMonth };
  const {
    data: detailData,
    isLoading: detailLoading,
    isFetching: detailFetching,
    isError: detailError,
    error: detailErr,
  } = useGetOutstandingDetail(outstandingQuery);
  const { data: summaryData, isLoading: summaryLoading } = useGetOutstandingSummary(outstandingQuery);

  const { mutateAsync, isPending } = useGenerateOutstandingReport();

  const headers = [
    {
      id: "customer-name",
      text: "Nama Customer",
      value: "customer_name",
    },

    {
      id: "package-name",
      text: "Nama Paket",
      value: "package_name",
    },
    {
      id: "package_status",
      text: "Status Paket",
      value: (row: IPackage) => {
        const key = (row as unknown as { package_status?: string; validity_status?: string }).validity_status ?? row.package_status ?? "";
        const s = PACKAGE_STATUS[key] ?? { label: key ? key.replace(/_/g, " ") : "-", className: "bg-gray-100 text-gray-700 border-gray-200" };
        return <Badge className={`${s.className} capitalize`}>{s.label}</Badge>;
      },
    },
    {
      id: "total-credits",
      text: "Total Kredit",
      value: "total_credits",
    },
    {
      id: "credits-remaining",
      text: "Sisa Kredit",
      value: "credits_remaining",
    },
    {
      id: "credits-used",
      text: "Kredit Terpakai",
      value: "credits_used",
    },
    {
      id: "credits-expired",
      text: "Kredit Kedaluwarsa",
      value: "credits_expired",
    },
    {
      id: "outstanding-value-idr",
      text: "Nilai Sisa (IDR)",
      value: (row: IPackage) => (
        <span className="flex items-center gap-2">
          {formatCurrency(row.outstanding_value_idr)}
          {(row.package_type === "refund" || row.package_type === "rollover") && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              {row.package_type}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "purchased-at",
      text: "Dibeli pada",
      value: (row: IPackage) => (row?.purchased_at ? formatDateHelper(row.purchased_at as string) : "-"),
    },
    {
      id: "expired-at",
      text: "Kedaluwarsa pada",
      value: (row: IPackage) => (row?.expires_at ? formatDateHelper(row.expires_at as string) : "-"),
    },
    {
      id: "days-until-expiry",
      text: "Hari hingga Kedaluwarsa",
      value: "days_until_expiry",
    },
  ];
  return (
    <div className="flex flex-col gap-4 min-w-0 w-full max-w-full overflow-hidden">
      <BackButtonComponent page="/admin/report">
        <span className="text-sm font-medium text-gray-500">Back to Reports</span>
      </BackButtonComponent>
      <GeneralTabComponent tabs={tabOption} selecetedTab={tabs} setTab={setTabs} />
      {tabs === "snapshot" && (
        <div className="flex flex-col gap-4 min-w-0 max-w-full overflow-hidden">
          <GeneralTabComponent tabs={snapshotTabOption} selecetedTab={snapshotTab} setTab={setSnapshotTab} variant="line" />
          {snapshotTab === "preview" && (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
                          <CalendarDays size={14} />
                        </span>
                        Pratinjau Sisa Kredit
                      </CardTitle>
                      <CardDescription>
                        Buku bulanan per cutoff WIB 23:59:59. Pilih Bulan closing untuk angka resmi, atau isi Pratinjau harian untuk cek harian.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={!isPreviewFilterDirty}
                      onClick={handleResetPreviewFilter}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset filter
                    </Button>
                  </div>
                  <div className="mt-3 rounded-lg border bg-card px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">Cara baca filter ini:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      <li>
                        <span className="font-medium text-foreground">Bulan closing</span> = buku resmi bulan itu (acuan utama). Cutoff akhir bulan
                        jam 23:59:59 WIB. Ini yang dikunci saat Generate.
                      </li>
                      <li>
                        <span className="font-medium text-foreground">Pratinjau harian (opsional)</span> = intip posisi pada tanggal tertentu. Begitu
                        tanggal diisi, data di bawah memakai tanggal itu dan pilihan Bulan closing diabaikan — bulan otomatis mengikuti tanggal
                        tersebut.
                      </li>
                      <li>
                        Kosongkan tanggal untuk kembali ke angka Bulan closing. Tombol <span className="font-medium">Reset filter</span> mengembalikan
                        keduanya ke bulan berjalan.
                      </li>
                    </ul>
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    {previewAsOf ? (
                      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                        Mode: Pratinjau harian · {previewAsOf} (Bulan closing diabaikan)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-white">
                        Mode: Bulan closing · {String(closingYear)}-{String(closingMonth).padStart(2, "0")}
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-xl border bg-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          Bulan closing <span className="font-normal text-muted-foreground">— angka resmi</span>
                        </p>
                        <Badge variant="outline" className="bg-white text-[11px]">
                          Angka resmi
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Select value={String(closingMonth)} onValueChange={(v) => handleClosingChange(closingYear, Number(v))}>
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Bulan" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_LIST.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(closingYear)} onValueChange={(v) => handleClosingChange(Number(v), closingMonth)}>
                          <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Tahun" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEAR_LIST.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock3 size={12} /> Cutoff WIB akhir bulan jam 23:59:59
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="mb-3 text-sm font-semibold">
                        Pratinjau harian <span className="font-normal text-muted-foreground">(opsional — cek harian)</span>
                      </p>
                      <DateRangePicker
                        mode="single"
                        startDate={previewAsOf}
                        onDateRangeChange={handlePreviewAsOfChange}
                        allowPastDates
                        allowFutureDates={false}
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Tanggal terisi = data memakai tanggal itu, bulan otomatis ikut tanggal tersebut. Tanggal masa depan ditolak.
                      </p>
                      {previewAsOf ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => {
                            setPreviewAsOf("");
                            setPage(1);
                          }}
                        >
                          Hapus — kembali ke Bulan closing
                        </Button>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Kosong = tampilkan angka Bulan closing di sebelah kiri. Bukan rentang tanggal.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {(detailLoading || summaryLoading) && (detailFetching || summaryLoading) ? (
                <Card>
                  <CardContent className="space-y-3 py-6">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Skeleton className="h-28 w-full rounded-xl" />
                      <Skeleton className="h-28 w-full rounded-xl" />
                    </div>
                    <Skeleton className="h-64 w-full rounded-xl" />
                  </CardContent>
                </Card>
              ) : detailError ? (
                <Alert variant="destructive">
                  <AlertTriangle size={16} />
                  <AlertTitle>Gagal memuat ringkasan sisa kredit</AlertTitle>
                  <AlertDescription>
                    <p className="text-xs">
                      {(detailErr as unknown as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
                        (detailErr as Error)?.message ??
                        "Silakan coba lagi atau ubah filternya."}
                    </p>
                    <p className="mt-1 text-xs">Tips: kosongkan tanggal pratinjau dan gunakan filter bulan/tahun.</p>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {(() => {
                    const root = (summaryData as unknown as { data?: Record<string, unknown> })?.data ?? {};
                    const raw = root as unknown as { summary?: Record<string, unknown> } | undefined;
                    const unwrapped =
                      (raw as unknown as { summary?: Record<string, unknown> })?.summary ?? (raw as unknown as Record<string, unknown> | undefined);
                    const s = (unwrapped ?? {}) as Record<string, unknown>;
                    const n = (v: unknown) => (typeof v === "number" ? v : 0);
                    // snapshot is source of truth per handoff §1 — closing_snapshot wins over closing_formula
                    const snapUnits = (s.closing_snapshot_units as number | undefined) ?? (s.total_outstanding_credits as number | undefined) ?? 0;
                    const snapIdr =
                      (s.closing_snapshot_value_idr as number | undefined) ?? (s.total_outstanding_value_idr as number | undefined) ?? 0;
                    // compat fallback when dual-track not yet shipped (edge v246)
                    const hasRecon = s.pembelian_units !== undefined || s.diff_units !== undefined;
                    const totalCreditsFbk =
                      (s.total_outstanding_credits as number | undefined) ??
                      (detailData as unknown as { data?: { total_packages?: number } })?.data?.total_packages ??
                      snapUnits;
                    const totalValueFbk = (s.total_outstanding_value_idr as number | undefined) ?? snapIdr;
                    const totalCredits = hasRecon ? snapUnits : totalCreditsFbk;
                    const totalValue = hasRecon ? snapIdr : totalValueFbk;
                    const closingMm = `${String(closingYear).padStart(4, "0")}-${String(closingMonth).padStart(2, "0")}`;
                    const periodLabel =
                      (s.report_period as string | undefined) ??
                      (s.period as string | undefined) ??
                      (previewAsOf ? previewAsOf.slice(0, 7) : closingMm);
                    const openingUnits = n(s.opening_credits);
                    const openingIdr = n((s.opening_value_idr as number | undefined) ?? 0);
                    const diffUnits = s.diff_units as number | undefined;
                    const diffIdr = s.diff_value_idr as number | undefined;
                    const diffNonZero = (diffUnits !== undefined && diffUnits !== 0) || (diffIdr !== undefined && diffIdr !== 0);
                    // rantai opening(n) = closing(n-1) — BE kirim previous_month sejajar summary
                    const prev = (root as unknown as { previous_month?: { period: string; closing_credits: number; closing_value_idr: number } })
                      .previous_month;
                    const prevPrev = (
                      root as unknown as { previous_previous_month?: { period: string; closing_credits: number; closing_value_idr: number } }
                    ).previous_previous_month;
                    const chainUnitsOk = prev ? openingUnits === (prev.closing_credits ?? 0) : true;
                    const chainIdrOk = prev ? openingIdr === (prev.closing_value_idr ?? 0) : true;
                    const chainOk = chainUnitsOk && chainIdrOk;
                    return (
                      <div className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="hidden h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:flex">
                              <Wallet size={16} />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold tracking-tight">{periodLabel}</p>
                                <Badge variant="outline" className="text-[11px] font-normal">
                                  WIB 23:59:59
                                </Badge>
                                {!hasRecon && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                                    Lama
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Cutoff WIB 23:59:59 — data jam 23:59 WIB masuk ke bulan pemulihan, bukan bulan kedaluwarsa
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 rounded-full border bg-muted p-1">
                            <button
                              type="button"
                              onClick={() => setSnapshotMetric("idr")}
                              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${snapshotMetric === "idr" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              IDR
                            </button>
                            <button
                              type="button"
                              onClick={() => setSnapshotMetric("units")}
                              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${snapshotMetric === "units" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              Unit
                            </button>
                          </div>
                        </div>
                        {prev &&
                          !previewAsOf &&
                          (chainOk ? (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={14} /> Rantai OK — saldo awal = saldo akhir {prev.period} (
                              {(prev.closing_credits ?? 0).toLocaleString("en-US")} · {formatCurrency(prev.closing_value_idr ?? 0)}).
                            </div>
                          ) : (
                            <Alert className="bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-amber-600">
                              <AlertTriangle size={16} />
                              <AlertTitle className="text-amber-800">Opening ≠ closing bulan lalu</AlertTitle>
                              <AlertDescription className="text-amber-800/90">
                                Saldo awal {openingUnits.toLocaleString("en-US")} · {formatCurrency(openingIdr)} vs saldo akhir {prev.period}{" "}
                                {(prev.closing_credits ?? 0).toLocaleString("en-US")} · {formatCurrency(prev.closing_value_idr ?? 0)}. Periksa urutan
                                pengisian data dari yang terlama, atau catat bila ini reset akuntansi yang disengaja.
                              </AlertDescription>
                            </Alert>
                          ))}
                        {(prev || prevPrev) && (
                          <div className="flex flex-wrap items-stretch gap-2 rounded-xl border bg-card px-4 py-3">
                            <p className="w-full text-[11px] font-medium text-muted-foreground">
                              Bulan sebelumnya — saldo akhir per 23:59:59 WIB (utama Rupiah)
                            </p>
                            {[
                              prevPrev
                                ? { period: prevPrev.period, credits: prevPrev.closing_credits ?? 0, idr: prevPrev.closing_value_idr ?? 0 }
                                : null,
                              prev ? { period: prev.period, credits: prev.closing_credits ?? 0, idr: prev.closing_value_idr ?? 0 } : null,
                              { period: periodLabel, credits: totalCredits, idr: totalValue },
                            ]
                              .filter((x): x is { period: string; credits: number; idr: number } => x !== null)
                              .map((b, i, arr) => (
                                <div key={b.period} className="flex min-w-0 flex-1 items-center gap-2">
                                  {i > 0 && <span className="shrink-0 text-muted-foreground">→</span>}
                                  <div className={`min-w-0 flex-1 rounded-lg px-3 py-2 ${i === arr.length - 1 ? "bg-brand-50/60" : "bg-muted/40"}`}>
                                    <p className="text-[11px] text-muted-foreground">
                                      {b.period}
                                      {i === arr.length - 1 ? " · kini" : " · saldo akhir"}
                                    </p>
                                    <p className="truncate text-sm font-semibold tabular-nums">{formatCurrency(b.idr)}</p>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">{b.credits.toLocaleString("en-US")} kredit</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <CardRevenueComponent
                            amount={snapshotMetric === "idr" ? formatCurrency(String(totalValue)) : `${totalCredits.toLocaleString("en-US")}`}
                            title={`Saldo Akhir · ${periodLabel}`}
                            subtitle={snapshotMetric === "idr" ? `${totalCredits.toLocaleString("en-US")} kredit` : formatCurrency(totalValue)}
                            footer={
                              <span className="inline-flex items-center gap-1.5">
                                Saldo awal {openingUnits.toLocaleString("en-US")} · {formatCurrency(openingIdr)}
                                <Separator orientation="vertical" className="h-3" />
                                {previewAsOf ? `pratinjau ${previewAsOf}` : `cutoff WIB 23:59:59`}
                              </span>
                            }
                            icon={<Wallet style={{ color: "var(--color-gray-400)" }} size={18} />}
                            className="border-brand-100 shadow-sm hover:shadow-md transition-shadow"
                          />
                          <CardRevenueComponent
                            amount={formatCurrency(String(totalValue))}
                            title="Nilai Sisa"
                            subtitle={`${totalCredits.toLocaleString("en-US")} kredit · utama dalam Rupiah`}
                            footer="Angka resmi bulan berjalan"
                            icon={<DollarSign style={{ color: "var(--color-gray-400)" }} size={18} />}
                            className="border-brand-100 shadow-sm hover:shadow-md transition-shadow"
                          />
                        </div>
                        {hasRecon && (
                          <ReconciliationTable summary={s as unknown as import("@/types/report.interface").IOutstandingSummaryData["summary"]} />
                        )}
                        {hasRecon && diffNonZero && (
                          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 [&>svg]:text-red-600">
                            <AlertTriangle size={16} />
                            <AlertTitle className="text-red-700">Ada selisih</AlertTitle>
                            <AlertDescription className="text-red-700/90">
                              Ada perbedaan antara saldo akhir dan hasil hitungan — hubungi tim terkait, jangan koreksi manual. Selisih:{" "}
                              <span className="font-mono font-medium">{diffUnits != null ? `${diffUnits.toLocaleString("en-US")} unit` : "—"}</span> ·{" "}
                              <span className="font-mono font-medium">{diffIdr != null ? formatCurrency(diffIdr) : "—"}</span>
                            </AlertDescription>
                          </Alert>
                        )}
                        {hasRecon && !diffNonZero && diffUnits !== undefined && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={14} /> Sudah cocok — tidak ada selisih.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <Card className="overflow-hidden min-w-0 max-w-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm">
                          Outstanding Detail —{" "}
                          {previewAsOf
                            ? `preview ${previewAsOf}`
                            : `closing ${String(closingYear).padStart(4, "0")}-${String(closingMonth).padStart(2, "0")}`}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Cutoff 23:59:59 WIB
                          {detailData && (detailData as unknown as { data?: { total_packages?: number } })?.data?.total_packages != null
                            ? ` · ${(detailData as unknown as { data: { total_packages: number } }).data.total_packages} paket`
                            : ""}
                        </CardDescription>
                      </div>
                      <CardAction>
                        {isManager && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={csvExporting}
                            onClick={async () => {
                              try {
                                setCsvExporting(true);
                                const q = previewAsOf ? { asOf: previewAsOf } : { year: closingYear, month: closingMonth };
                                const blob = await exportOutstandingDetailCsv(q);
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `outstanding_detail_${previewAsOf ? previewAsOf : `${closingYear}-${String(closingMonth).padStart(2, "0")}`
                                  }.csv`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } catch (e: unknown) {
                                toast.error("Gagal mengunduh", {
                                  description:
                                    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
                                    "Silakan coba lagi",
                                });
                              } finally {
                                setCsvExporting(false);
                              }
                            }}
                          >
                            {csvExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            CSV
                          </Button>
                        )}
                      </CardAction>
                    </CardHeader>
                    <CardContent className="p-0 pt-2 min-w-0 max-w-full overflow-hidden">
                      <Separator className="mb-4" />
                      {(() => {
                        const pkgs = ((detailData as unknown as { data?: { packages?: IPackage[] } })?.data?.packages ?? []) as IPackage[];
                        const pageSize = 20;
                        const total = pkgs.length;
                        const paged = pkgs.slice((page - 1) * pageSize, page * pageSize);
                        return (
                          <div className="flex flex-col gap-4 min-w-0 max-w-full">
                            <div className="overflow-x-auto max-w-full px-6">
                              <CustomTable headers={headers} data={paged} />
                            </div>
                            {total > pageSize && (
                              <div className="px-6 pb-6">
                                <CustomPagination
                                  currentPage={page}
                                  totalItems={total}
                                  totalPages={Math.ceil(total / pageSize)}
                                  limit={pageSize}
                                  hasNextPage={page * pageSize < total}
                                  hasPrevPage={page > 1}
                                  onPageChange={setPage}
                                  showTotal
                                />
                              </div>
                            )}
                            {total === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4 px-6">
                                Tidak ada sisa paket{" "}
                                {previewAsOf
                                  ? `per ${previewAsOf}`
                                  : `untuk tutup bulan ${String(closingYear).padStart(4, "0")}-${String(closingMonth).padStart(2, "0")}`}
                                .
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
          {snapshotTab === "export" && (
            <>
              <Card>
                <CardHeader className="text-2xl font-semibold">Kunci Bulan — Sisa Kredit</CardHeader>
                <CardContent>
                  <FormProvider {...methods}>
                    <form onSubmit={onSubmit}>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={methods.control}
                          name={`month`}
                          rules={{
                            required: "Wajib diisi!",
                          }}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm" required>
                                Pilih Bulan
                              </FormLabel>
                              <FormControl>
                                <Select
                                  {...field}
                                  onValueChange={(e) => {
                                    field.onChange(e);
                                  }}
                                  defaultValue={field.value ?? ""}
                                  value={field.value ?? ""}
                                >
                                  <SelectTrigger className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]">
                                    <SelectValue placeholder="Pilih Bulan" className="!text-gray-400" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {MONTH_LIST.map((item) => (
                                        <SelectItem value={item.value} key={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={methods.control}
                          name={`year`}
                          rules={{
                            required: "Wajib diisi!",
                          }}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm" required>
                                Pilih Tahun
                              </FormLabel>
                              <FormControl>
                                <Select
                                  {...field}
                                  onValueChange={(e) => {
                                    field.onChange(e);
                                  }}
                                  defaultValue={field.value ?? ""}
                                  value={field.value ?? ""}
                                >
                                  <SelectTrigger className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]">
                                    <SelectValue placeholder="Pilih Tahun" className="!text-gray-400" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {YEAR_LIST.map((item) => (
                                        <SelectItem value={item} key={item}>
                                          {item}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex flex-row items-center w-full justify-end gap-4 pt-4">
                        <div>
                          <Button
                            type="button"
                            variant={"secondary"}
                            onClick={() => {
                              methods.reset();
                              setGeneratedFile(null);
                              setPeriodNotEnded(false);
                            }}
                          >
                            Bersihkan
                          </Button>
                        </div>
                        <div>
                          <Button disabled={!methods.formState.isValid || isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Kunci Bulan
                          </Button>
                        </div>
                      </div>
                    </form>
                  </FormProvider>
                  {periodNotEnded && (
                    <div className="px-6 pb-6">
                      <Alert className="bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-amber-600">
                        <AlertTriangle size={16} />
                        <AlertTitle className="text-amber-800">Bulan belum berakhir</AlertTitle>
                        <AlertDescription className="flex flex-wrap items-center gap-2 text-amber-800/90">
                          Cutoff WIB 23:59:59 akhir bulan belum lewat. Untuk arsip final tunggu T+1; atau simpan sebagai draf.
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => runGenerate({ allow_incomplete: true, force_regenerate: forceRegen })}
                          >
                            Simpan sebagai draf
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Kunci bulan {MONTH_LIST.find((p) => p.value === formField.month)?.label} {formField.year}?
                    </DialogTitle>
                    <DialogDescription>
                      Generate mengunci angka resmi WIB 23:59:59 ke arsip + CSV. Pastikan tidak ada selisih sebelum mengunci.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-1">
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={forceRegen} onCheckedChange={(v) => setForceRegen(v === true)} />
                      <span>Tulis ulang bila bulan ini sudah dikunci. Tanpa ini data lama dipakai kembali.</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox checked={allowIncomplete} onCheckedChange={(v) => setAllowIncomplete(v === true)} />
                      <span>Simpan sebagai draf untuk bulan berjalan. Arsip final jangan pakai opsi ini.</span>
                    </label>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                      Batal
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={async () => {
                        setConfirmOpen(false);
                        await runGenerate({ allow_incomplete: allowIncomplete, force_regenerate: forceRegen });
                      }}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {generatedFile && (
                <div className="flex flex-col gap-4 w-full items-center pt-4">
                  <ReportDownloads
                    detailFileName={generatedFile?.detail_file?.file_name as string}
                    detailLink={generatedFile?.detail_file?.download_url as string}
                    summaryLink={generatedFile?.summary_file?.download_url as string}
                    summaryFileName={generatedFile?.summary_file?.file_name as string}
                    month={formField.month}
                    year={formField.year}
                    isCached={generatedFile?.is_cached}
                    isIncomplete={generatedFile?.is_incomplete}
                  />
                </div>
              )}
              <OutstandingReportsList year={formField.year ? Number(formField.year) : undefined} visible={snapshotTab === "export"} />
            </>
          )}
        </div>
      )}
      {tabs === "log" && <CreditsLedgerLog />}
    </div>
  );
};

const ENTRY_TYPE_OPTIONS: { value: LedgerEntryType; label: string }[] = [
  { value: "credit_issue", label: "Issue" },
  { value: "credit_spend", label: "Spend" },
  { value: "credit_refund", label: "Refund" },
  { value: "credit_expired", label: "Expired" },
  { value: "admin_adjustment", label: "Admin Adjustment" },
  { value: "system_adjustment", label: "System Adjustment" },
];

// BE may return snake_case or Title-case labels for the adjustment rows
const ENTRY_TYPE_LABEL: Record<string, string> = {
  admin_adjustment: "Admin Adjustment",
  system_adjustment: "System Adjustment",
  credit_issue: "Issue",
  credit_spend: "Spend",
  credit_refund: "Refund",
  credit_expired: "Expired",
};

const ENTRY_TYPE_CHIP: Record<string, string> = {
  credit_issue: "bg-green-100 text-green-700 border-green-200",
  credit_spend: "bg-red-100 text-red-700 border-red-200",
  credit_refund: "bg-blue-100 text-blue-700 border-blue-200",
  credit_expired: "bg-gray-100 text-gray-600 border-gray-200",
  admin_adjustment: "bg-amber-100 text-amber-700 border-amber-200",
  system_adjustment: "bg-sky-100 text-sky-700 border-sky-200",
  Issue: "bg-green-100 text-green-700 border-green-200",
  Spend: "bg-red-100 text-red-700 border-red-200",
  Refund: "bg-blue-100 text-blue-700 border-blue-200",
  Expired: "bg-gray-100 text-gray-600 border-gray-200",
  "Admin Adjustment": "bg-amber-100 text-amber-700 border-amber-200",
  "System Adjustment": "bg-sky-100 text-sky-700 border-sky-200",
};

const RECOGNITION_STATUS_OPTIONS: { value: RecognitionStatus; label: string; className: string }[] = [
  { value: "Recognized Revenue", label: "Recognized Revenue", className: "bg-green-100 text-green-700 border-green-200" },
  { value: "Deferred Future Revenue", label: "Deferred Future Revenue", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "Credit Reserved", label: "Credit Reserved", className: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "Credit Refunded", label: "Credit Refunded", className: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "Refund Future Revenue", label: "Refund Future Revenue", className: "bg-red-100 text-red-700 border-red-200" },
  // Reversal = expiry-override restore only, not a refund
  { value: REVERSAL_STATUS, label: REVERSAL_STATUS, className: "bg-purple-100 text-purple-700 border-purple-200" },
];

const RECOGNITION_CHIP: Record<string, string> = Object.fromEntries(RECOGNITION_STATUS_OPTIONS.map((o) => [o.value, o.className]));

// BE admin v322 (dev only): movement_reason derive post-enrich + ref_id trace key
const MOVEMENT_REASON_META: Record<MovementReason, { label: string; className: string; Icon: typeof ShoppingBag }> = {
  purchase: { label: "Pembelian", className: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: ShoppingBag },
  refund_reissue: { label: "Refund terbit ulang", className: "bg-blue-50 text-blue-700 border-blue-200", Icon: RotateCcw },
  rollover_reissue: { label: "Rollover terbit ulang", className: "bg-sky-50 text-sky-700 border-sky-200", Icon: Repeat },
  booking_spend: { label: "Pemakaian booking", className: "bg-orange-50 text-orange-700 border-orange-200", Icon: ArrowUpRight },
  booking_cancel_refund: { label: "Refund batal booking", className: "bg-teal-50 text-teal-700 border-teal-200", Icon: Undo2 },
  expired_breakage: { label: "Hangus", className: "bg-zinc-100 text-zinc-600 border-zinc-200", Icon: Hourglass },
  void_cancel_sale: { label: "Void batal jual", className: "bg-red-50 text-red-700 border-red-200", Icon: Ban },
  expiry_restore: { label: "Pulih kedaluwarsa", className: "bg-purple-50 text-purple-700 border-purple-200", Icon: BadgeCheck },
  manual_correction: { label: "Koreksi manual", className: "bg-amber-50 text-amber-700 border-amber-200", Icon: PencilLine },
};

const MOVEMENT_REASON_OPTIONS: { value: MovementReason; label: string }[] = (
  Object.keys(MOVEMENT_REASON_META) as MovementReason[]
).map((value) => ({ value, label: MOVEMENT_REASON_META[value].label }));

const MOVEMENT_REASON_CHIP: Record<string, string> = Object.fromEntries(
  (Object.keys(MOVEMENT_REASON_META) as MovementReason[]).map((k) => [k, MOVEMENT_REASON_META[k].className]),
);

// ponytail: single shared copy — paste §6 verbatim on every revenue/session surface
const RECOGNITION_DISCLAIMER =
  "Pendapatan dihitung setiap hari jam 23:59 WIB (bukan saat uang masuk): kelas yang berakhir hari ini baru tercatat sebagai pendapatan setelah proses malam hari. Angka hari ini masih sementara.";

function CreditsLedgerLog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isManager } = useAdminPermission();

  // default rentang: awal bulan berjalan s/d hari ini (mis. tgl 16 → filter 01–16)
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const monthStartStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;

  const [qInput, setQInput] = useState(searchParams.get("q") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  // ponytail: drop stale URL vocab (e.g. legacy `adjustment`) — BE 400s out-of-vocab values
  const [entryTypes, setEntryTypes] = useState<string[]>(
    searchParams.get("entry_type")
      ? (searchParams.get("entry_type") as string).split(",").filter((v) => ENTRY_TYPE_OPTIONS.some((o) => o.value === v))
      : [],
  );
  const [statuses, setStatuses] = useState<string[]>(
    searchParams.get("status")
      ? (searchParams.get("status") as string).split(",").filter((v) => RECOGNITION_STATUS_OPTIONS.some((o) => o.value === v))
      : [],
  );
  const [movementReasons, setMovementReasons] = useState<string[]>(
    searchParams.get("movement_reason")
      ? (searchParams.get("movement_reason") as string).split(",").filter((v) => MOVEMENT_REASON_OPTIONS.some((o) => o.value === v))
      : [],
  );
  const [startDate, setStartDate] = useState(searchParams.get("start_date") ?? monthStartStr);
  const [endDate, setEndDate] = useState(searchParams.get("end_date") ?? todayStr);
  // bulan pembelian paket — dua Select gaya rumah (MONTH_LIST/YEAR_LIST), digabung jadi YYYY-MM
  const _pm = searchParams.get("purchased_month") ?? "";
  const _pmMatch = _pm.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const [pmMonth, setPmMonth] = useState(_pmMatch ? String(Number(_pmMatch[2])) : "");
  const [pmYear, setPmYear] = useState(_pmMatch ? _pmMatch[1] : "");
  const purchasedMonth = pmMonth && pmYear ? `${pmYear}-${pmMonth.padStart(2, "0")}` : "";
  // bulan pengakuan pendapatan (BE 7 Okt: recognition_month|recognitionMonth, default = purchased_month).
  // Kosong = ikut bulan pembelian; Deferred/Reserved (month null) selalu ikut.
  const _rm = searchParams.get("recognition_month") ?? searchParams.get("recognitionMonth") ?? "";
  const _rmMatch = _rm.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const [rmMonth, setRmMonth] = useState(_rmMatch ? String(Number(_rmMatch[2])) : "");
  const [rmYear, setRmYear] = useState(_rmMatch ? _rmMatch[1] : "");
  const recognitionMonth = rmMonth && rmYear ? `${rmYear}-${rmMonth.padStart(2, "0")}` : "";
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"));
  const [pageSize] = useState(Number(searchParams.get("page_size") ?? "20"));
  const [order, setOrder] = useState<"asc" | "desc">((searchParams.get("order") as "asc" | "desc") ?? "desc");
  const [userId, setUserId] = useState(searchParams.get("user_id") ?? "");
  // filter branch (BE v295/v38+): "all" = tanpa filter, selain itu exact-match single value
  const _branchInit = searchParams.get("branch") ?? "all";
  const [branch, setBranch] = useState(SEHELA_BRANCH.some((b) => b.value === _branchInit) ? _branchInit : "all");
  const branchParam = branch !== "all" ? branch : undefined;

  // member select — reuse member selects via useGetCustomers, q now only for package name
  const [memberSearch, setMemberSearch] = useState("");
  const debounceMemberSearch = useDebounce(memberSearch, 300);
  const { data: memberData, isLoading: memberLoading } = useGetCustomers({ search: debounceMemberSearch, status: "true" });
  const selectedMember = useMemo(() => {
    if (!userId) return null;
    const list = (memberData?.data as unknown as { id: string; full_name: string; phone: string }[] | undefined) ?? [];
    return (
      list.find((m) => m.id === userId) ??
      ({ id: userId, full_name: "Member terpilih", phone: "" } as unknown as { id: string; full_name: string; phone: string })
    );
  }, [userId, memberData]);

  // debounce q (package name only)
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  // reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [q, entryTypes, statuses, movementReasons, startDate, endDate, order, userId, purchasedMonth, recognitionMonth, branch]);

  // persist to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "log");
    if (q) p.set("q", q);
    else p.delete("q");
    if (entryTypes.length) p.set("entry_type", entryTypes.join(","));
    else p.delete("entry_type");
    if (statuses.length) p.set("status", statuses.join(","));
    else p.delete("status");
    if (movementReasons.length) p.set("movement_reason", movementReasons.join(","));
    else p.delete("movement_reason");
    if (startDate) p.set("start_date", startDate);
    else p.delete("start_date");
    if (endDate) p.set("end_date", endDate);
    else p.delete("end_date");
    if (purchasedMonth) p.set("purchased_month", purchasedMonth);
    else p.delete("purchased_month");
    if (recognitionMonth) p.set("recognition_month", recognitionMonth);
    else p.delete("recognition_month");
    p.delete("recognitionMonth"); // ponytail: canonical snake_case only
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    p.set("order", order);
    if (userId) p.set("user_id", userId);
    else p.delete("user_id");
    if (branch !== "all") p.set("branch", branch);
    else p.delete("branch");
    router.replace(`?${p.toString()}`, { scroll: false } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, entryTypes, statuses, movementReasons, startDate, endDate, purchasedMonth, recognitionMonth, page, pageSize, order, userId, branch]);

  const rangeError = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (s > e) return "Tanggal mulai tidak boleh lebih besar dari tanggal akhir";
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    if (diff > 31) return "Rentang maksimal 31 hari";
    return null;
  }, [startDate, endDate]);

  // YYYY-MM valid → dikirim ke ledger + summary; BE 400 untuk format salah
  const purchasedMonthParam = /^\d{4}-(0[1-9]|1[0-2])$/.test(purchasedMonth) ? purchasedMonth : undefined;
  const recognitionMonthParam = /^\d{4}-(0[1-9]|1[0-2])$/.test(recognitionMonth) ? recognitionMonth : undefined;

  const params = useMemo(
    () => ({
      q: q || undefined,
      entry_type: entryTypes.length ? entryTypes.join(",") : undefined,
      status: statuses.length ? statuses.join(",") : undefined,
      movement_reason: movementReasons.length ? movementReasons.join(",") : undefined,
      branch: branchParam,
      start_date: !rangeError && startDate ? startDate : undefined,
      end_date: !rangeError && endDate ? endDate : undefined,
      purchased_month: purchasedMonthParam,
      recognition_month: recognitionMonthParam,
      page,
      page_size: pageSize,
      order,
      user_id: userId || undefined,
    }),
    [q, entryTypes, statuses, movementReasons, branchParam, startDate, endDate, purchasedMonthParam, recognitionMonthParam, page, pageSize, order, userId, rangeError],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useGetCreditsLedger(params);

  // Filtered summary reconciles with the table (passes entry_type + purchased_month + recognition_month + branch).
  const summaryParams = useMemo(
    () => ({
      q: q || undefined,
      entry_type: entryTypes.length ? entryTypes.join(",") : undefined,
      branch: branchParam,
      start_date: !rangeError && startDate ? startDate : undefined,
      end_date: !rangeError && endDate ? endDate : undefined,
      purchased_month: purchasedMonthParam,
      recognition_month: recognitionMonthParam,
      user_id: userId || undefined,
    }),
    [q, entryTypes, branchParam, startDate, endDate, purchasedMonthParam, recognitionMonthParam, userId, rangeError],
  );
  const { data: summaryRes, isLoading: summaryLoading, refetch: refetchSummary } = useGetCreditsLedgerSummary(summaryParams, !rangeError);

  // Period summary drives the accrual cards — omits entry_type by design,
  // but follows purchased_month + recognition_month (BE: credit buckets + outstanding only for that cohort; cash excluded).
  // Credit buckets (sold/recognized/breakage) are derived from the filtered row-set,
  // so a table-filtered summary would zero them; cash ignores entry_type entirely.
  const periodParams = useMemo(
    () => ({
      q: q || undefined,
      branch: branchParam,
      start_date: !rangeError && startDate ? startDate : undefined,
      end_date: !rangeError && endDate ? endDate : undefined,
      purchased_month: purchasedMonthParam,
      recognition_month: recognitionMonthParam,
      user_id: userId || undefined,
    }),
    [q, branchParam, startDate, endDate, purchasedMonthParam, recognitionMonthParam, userId, rangeError],
  );
  const { data: periodRes, isLoading: periodLoading, refetch: refetchPeriodSummary } = useGetCreditsLedgerSummary(periodParams, !rangeError);

  const [exporting, setExporting] = useState(false);
  const [running, setRunning] = useState(false);

  const handleRunRecognition = async () => {
    if (running) return;
    try {
      setRunning(true);
      const r = await runRecognition(endDate || undefined);
      toast.success("Perhitungan pendapatan selesai", {
        description: `Hadir ${r.credit_attended} · tidak hadir ${r.credit_no_show} · cash hadir ${r.cash_attended} · kedaluwarsa ${r.breakage} (tanggal ${r.job_date})`,
        position: "top-center",
      });
      refetch();
      refetchSummary();
      refetchPeriodSummary?.();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error("Perhitungan pendapatan gagal", {
        description: err?.response?.data?.error?.message ?? "Silakan coba lagi",
        position: "top-center",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleExportCsv = async () => {
    if (rangeError) {
      toast.error("Rentang tanggal tidak valid", { description: rangeError, position: "top-center" });
      return;
    }
    try {
      setExporting(true);
      const blob = await exportCreditsLedger({
        q: q || undefined,
        entry_type: entryTypes.length ? entryTypes.join(",") : undefined,
        status: statuses.length ? statuses.join(",") : undefined,
        movement_reason: movementReasons.length ? movementReasons.join(",") : undefined,
        branch: branchParam,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        purchased_month: purchasedMonthParam,
        recognition_month: recognitionMonthParam,
        order,
        user_id: userId || undefined,
        // dedicated export: no pagination — BE ignores page when format=csv
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const typeSuffix = entryTypes.length ? `_${entryTypes.join("-")}` : "";
      const reasonSuffix = movementReasons.length ? `_alasan-${movementReasons.join("-")}` : "";
      const qSuffix = q ? `_q-${q.replace(/\s+/g, "_")}` : "";
      const pmSuffix = purchasedMonth ? `_beli-${purchasedMonth}` : "";
      const rmSuffix = recognitionMonthParam ? `_diakui-${recognitionMonthParam}` : "";
      const branchSuffix = branchParam ? `_${branchParam}` : "";
      const rangeSuffix = startDate && endDate ? `_${startDate}_${endDate}` : startDate ? `_${startDate}` : endDate ? `_${endDate}` : "_semua-tanggal";
      a.download = `credits_ledger${rangeSuffix}${typeSuffix}${reasonSuffix}${branchSuffix}${qSuffix}${pmSuffix}${rmSuffix}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Ekspor dimulai", { description: "File CSV terunduh", position: "top-center" });
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: { message?: string } } } };
      toast.error("Ekspor gagal", { description: err?.response?.data?.error?.message ?? "Silakan coba lagi", position: "top-center" });
    } finally {
      setExporting(false);
    }
  };

  const toggleEntryType = (v: string) => setEntryTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleStatus = (v: string) => setStatuses((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleMovementReason = (v: string) =>
    setMovementReasons((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // reset semua filter — tanggal kembali ke default awal bulan s/d hari ini;
  // effect persist URL ikut membersihkan/menulis start_date/end_date/dll ke URL + query API
  const handleResetFilters = () => {
    setQInput("");
    setQ("");
    setEntryTypes([]);
    setStatuses([]);
    setMovementReasons([]);
    setStartDate(monthStartStr);
    setEndDate(todayStr);
    setPmMonth("");
    setPmYear("");
    setRmMonth("");
    setRmYear("");
    setUserId("");
    setMemberSearch("");
    setBranch("all");
    setOrder("desc");
    setPage(1);
  };

  // §4: 12 kolom bisnis + Tgl Beli (purchased_month filter) — Tipe | Customer | Jumlah | Nilai IDR | Paket | Tgl Beli | Kedaluwarsa | Sesi | Kehadiran | Status Pendapatan | Catatan | Diakui pada | Dibuat pada
  const headers = useMemo(
    () => [
      {
        id: "entry_type",
        text: "Tipe",
        value: (row: ICreditsLedgerItem) => (
          <Badge variant="outline" className={`capitalize text-xs ${ENTRY_TYPE_CHIP[row.entry_type] ?? ""}`}>
            {ENTRY_TYPE_LABEL[row.entry_type] ?? row.entry_type}
          </Badge>
        ),
      },
      {
        id: "movement_reason",
        text: "Alasan",
        value: (row: ICreditsLedgerItem) => {
          const meta = row.movement_reason ? MOVEMENT_REASON_META[row.movement_reason as MovementReason] : null;
          if (!meta) return "—";
          const { Icon } = meta;
          return (
            <Badge
              variant="outline"
              title={row.movement_reason ?? ""}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-sm ${meta.className}`}
            >
              <Icon size={12} className="shrink-0" />
              {meta.label}
            </Badge>
          );
        },
      },
      {
        id: "customer_name",
        text: "Customer",
        value: (row: ICreditsLedgerItem) => row.customer_name ?? "—",
      },
      {
        id: "branch",
        text: "Branch",
        value: (row: ICreditsLedgerItem) => branchLabel(row.branch),
      },
      {
        id: "amount",
        text: "Jumlah",
        value: (row: ICreditsLedgerItem) =>
          row.amount == null ? (
            "—"
          ) : (
            <span className={row.amount < 0 ? "text-red-600 font-semibold" : row.amount > 0 ? "text-green-600 font-semibold" : ""}>
              {row.amount > 0 ? `+${row.amount}` : row.amount}
            </span>
          ),
      },
      {
        id: "nilai_idr",
        text: "Nilai (IDR)",
        value: (row: ICreditsLedgerItem) =>
          row.nilai_idr == null ? (
            "—"
          ) : (
            <span className={row.nilai_idr < 0 ? "text-red-600 font-semibold" : row.nilai_idr > 0 ? "text-green-600 font-semibold" : ""}>
              {row.nilai_idr < 0 ? `-${formatCurrency(Math.abs(row.nilai_idr))}` : formatCurrency(row.nilai_idr)}
            </span>
          ),
      },
      {
        id: "package_name",
        text: "Paket",
        value: (row: ICreditsLedgerItem) => row.package_name ?? "—",
      },
      {
        id: "original_amount_idr",
        text: "Harga Asli",
        value: (row: ICreditsLedgerItem) =>
          row.original_amount_idr == null ? "—" : formatCurrency(row.original_amount_idr),
      },
      {
        id: "discount_idr",
        text: "Diskon",
        value: (row: ICreditsLedgerItem) =>
          row.discount_idr == null ? "—" : formatCurrency(row.discount_idr),
      },
      {
        id: "voucher_code",
        text: "Voucher",
        value: (row: ICreditsLedgerItem) =>
          row.voucher_code ? <span className="font-mono text-xs">{row.voucher_code}</span> : "—",
      },
      {
        id: "actual_amount_paid_idr",
        text: "Dibayar",
        value: (row: ICreditsLedgerItem) =>
          row.actual_amount_paid_idr == null ? "—" : formatCurrency(row.actual_amount_paid_idr),
      },
      {
        id: "per_credit_value_idr",
        text: "Nilai per Kredit",
        value: (row: ICreditsLedgerItem) =>
          row.per_credit_value_idr == null ? "—" : formatCurrency(row.per_credit_value_idr),
      },
      {
        id: "purchased_at",
        text: "Tgl Beli",
        value: (row: ICreditsLedgerItem) =>
          row.purchased_at ? formatDateHelper(row.purchased_at, "dd MMMM yyyy") : row.purchased_at_wib || "—",
      },
      {
        id: "expiry_date",
        text: "Tanggal Kedaluwarsa",
        value: (row: ICreditsLedgerItem) => (row.expiry_date ? formatDateHelper(row.expiry_date, "dd MMM yyyy") : "—"),
      },
      {
        id: "session_date",
        text: "Tanggal Kelas / Sesi",
        value: (row: ICreditsLedgerItem) => (row.session_date ? formatDateHelper(row.session_date, "dd MMM yyyy HH:mm") : "—"),
      },
      {
        id: "attendance",
        text: "Kehadiran",
        value: (row: ICreditsLedgerItem) =>
          !row.attendance ? (
            "—"
          ) : (
            <Badge
              variant="outline"
              className={`capitalize text-xs ${row.attendance === "attended" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                }`}
            >
              {row.attendance.replace("_", " ")}
            </Badge>
          ),
      },
      {
        id: "recognition_status",
        text: "Status Pendapatan",
        value: (row: ICreditsLedgerItem) => (
          <span className="flex flex-col gap-0.5">
            <Badge variant="outline" className={`text-xs whitespace-nowrap ${RECOGNITION_CHIP[row.recognition_status] ?? ""}`}>
              {row.recognition_status}
            </Badge>
            {row.recognition_month && <span className="text-[10px] text-muted-foreground">{row.recognition_month}</span>}
          </span>
        ),
      },
      {
        id: "note",
        text: "Catatan",
        value: (row: ICreditsLedgerItem) => (
          <span className="block max-w-[240px] truncate" title={row.note ?? ""}>
            {row.note ?? "—"}
          </span>
        ),
      },
      {
        id: "ref_id",
        text: "Ref ID",
        value: (row: ICreditsLedgerItem) =>
          !row.ref_id ? (
            "—"
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-xs text-muted-foreground cursor-default">
                    {row.ref_id.slice(0, 8)}…
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-mono text-xs max-w-[320px] break-all">
                  {row.ref_id}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
      },
      {
        id: "recognized_at",
        text: "Diakui pada",
        value: (row: ICreditsLedgerItem) => (row.recognized_at ? formatDateHelper(row.recognized_at, "dd MMM yyyy HH:mm") : "—"),
      },
      {
        id: "created_at",
        text: "Dibuat pada",
        value: (row: ICreditsLedgerItem) => row.created_at_wib || formatDateHelper(row.created_at, "dd MMM yyyy HH:mm") + " WIB",
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card className="w-full max-w-vw">
        <CardHeader className="text-lg font-semibold">Buku Kredit (pendapatan dihitung 23:59 WIB)</CardHeader>
        <CardContent className="flex flex-col gap-4 w-full">
          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{RECOGNITION_DISCLAIMER}</p>
          {/* filter — cari customer / paket / catatan; pilihan member mempersempit hasil */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="flex flex-col gap-1 md:col-span-3">
              <p className="text-sm font-medium">Cari customer / paket / catatan</p>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Cari customer, paket, catatan..." value={qInput} onChange={(e) => setQInput(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-3">
              <p className="text-sm font-medium">Rentang tanggal</p>
              <DateRangePicker
                mode="range"
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={(s, e) => {
                  setStartDate(s ?? "");
                  setEndDate(e ?? "");
                }}
                allowPastDates
                allowFutureDates={false}
                maxSelectionDays={31}
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <p className="text-sm font-medium">Branch</p>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Semua" />
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
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <p className="text-sm font-medium">Bulan pembelian paket</p>
              <div className="flex gap-2">
                <Select value={pmMonth} onValueChange={(v) => setPmMonth(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua</SelectItem>
                    {MONTH_LIST.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pmYear} onValueChange={(v) => setPmYear(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua</SelectItem>
                    {[...new Set([pmYear, ...YEAR_LIST].filter(Boolean))].map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <p className="text-sm font-medium">Bulan pengakuan pendapatan</p>
              <div className="flex gap-2">
                <Select value={rmMonth} onValueChange={(v) => setRmMonth(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua</SelectItem>
                    {MONTH_LIST.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rmYear} onValueChange={(v) => setRmYear(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua</SelectItem>
                    {[...new Set([rmYear, ...YEAR_LIST].filter(Boolean))].map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <p className="text-sm font-medium">Urutan</p>
              <Select value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Terbaru</SelectItem>
                  <SelectItem value="asc">Terlama</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {branch !== "all" && (
            <p className="text-[11px] text-muted-foreground">Filter branch aktif: baris tanpa branch tidak ikut hitungan.</p>
          )}
          {(purchasedMonthParam || recognitionMonthParam) && (
            <p className="text-[11px] text-muted-foreground">
              {recognitionMonthParam
                ? `Bulan pengakuan ${recognitionMonthParam}: baris diakui di bulan lain dibuang; Deferred/Reserved (tanpa bulan) tetap ikut.`
                : `Bulan pembelian ${purchasedMonthParam}: bulan pengakuan mengikuti bulan pembelian; Deferred/Reserved (tanpa bulan) tetap ikut.`}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Member (customer)</p>
            <ReactSelect
              isClearable
              isLoading={memberLoading}
              placeholder="Pilih member..."
              value={
                selectedMember
                  ? ({
                    value: (selectedMember as unknown as { id: string }).id,
                    label: `${(selectedMember as unknown as { full_name: string }).full_name} - ${(selectedMember as unknown as { phone: string }).phone ?? ""
                      }`,
                    id: (selectedMember as unknown as { id: string }).id,
                  } as unknown as never)
                  : null
              }
              options={
                (memberData?.data as unknown as { id: string; full_name: string; phone: string }[] | undefined)?.map(
                  (m) =>
                  ({
                    value: m.id,
                    label: `${m.full_name} - ${m.phone ?? ""}`,
                    id: m.id,
                  } as unknown as never),
                ) ?? []
              }
              onInputChange={(v) => setMemberSearch(v)}
              inputValue={memberSearch}
              onChange={(opt) => {
                const v = opt as unknown as { value: string } | null;
                setUserId(v?.value ?? "");
              }}
              classNames={{
                control: () => "!min-h-[40px] !border-input !bg-background",
                placeholder: () => "text-muted-foreground",
                singleValue: () => "text-foreground",
              }}
              styles={{
                control: (base) => ({ ...base, minHeight: 40, borderRadius: 6 }),
              }}
              getOptionValue={(opt) => (opt as unknown as { value: string }).value}
              getOptionLabel={(opt) => (opt as unknown as { label: string }).label}
            />
            <p className="text-xs text-muted-foreground">
              Pilih member untuk memfilter buku berdasarkan customer; kolom pencarian cocok dengan nama customer / paket / catatan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Tipe:</span>
            {ENTRY_TYPE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={entryTypes.includes(o.value)} onCheckedChange={() => toggleEntryType(o.value)} />
                <Badge variant="outline" className={`${ENTRY_TYPE_CHIP[o.value]} text-xs`}>
                  {o.label}
                </Badge>
              </label>
            ))}
            {entryTypes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setEntryTypes([])}>
                Hapus
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {RECOGNITION_STATUS_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={statuses.includes(o.value)} onCheckedChange={() => toggleStatus(o.value)} />
                <Badge variant="outline" className={`${o.className} text-xs`}>
                  {o.label}
                </Badge>
              </label>
            ))}
            {statuses.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStatuses([])}>
                Hapus
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Alasan:</span>
            {MOVEMENT_REASON_OPTIONS.map((o) => {
              const meta = MOVEMENT_REASON_META[o.value];
              const { Icon } = meta;
              return (
                <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer" title={o.value}>
                  <Checkbox checked={movementReasons.includes(o.value)} onCheckedChange={() => toggleMovementReason(o.value)} />
                  <Badge variant="outline" className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ${meta.className}`}>
                    <Icon size={12} className="shrink-0" />
                    {o.label}
                  </Badge>
                </label>
              );
            })}
            {movementReasons.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMovementReasons([])}>
                Hapus
              </Button>
            )}
          </div>

          {rangeError && <p className="text-sm text-red-600">{rangeError}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button onClick={handleResetFilters} variant="ghost" size="sm">
              Reset filter
            </Button>
            <Button onClick={handleRunRecognition} disabled={!!rangeError || running} variant="default" size="sm">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Hitung Ulang ({endDate || "hari ini"})
            </Button>
            {isManager && (
              <Button onClick={handleExportCsv} disabled={!!rangeError || exporting} variant="outline" size="sm">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Unduh CSV
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Status dihitung per {endDate || "hari ini"} · perhitungan otomatis setiap hari jam 23:59 WIB; tombol ini hanya untuk mengisi ulang data
            yang tertinggal / koreksi.
          </p>
        </CardContent>
      </Card>

      {/* Ringkasan pergerakan kredit — angka mengikuti filter tabel; kartu akrual memakai ringkasan periode */}
      {(() => {
        const unwrap = (res: unknown) => {
          const s = (res as unknown as { data?: ICreditsLedgerSummary | { data: ICreditsLedgerSummary } })?.data as unknown as
            | ICreditsLedgerSummary
            | undefined;
          return (s as unknown as { data?: ICreditsLedgerSummary })?.data ?? s;
        };
        const summary = unwrap(summaryRes);
        const period = unwrap(periodRes);
        if (summaryLoading || periodLoading) {
          return (
            <Card className="w-full max-w-vw">
              <CardContent className="py-6 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          );
        }
        if (!summary) return null;
        const byType = summary.by_type ?? {};
        const getByType = (k: string) => byType[k] ?? { count: 0, credits: 0, value_idr: 0 };
        const issuance = getByType("credit_issue");
        const usage = getByType("credit_spend");
        const refund = getByType("credit_refund");
        const expired = getByType("credit_expired");
        const rawAdjustment = { count: 0, credits: 0, value_idr: 0 };
        const adminAdjustment = getByType("admin_adjustment");
        const systemAdjustment = getByType("system_adjustment");
        // ponytail: legacy `adjustment` removed (admin v246) — BE adjustment rows are admin/system only
        const adjustment = {
          count: rawAdjustment.count + adminAdjustment.count + systemAdjustment.count,
          credits: rawAdjustment.credits + adminAdjustment.credits + systemAdjustment.credits,
          value_idr: rawAdjustment.value_idr + adminAdjustment.value_idr + systemAdjustment.value_idr,
        };
        const byStatus = summary.by_status ?? {};
        const out =
          summary.outstanding ??
          (summary.outstanding_credits != null
            ? {
              packages: summary.outstanding_packages ?? 0,
              credits: summary.outstanding_credits ?? 0,
              value_idr: summary.outstanding_value_idr ?? 0,
            }
            : null);
        const netEmpty = summary.net_credits === 0 && summary.net_value_idr === 0;
        const outstandingAnomaly = !!out && out.credits > 0 && out.value_idr < 0;
        const filterEcho = summary.filters;
        const rawFilterEntry = Array.isArray(filterEcho?.entry_type)
          ? (filterEcho.entry_type as string[]).join(",")
          : (filterEcho?.entry_type as string | undefined) ?? "";
        const filterEntry = rawFilterEntry
          ? rawFilterEntry
            .split(",")
            .map((v) => ENTRY_TYPE_LABEL[v.trim()] ?? v.trim())
            .join(", ")
          : "";
        const isFiltered =
          !!filterEntry || (Array.isArray(filterEcho?.branch) && filterEcho.branch.length > 0);
        const fmtSigned = (n: number) => (n > 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US"));
        return (
          <Card className="w-full max-w-vw overflow-hidden border-muted-foreground/10">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold tracking-tight">Ringkasan Pergerakan Kredit</h3>
                  <p className="text-xs text-muted-foreground">
                    {summary.period ?? summary.periode} · {summary.total_movements.toLocaleString("en-US")} pergerakan pada periode ini · sesuai
                    dengan tabel di bawah
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {filterEntry ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
                        Filter: {filterEntry}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">
                        1 periode penuh (tanpa filter tipe)
                      </Badge>
                    )}
                    {summary.filters?.user_id ? (
                      <Badge variant="outline" className="text-[11px]">
                        Member terfilter
                      </Badge>
                    ) : null}
                    {summary.filters?.q ? (
                      <Badge variant="outline" className="text-[11px]">
                        Cari: {summary.filters.q}
                      </Badge>
                    ) : null}
                    {Array.isArray(summary.filters?.branch) && summary.filters.branch.length ? (
                      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px]">
                        Branch: {summary.filters.branch.map((b) => branchLabel(b)).join(", ")}
                      </Badge>
                    ) : null}
                    {summary.filters?.purchased_month ? (
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[11px]">
                        Beli: {summary.filters.purchased_month}
                      </Badge>
                    ) : null}
                    {summary.filters?.recognition_month ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                        Diakui: {summary.filters.recognition_month}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-medium">
                  Bersih {fmtSigned(summary.net_credits)} kredit
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Baris 1: rincian pergerakan per tipe (mengikuti filter — sama dengan tabel) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <CardRevenueComponent
                  title="Issue"
                  amount={`${fmtSigned(issuance.credits)} kredit`}
                  amountClassName="text-emerald-600"
                  subtitle={formatCurrency(issuance.value_idr)}
                  footer={`${issuance.count.toLocaleString("en-US")} pergerakan`}
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <ArrowDownRight size={16} />
                    </span>
                  }
                />
                <CardRevenueComponent
                  title="Spend"
                  amount={`${fmtSigned(usage.credits)} kredit`}
                  amountClassName="text-red-600"
                  subtitle={formatCurrency(usage.value_idr)}
                  footer={`${usage.count.toLocaleString("en-US")} pergerakan`}
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600">
                      <ArrowUpRight size={16} />
                    </span>
                  }
                />
                <CardRevenueComponent
                  title="Refund"
                  amount={`${fmtSigned(refund.credits)} kredit`}
                  amountClassName="text-blue-600"
                  subtitle={formatCurrency(refund.value_idr)}
                  footer={`${refund.count.toLocaleString("en-US")} pergerakan`}
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                      <RotateCcw size={16} />
                    </span>
                  }
                />
                <CardRevenueComponent
                  title="Expired"
                  amount={`${fmtSigned(expired.credits)} kredit`}
                  amountClassName="text-zinc-500"
                  subtitle={formatCurrency(expired.value_idr)}
                  footer={`${expired.count.toLocaleString("en-US")} pergerakan · hangus`}
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-500/10 text-zinc-500">
                      <Hourglass size={16} />
                    </span>
                  }
                />
                <CardRevenueComponent
                  title="Adjustment"
                  amount={`${fmtSigned(adjustment.credits)} kredit`}
                  amountClassName="text-amber-600"
                  subtitle={formatCurrency(adjustment.value_idr)}
                  footer={`${adjustment.count.toLocaleString("en-US")} pergerakan`}
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                      <FileText size={16} />
                    </span>
                  }
                />
              </div>
              {Object.keys(byStatus).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Per status:</span>
                  {Object.entries(byStatus).map(([k, v]) => (
                    <Badge key={k} variant="outline" className={`text-[11px] ${RECOGNITION_CHIP[k] ?? ""}`}>
                      {k} · {v.count.toLocaleString("en-US")} · {formatCurrency(v.value_idr)}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Baris 2: sorotan — Bersih vs Sisa (saat ini) */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <CardRevenueComponent
                  title="Pergerakan Bersih"
                  amount={netEmpty ? "0 kredit" : `${fmtSigned(summary.net_credits)} kredit`}
                  amountClassName={summary.net_credits < 0 ? "text-red-600" : summary.net_credits > 0 ? "text-emerald-600" : undefined}
                  subtitle={netEmpty ? "Tidak ada pergerakan bersih pada periode ini" : formatCurrency(summary.net_value_idr)}
                  footer="Masuk dikurangi keluar untuk data yang tampil. Negatif berarti pemakaian lebih besar dari penerbitan."
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                      <Activity size={16} />
                    </span>
                  }
                />
                <CardRevenueComponent
                  className="border-primary/30 bg-primary/[0.03] shadow-sm"
                  title="Sisa · saat ini"
                  amount={out ? `${out.credits.toLocaleString("en-US")} kredit` : "—"}
                  subtitle={out ? formatCurrency(out.value_idr) : undefined}
                  footer={
                    out ? (
                      <span className="flex flex-col gap-1">
                        <span>
                          {out.packages.toLocaleString("en-US")} paket masih menyimpan kredit · uang muka yang ditahan · posisi saat ini, bukan akhir
                          periode
                        </span>
                        {outstandingAnomaly && (
                          <span className="font-medium text-amber-700">
                            Perlu perhatian: kredit positif dengan nilai negatif — harap hubungi tim terkait.
                          </span>
                        )}
                      </span>
                    ) : (
                      "Tidak ada sisa paket pada filter ini"
                    )
                  }
                  icon={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wallet size={16} />
                    </span>
                  }
                />
              </div>
              {(() => {
                // Kartu akrual memakai ringkasan periode — bukan ringkasan yang terfilter tabel.
                const src = period ?? summary;
                const db = src.deferred_buckets;
                if (!db) return null;
                const sold = db.sold ?? db.terjual;
                const attended = db.recognized_attended ?? db.diakui_hadir;
                const noShow = db.recognized_no_show ?? db.diakui_no_show;
                const ending = db.ending_deferred_balance ?? db.saldo_tangguhan_akhir;
                const total = db.recognized_total ?? db.diakui_total;
                const cash = db.cash;
                // Pemulihan = pengembalian kredit kedaluwarsa saja (bukan refund); bila kosong → nol
                const reversal = (src.by_status?.[REVERSAL_STATUS] as unknown as typeof db.breakage | undefined) ??
                  db.reversal ?? {
                  count: 0,
                  credits: 0,
                  value_idr: 0,
                  journal: REVERSAL_JOURNAL,
                };
                const hasReversal = (reversal.count ?? 0) !== 0 || (reversal.value_idr ?? 0) !== 0;
                if (!sold && !attended && !noShow && !db.breakage && !ending && !cash && !hasReversal) return null;
                const creditCards = [
                  {
                    title: "Kredit Terjual",
                    hint: "Uang diterima, pendapatan diterima dimuka",
                    amount: formatCurrency(sold?.value_idr ?? 0),
                    footer: `${(sold?.credits ?? 0).toLocaleString("en-US")} kredit · ${sold?.count ?? 0} pergerakan`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
                        <ShoppingBag size={16} />
                      </span>
                    ),
                  },
                  {
                    title: "Diakui · Hadir",
                    hint: "Pendapatan dari kehadiran",
                    amount: formatCurrency(attended?.value_idr ?? 0),
                    footer: `${(attended?.credits ?? 0).toLocaleString("en-US")} kredit · ${attended?.count ?? 0} pergerakan`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <BadgeCheck size={16} />
                      </span>
                    ),
                  },
                  {
                    title: "Diakui · Tidak hadir",
                    hint: "Pendapatan dari ketidakhadiran",
                    amount: formatCurrency(noShow?.value_idr ?? 0),
                    footer: `${(noShow?.credits ?? 0).toLocaleString("en-US")} kredit · ${noShow?.count ?? 0} pergerakan`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                        <UserX size={16} />
                      </span>
                    ),
                  },
                  {
                    title: "Hangus · Kedaluwarsa",
                    hint: "Pendapatan dari kredit kedaluwarsa",
                    amount: formatCurrency(db.breakage?.value_idr ?? 0),
                    footer: `${(db.breakage?.credits ?? 0).toLocaleString("en-US")} kredit · ${db.breakage?.count ?? 0} pergerakan`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-600">
                        <TimerOff size={16} />
                      </span>
                    ),
                  },
                  {
                    title: "Pemulihan · Kedaluwarsa",
                    hint: "Pengembalian kredit kedaluwarsa — bukan refund",
                    amount: formatCurrency(reversal.value_idr ?? 0),
                    footer: `${(reversal.credits ?? 0).toLocaleString("en-US")} kredit · ${reversal.count ?? 0} pergerakan`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600">
                        <Undo2 size={16} />
                      </span>
                    ),
                  },
                  {
                    title: "Sisa Pendapatan Diterima Dimuka",
                    hint: "Masih terutang sebagai sesi mendatang",
                    amount: formatCurrency((ending as unknown as { value_idr?: number })?.value_idr ?? 0),
                    footer: `${((ending as unknown as { credits?: number })?.credits ?? 0).toLocaleString("en-US")} kredit · ${(
                      (ending as unknown as { packages?: number })?.packages ?? 0
                    ).toLocaleString("en-US")} paket`,
                    icon: (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                        <Landmark size={16} />
                      </span>
                    ),
                  },
                ];
                return (
                  <div className="flex flex-col gap-4 rounded-2xl border border-muted bg-muted/20 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold tracking-tight">Pengakuan Pendapatan · Akrual</p>
                        <p className="text-[11px] text-muted-foreground">
                          Total 1 periode penuh (tanpa filter tipe) · khusus pendapatan kredit · cash dihitung terpisah — jangan jumlahkan angka cash
                          dan kredit
                        </p>
                        {isFiltered && (
                          <p className="text-[11px] text-amber-700">
                            Tabel sedang difilter ({filterEntry}); kartu di bawah tetap menampilkan 1 periode penuh.
                          </p>
                        )}
                      </div>
                      {total && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-medium">
                          Total pendapatan kredit · {formatCurrency(total.value_idr)}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {creditCards.map((c) => (
                        <CardRevenueComponent
                          key={c.title}
                          title={c.title}
                          amount={c.amount}
                          subtitle={c.hint}
                          footer={
                            <span className="flex flex-col gap-0.5">
                              <span>{c.footer}</span>
                            </span>
                          }
                          icon={c.icon}
                        />
                      ))}
                    </div>
                    {cash && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">Arus cash · tanggal yang sama, berbasis booking</p>
                          <p className="text-[11px] text-muted-foreground">
                            Selisih terjual dengan yang sudah diakui adalah sesi yang belum berakhir.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <CardRevenueComponent
                            title="Cash Terjual"
                            amount={formatCurrency(cash.sold?.value_idr ?? 0)}
                            subtitle="Cash yang terkumpul pada periode ini"
                            footer={
                              <span className="flex flex-col gap-0.5">
                                <span>{(cash.sold?.count ?? 0).toLocaleString("en-US")} booking</span>
                              </span>
                            }
                            icon={
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10 text-teal-600">
                                <DollarSign size={16} />
                              </span>
                            }
                          />
                          <CardRevenueComponent
                            title="Cash Diakui · Hadir"
                            amount={formatCurrency(cash.recognized_attended?.value_idr ?? 0)}
                            subtitle="Pendapatan cash yang sudah diakui"
                            footer={
                              <span className="flex flex-col gap-0.5">
                                <span>{(cash.recognized_attended?.count ?? 0).toLocaleString("en-US")} booking</span>
                              </span>
                            }
                            icon={
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                                <BadgeDollarSign size={16} />
                              </span>
                            }
                          />
                          <CardRevenueComponent
                            title="Cash Diakui · Tidak hadir"
                            amount={formatCurrency(cash.recognized_no_show?.value_idr ?? 0)}
                            subtitle="Pendapatan cash dari ketidakhadiran"
                            footer={
                              <span className="flex flex-col gap-0.5">
                                <span>{(cash.recognized_no_show?.count ?? 0).toLocaleString("en-US")} booking</span>
                              </span>
                            }
                            icon={
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                                <UserX size={16} />
                              </span>
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}

      <Card className="overflow-hidden min-w-0 max-w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Rincian Pergerakan</CardTitle>
          <CardDescription className="text-xs">Per paket · data per customer sudah digabung</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 min-w-0 max-w-full overflow-hidden">
          {isLoading || isFetching ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertTriangle size={16} />
              <AlertTitle>Gagal memuat buku kredit</AlertTitle>
              <AlertDescription className="text-xs">
                {(error as unknown as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
                  (error as Error)?.message ??
                  "Silakan coba lagi atau ubah filternya."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-4 min-w-0 max-w-full">
              <div className="overflow-x-auto max-w-full">
                <CustomTable headers={headers} data={(data?.data as ICreditsLedgerItem[]) ?? []} />
              </div>
              <CustomPagination
                currentPage={data?.pagination?.page ?? page}
                totalItems={data?.pagination?.total_items ?? 0}
                totalPages={data?.pagination?.total_pages ?? 0}
                limit={data?.pagination?.page_size ?? pageSize}
                hasNextPage={data?.pagination?.has_next ?? false}
                hasPrevPage={data?.pagination?.has_prev ?? false}
                onPageChange={setPage}
                showTotal
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReconciliationTable({ summary }: { summary: import("@/types/report.interface").IOutstandingSummaryData["summary"] }) {
  const s = summary as unknown as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
  // Penjelasan tiap pos untuk tooltip (bahasa non-teknis untuk admin/manager)
  const tooltips: Record<string, string> = {
    pembelian: "Kredit baru dari pembelian paket bulan ini",
    pemakaian: "Kredit yang dipakai untuk booking bulan ini",
    expired: "Kredit yang hangus karena lewat masa berlaku",
    reversal: "Kredit hangus yang dihidupkan kembali bulan ini",
    refund: "Kredit yang dikembalikan ke pelanggan",
    admin_adj: "Koreksi manual oleh admin",
    system: "Koreksi otomatis oleh sistem",
    net_breakage: "Kedaluwarsa dikurangi Pemulihan — yang benar-benar hangus",
    closing_snapshot: "Total sisa kredit di akhir bulan (angka resmi)",
    closing_formula: "Hasil hitungan dari semua mutasi bulan ini",
    diff: "Selisih Saldo Akhir dan Saldo Hitungan — seharusnya 0",
  };
  // ponytail: 11 baris REKONSILIASI — unit + value_idr dari server, jangan hitung ulang di FE
  const rows: { bucket: string; label: string; units: number; valueIdr: number; subtle?: string; icon?: React.ReactNode }[] = [
    {
      bucket: "pembelian",
      label: "Pembelian",
      units: n("pembelian_units"),
      valueIdr: n("pembelian_value_idr"),
      subtle: "kredit terbit",
      icon: <ShoppingBag size={13} className="text-sky-600" />,
    },
    {
      bucket: "pemakaian",
      label: "Pemakaian",
      units: n("pemakaian_units"),
      valueIdr: n("pemakaian_value_idr"),
      subtle: "yang sudah diakui",
      icon: <BadgeCheck size={13} className="text-emerald-600" />,
    },
    {
      bucket: "expired",
      label: "Kedaluwarsa",
      units: n("expired_units"),
      valueIdr: n("expired_value_idr") ?? n("expired_value"),
      icon: <TimerOff size={13} className="text-orange-600" />,
    },
    {
      bucket: "reversal",
      label: "Pemulihan Kedaluwarsa",
      units: n("reversal_units"),
      valueIdr: n("reversal_value_idr"),
      subtle: "pengembalian bulan ini",
      icon: <Undo2 size={13} className="text-purple-600" />,
    },
    { bucket: "refund", label: "Refund", units: n("refund_units"), valueIdr: n("refund_value_idr"), icon: <RotateCcw size={13} /> },
    { bucket: "admin_adj", label: "Penyesuaian Admin", units: n("admin_adj_units"), valueIdr: n("admin_adj_value_idr"), subtle: "di luar pemulihan" },
    {
      bucket: "system",
      label: "Penyesuaian Sistem",
      units: n("system_units") || n("system_adj_units"),
      valueIdr: n("system_value_idr") || n("system_adj_value_idr"),
      subtle: "otomatis oleh sistem",
      icon: <Activity size={13} className="text-sky-600" />,
    },
    {
      bucket: "net_breakage",
      label: "Hangus Bersih",
      units: n("net_breakage_units"),
      valueIdr: n("net_breakage_value_idr"),
      subtle: "kedaluwarsa − pemulihan",
      icon: <Hourglass size={13} className="text-zinc-500" />,
    },
    {
      bucket: "closing_snapshot",
      label: "Saldo Akhir",
      units: n("closing_snapshot_units") || n("total_outstanding_credits"),
      valueIdr: n("closing_snapshot_value_idr") || n("total_outstanding_value_idr"),
      subtle: "angka resmi",
    },
    {
      bucket: "closing_formula",
      label: "Saldo Hitungan",
      units: n("closing_formula_units"),
      valueIdr: n("closing_formula_value_idr"),
      subtle: "hasil perhitungan",
    },
    { bucket: "diff", label: "Selisih", units: n("diff_units"), valueIdr: n("diff_value_idr"), subtle: "harus 0" },
  ];
  const fmtU = (u: number) => u.toLocaleString("en-US");
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Rekonsiliasi</CardTitle>
          <CardDescription className="text-xs">Cutoff 23:59:59 WIB · unit + IDR</CardDescription>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex text-[11px]">
          11 pos
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[42%]">Pos</TableHead>
              <TableHead className="text-right">Unit</TableHead>
              <TableHead className="text-right">Nilai IDR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isDiff = r.bucket === "diff";
              const diffBad = isDiff && (r.units !== 0 || r.valueIdr !== 0);
              const isSnapshot = r.bucket === "closing_snapshot";
              return (
                <TooltipProvider key={r.bucket}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableRow
                        className={`${isDiff ? "font-semibold bg-muted/30" : ""} ${diffBad ? "!bg-red-50 !text-red-700 hover:!bg-red-50" : ""} ${isSnapshot ? "bg-brand-50/40" : ""
                          }`}
                      >
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            {r.icon && (
                              <span className="hidden h-6 w-6 items-center justify-center rounded-md bg-muted sm:inline-flex">{r.icon}</span>
                            )}
                            <span>{r.label}</span>
                            {r.subtle && <span className="hidden text-[11px] text-muted-foreground lg:inline">· {r.subtle}</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtU(r.units)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.valueIdr)}</TableCell>
                      </TableRow>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[260px] text-xs">
                      {isDiff && diffBad
                        ? "Ada selisih antara saldo akhir dan hasil hitungan — hubungi tim Finance/Tech; jangan koreksi manual"
                        : tooltips[r.bucket] ?? r.subtle ?? r.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OutstandingReportsList({ year, visible }: { year?: number; visible: boolean }) {
  const { isManager } = useAdminPermission();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading, refetch, isFetching } = useListOutstandingReports({ year, page, page_size: pageSize }, visible);
  const rawItems = (data as unknown as { data?: unknown })?.data;
  const list = (Array.isArray(rawItems) ? rawItems : []) as IOutstandingReportItem[];
  const pagination = (
    data as unknown as {
      pagination?: { page: number; total_pages: number; total_items: number; page_size: number; has_next: boolean; has_prev: boolean };
    }
  )?.pagination;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Signed URL 1 jam — refresh list dulu agar link fresh, baru buka
  const handleDownload = async (reportId: string, kind: "summary" | "detail") => {
    try {
      setDownloadingId(`${reportId}-${kind}`);
      const fresh = await refetch();
      const items = ((fresh.data as unknown as { data?: unknown })?.data ?? []) as IOutstandingReportItem[];
      const item = (Array.isArray(items) ? items : []).find((r) => r.report_id === reportId);
      const url = kind === "summary" ? item?.summary_file?.download_url : item?.detail_file?.download_url;
      if (url) window.open(url, "_blank", "noopener");
      else toast.error("Tautan unduh tidak tersedia", { description: "Klik Muat ulang lalu coba lagi." });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!visible) return null;
  const idr = (v: number | undefined) => (v == null ? "—" : formatCurrency(v));
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <p className="text-base font-semibold">Laporan Sebelumnya {year ? `(${year})` : ""}</p>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Muat ulang
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Tautan unduh berlaku 1 jam — daftar dimuat ulang otomatis saat klik unduh. Nilai utama dalam Rupiah.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada laporan{year ? ` untuk ${year}` : ""}. Buat laporan baru di atas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Saldo Awal</TableHead>
                    <TableHead className="text-right">Pembelian</TableHead>
                    <TableHead className="text-right">Pemakaian</TableHead>
                    <TableHead className="text-right">Hangus Bersih</TableHead>
                    <TableHead className="text-right">Saldo Akhir</TableHead>
                    <TableHead className="text-right">Selisih</TableHead>
                    <TableHead className="text-right">Berkas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((r) => {
                    const rr = r as unknown as Record<string, number | undefined>;
                    const closing = rr.closing_snapshot_value_idr ?? rr.closing_value_idr ?? rr.total_outstanding_value_idr;
                    const diff = rr.diff_value_idr;
                    const diffBad = diff !== undefined && diff !== 0;
                    return (
                      <TableRow key={r.report_id} className={diffBad ? "!bg-red-50" : ""}>
                        <TableCell>
                          <span className="font-medium">{r.period}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {r.generated_at ? formatDateHelper(r.generated_at) : ""} {r.is_incomplete ? "· DRAFT" : ""}
                          </span>
                          {r.is_incomplete && (
                            <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              incomplete
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{idr(rr.opening_value_idr)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {idr(rr.pembelian_value_idr ?? rr.issued_value_idr ?? rr.credits_issued)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {idr(rr.pemakaian_value_idr ?? rr.used_value_idr ?? rr.credits_used)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{idr(rr.net_breakage_value_idr)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{idr(closing)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${diffBad ? "text-red-700 font-semibold" : ""}`}>{idr(diff)}</TableCell>
                        <TableCell className="text-right">
                          {isManager ? (
                            <span className="inline-flex gap-1.5">
                              {r.summary_file?.download_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={downloadingId === `${r.report_id}-summary`}
                                  onClick={() => handleDownload(r.report_id, "summary")}
                                >
                                  {downloadingId === `${r.report_id}-summary` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Download className="h-3 w-3" />
                                  )}{" "}
                                  CSV Ringkasan
                                </Button>
                              )}
                              {r.detail_file?.download_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={downloadingId === `${r.report_id}-detail`}
                                  onClick={() => handleDownload(r.report_id, "detail")}
                                >
                                  {downloadingId === `${r.report_id}-detail` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Download className="h-3 w-3" />
                                  )}{" "}
                                  CSV Rincian
                                </Button>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {pagination && pagination.total_pages > 1 && (
              <CustomPagination
                currentPage={pagination.page ?? page}
                totalItems={pagination.total_items ?? list.length}
                totalPages={pagination.total_pages}
                limit={pagination.page_size ?? pageSize}
                hasNextPage={pagination.has_next ?? false}
                hasPrevPage={pagination.has_prev ?? false}
                onPageChange={setPage}
                showTotal
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReportDownloadsProps {
  detailLink?: string;
  summaryLink?: string;
  isLoading?: boolean;
  summaryFileName?: string;
  detailFileName?: string;
  month?: string;
  year?: string;
  isCached?: boolean;
  isIncomplete?: boolean;
}

export function ReportDownloads({
  detailLink,
  summaryLink,
  isLoading = false,
  summaryFileName,
  detailFileName,
  month,
  year,
  isCached,
  isIncomplete,
}: ReportDownloadsProps) {
  const { isManager } = useAdminPermission();
  return (
    <div className="w-full space-y-4">
      <div className="mb-2">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
          Laporan {MONTH_LIST.find((p) => p.value === month)?.label} {year} Siap
          {isCached && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
              Bulan sudah terkunci
            </Badge>
          )}
          {isIncomplete && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]">
              Draf
            </Badge>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">Unduh laporan di bawah · tautan berlaku 1 jam</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Detail Report Card */}
        {detailLink && (
          <Card className="flex flex-col gap-4 border-2  p-6 transition-all hover:border-brand-500 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Laporan Rincian</h4>
                <p className="text-xs text-muted-foreground">{detailFileName}</p>
              </div>
            </div>
            {isManager && (
              <Button asChild disabled={isLoading} className="w-full gap-2">
                <a href={detailLink} download>
                  <Download className="h-4 w-4" />
                  Unduh Rincian
                </a>
              </Button>
            )}
          </Card>
        )}

        {/* Summary Report Card */}
        {summaryLink && (
          <Card className="flex flex-col gap-4 border-2  p-6 transition-all hover:border-brand-500 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Laporan Ringkasan</h4>
                <p className="text-xs text-muted-foreground">{summaryFileName}</p>
              </div>
            </div>
            {isManager && (
              <Button asChild disabled={isLoading} className="w-full gap-2" variant={"secondary"}>
                <a href={summaryLink} download>
                  <Download className="h-4 w-4" />
                  Unduh Ringkasan
                </a>
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
