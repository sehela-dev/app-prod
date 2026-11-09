"use client";

import { CustomTable } from "@/components/general/custom-table";
import { BaseDialogComponent } from "@/components/general/base-dialog-component";
import { CustomPagination } from "@/components/general/pagination-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useBulkExpirePendingPayments,
  useExpirePendingPayment,
  useRecheckPendingPayment,
} from "@/hooks/api/mutations/admin";
import { useGetAdminPaymentChannels, useGetPendingPayments } from "@/hooks/api/queries/admin/payments";
import type { IPendingPayment } from "@/api-req/admin-payments";
import { SEHELA_BRANCH } from "@/constants/sample-data";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const REASON_PRESETS = [
  "Customer tidak menyelesaikan pembayaran",
  "Customer meminta pembatalan",
  "Pembayaran tidak terverifikasi",
];

const formatAge = (minutes: number) =>
  minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)}j ${minutes % 60}m`;

type TPendingRow = IPendingPayment & { id: string };

export const PendingPaymentsTab = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [expireTarget, setExpireTarget] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const { data, isLoading, refetch } = useGetPendingPayments({
    page,
    page_size: PAGE_SIZE,
    q: search || undefined,
    branch,
    stale_only: staleOnly,
  });
  const { data: channelsData } = useGetAdminPaymentChannels();
  const recheckMutation = useRecheckPendingPayment();
  const expireMutation = useExpirePendingPayment();
  const bulkMutation = useBulkExpirePendingPayments();

  const channelLabels = useMemo(
    () => new Map((channelsData?.data ?? []).map((channel) => [channel.code, channel.label])),
    [channelsData],
  );

  const rows: TPendingRow[] = (data?.data ?? []).map((row) => ({ ...row, id: row.payment_id }));

  const openExpire = (ids: string[]) => {
    setReason("");
    setExpireTarget(ids);
  };

  const handleRecheck = (row: TPendingRow) => {
    recheckMutation.mutate(row.payment_id, {
      onSuccess: (res) => {
        const result = res.data;
        if (result.late_settlement || result.booking_status === "expired" || result.booking_status === "canceled") {
          toast.error("Late settlement — booking tetap expired", {
            id: "pending-recheck",
            description: `Order ${row.order_id} is settled but the booking is no longer active.`,
            position: "top-center",
          });
          return;
        }
        void refetch();
        toast.success(`Status: ${result.status}`, { id: "pending-recheck", position: "top-center" });
      },
      onError: () => void refetch(),
    });
  };

  const handleConfirmExpire = async () => {
    if (!expireTarget || !reason.trim()) return;
    const ids = expireTarget;
    try {
      if (ids.length === 1) {
        const res = await expireMutation.mutateAsync({ paymentId: ids[0], reason: reason.trim() });
        toast.success("Payment expired", {
          id: "pending-expire",
          description: `Expired ${res.data.expired}, settled ${res.data.settled}, failed ${res.data.failed}.`,
          position: "top-center",
        });
      } else {
        setBulkRunning(true);
        let queue = [...ids];
        let checked = 0;
        let expired = 0;
        let settled = 0;
        let failed = 0;
        while (queue.length > 0) {
          const batch = queue.slice(0, 20);
          queue = queue.slice(20);
          const res = await bulkMutation.mutateAsync({ payment_ids: batch, reason: reason.trim() });
          checked += res.data.checked;
          expired += res.data.expired;
          settled += res.data.settled;
          failed += res.data.failed;
          const remaining = res.data.remaining ?? 0;
          if (remaining > 0) {
            // No progress on this batch — stop instead of looping forever.
            if (remaining >= batch.length) break;
            queue = [...batch.slice(batch.length - remaining), ...queue];
          }
        }
        toast.success("Bulk expire finished", {
          id: "pending-expire",
          description: `Checked ${checked}, expired ${expired}, settled ${settled}, failed ${failed}.`,
          position: "top-center",
        });
      }
      setExpireTarget(null);
      setReason("");
      setSelected([]);
      void refetch();
    } catch (error) {
      // Hook already toasts. Close the dialog when the row is no longer actionable.
      const code = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      if (code === "PAYMENT_ALREADY_SETTLED" || code === "PAYMENT_NOT_PENDING" || code === "PAYMENT_NOT_FOUND") {
        setExpireTarget(null);
        setReason("");
      }
      void refetch();
    } finally {
      setBulkRunning(false);
    }
  };

  const headers = [
    { id: "order_id", text: "Order", value: "order_id" },
    { id: "customer_name", text: "Customer", value: (row: TPendingRow) => row.customer_name || "-" },
    {
      id: "session_name",
      text: "Session",
      value: (row: TPendingRow) => (
        <div className="flex flex-col">
          <span>{row.session_name || "-"}</span>
          <span className="text-xs text-gray-400">
            {row.start_datetime ? formatDateHelper(row.start_datetime, "dd MMM yyyy, H:mm") : "-"}
          </span>
        </div>
      ),
    },
    {
      id: "channel",
      text: "Channel",
      value: (row: TPendingRow) => channelLabels.get(row.channel) ?? row.channel,
    },
    {
      id: "age",
      text: "Age",
      value: (row: TPendingRow) => (
        <div className="flex items-center gap-2">
          <span>{formatAge(row.age_minutes)}</span>
          {row.is_stale && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
              Stale
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "status",
      text: "Status",
      value: (row: TPendingRow) => <span className="font-semibold text-amber-700">{row.status}</span>,
    },
    {
      id: "amount",
      text: "Amount",
      value: (row: TPendingRow) => formatCurrency(row.amount_idr),
    },
  ];

  const actionOptions = {
    text: "Actions",
    show: true,
    render: (row: TPendingRow) => (
      <div className="flex flex-row gap-2">
        <Button variant="outline" size="sm" onClick={() => handleRecheck(row)} disabled={recheckMutation.isPending}>
          Recheck
        </Button>
        <Button variant="destructive" size="sm" onClick={() => openExpire([row.payment_id])}>
          Expire
        </Button>
      </div>
    ),
  };

  const isBusy = expireMutation.isPending || bulkMutation.isPending || bulkRunning;

  return (
    <>
      <Card className="rounded-lg border-brand-100">
        <CardHeader className="flex flex-row w-full justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-brand-999 text-2xl font-semibold">Pending Payments</h3>
            <p className="text-sm text-gray-500 font-normal">Oldest first. Stale rows are past the payment window.</p>
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-brand-100 px-3 py-2">
              <span className="text-xs text-gray-500">Stale only</span>
              <Switch
                checked={staleOnly}
                onCheckedChange={(checked) => {
                  setStaleOnly(checked);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={branch}
              onValueChange={(value) => {
                setBranch(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {SEHELA_BRANCH.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              className="border-brand-100"
              search={search}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{selected.length} selected</p>
            <Button variant="destructive" disabled={selected.length === 0} onClick={() => openExpire(selected)}>
              Expire selected
            </Button>
          </div>
          <CustomTable
            data={rows}
            headers={headers}
            isLoading={isLoading}
            isMultiple
            selectedData={selected}
            setSelectedData={setSelected}
            actionOptions={actionOptions}
          />
        </CardContent>
        <CardFooter className="flex w-full">
          <CustomPagination
            onPageChange={setPage}
            currentPage={page}
            showTotal
            hasPrevPage={data?.pagination?.has_prev}
            hasNextPage={data?.pagination?.has_next}
            totalItems={data?.pagination?.total_items ?? 0}
            totalPages={data?.pagination?.total_pages ?? 0}
            limit={PAGE_SIZE}
          />
        </CardFooter>
      </Card>

      {expireTarget && (
        <BaseDialogComponent
          isOpen={!!expireTarget}
          title={expireTarget.length > 1 ? `Expire ${expireTarget.length} payments` : "Expire payment"}
          btnConfirm={isBusy ? "Working..." : "Expire"}
          onConfirm={() => void handleConfirmExpire()}
          onClose={() => setExpireTarget(null)}
          isDisabled={!reason.trim() || isBusy}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">Reason is required. This cancels the payment and releases the booking slot.</p>
            <div className="flex flex-wrap gap-2">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="rounded-full border border-brand-100 px-3 py-1 text-xs text-brand-500 hover:border-brand-500"
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" rows={3} />
            {isBusy && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Processing batches sequentially...
              </p>
            )}
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => void refetch()} disabled={isBusy}>
              <RefreshCw className="h-3 w-3" /> Refresh list
            </Button>
          </div>
        </BaseDialogComponent>
      )}
    </>
  );
};
