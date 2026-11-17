"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdjustPackagePurchaseCredits, useOverridePackagePurchaseExpiry, useSharePackagePurchaseAdmin } from "@/hooks/api/mutations/admin";
import { useGetPackagePurchaseDetail } from "@/hooks/api/queries/admin/package-purchase";
import { useGetCustomers } from "@/hooks/api/queries/admin/customers";
import { useAdminPermission } from "@/hooks/use-role-access";
import { useDebounce } from "@/hooks";
import { getShareErrorMessage } from "@/api-req/customer-app/payments";
import { formatCurrency } from "@/lib/helper";
import type { ICustomerData } from "@/types/customers.interface";
import {
  ClearExpiryFormValues,
  clearExpirySchema,
  CreditAdjustmentFormValues,
  creditAdjustmentSchema,
  ExpiryOverrideFormValues,
  expiryOverrideSchema,
} from "@/resolver";
import { IPackagePurchaseApiError, IPackagePurchaseErrorResponse } from "@/types/package-purchase.interface";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { ArrowLeft, CalendarClock, Loader2, ShieldAlert } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Control, FieldPath, FieldValues, FormProvider, useForm, useWatch } from "react-hook-form";
import Select from "react-select";
import { toast } from "sonner";

type DialogKind = "adjust" | "remove-all" | "expiry" | "share" | null;
type PendingAction =
  | { kind: "credit-adjustment"; delta: number; reason: string; idempotencyKey?: string }
  | { kind: "expiry-override"; expiresAt: string; reason: string; idempotencyKey?: string };

const jakartaFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const formatJakarta = (value?: string | null) => (value ? `${jakartaFormatter.format(new Date(value))} WIB` : "No expiry set");

const jakartaDateToExpiryIso = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 16, 59, 59, 999)).toISOString();
};

const actionTitle = (action: PendingAction) =>
  action.kind === "credit-adjustment" ? (action.delta > 0 ? "Add credits" : "Remove credits") : "Set package expiry";

export const PackagePurchaseDetailPage = () => {
  const router = useRouter();
  const params = useParams<{ id: string; purchaseId: string }>();
  const { isManager } = useAdminPermission();
  const { data, isLoading, isError, error, refetch } = useGetPackagePurchaseDetail(params.purchaseId);
  const { mutateAsync: adjustCredits, isPending: adjustingCredits } = useAdjustPackagePurchaseCredits();
  const { mutateAsync: overrideExpiry, isPending: overridingExpiry } = useOverridePackagePurchaseExpiry();
  const { mutateAsync: sharePurchase, isPending: sharingPurchase } = useSharePackagePurchaseAdmin();
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUser, setShareUser] = useState<ICustomerData | null>(null);
  const [shareSearch, setShareSearch] = useState("");
  const debouncedShareSearch = useDebounce(shareSearch, 300);
  const { data: shareCustomers, isLoading: shareCustomersLoading } = useGetCustomers({
    search: debouncedShareSearch,
    status: "true",
  });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  const adjustmentForm = useForm<CreditAdjustmentFormValues>({
    resolver: zodResolver(creditAdjustmentSchema),
    defaultValues: { direction: "add", amount: 1, reason: "" },
    mode: "onChange",
  });
  const removeAllForm = useForm<ClearExpiryFormValues>({ resolver: zodResolver(clearExpirySchema), defaultValues: { reason: "" }, mode: "onChange" });
  const expiryForm = useForm<ExpiryOverrideFormValues>({
    resolver: zodResolver(expiryOverrideSchema),
    defaultValues: { expires_at: "", reason: "" },
    mode: "onChange",
  });

  const purchase = data?.data;
  const balance = purchase?.credits_remaining ?? 0;
  const isSubmitting = adjustingCredits || overridingExpiry;
  const [adjustmentDirection, adjustmentAmount] = useWatch({
    control: adjustmentForm.control,
    name: ["direction", "amount"],
  });
  const previewAmount = Number(adjustmentAmount) || 0;
  const preview = balance + (adjustmentDirection === "remove" ? -previewAmount : previewAmount);

  const closeActionDialog = () => {
    setDialog(null);
    setConfirmationError(null);
    setShareError(null);
  };

  const closeShareDialog = () => {
    if (sharingPurchase) return;
    setShareEmail("");
    setShareUser(null);
    setShareSearch("");
    setShareError(null);
    setDialog(null);
  };

  const applyFieldErrors = (apiError: IPackagePurchaseApiError, action: PendingAction) => {
    const details = apiError.details;
    if (!details) return;
    Object.entries(details).forEach(([field, messages]) => {
      const message = messages[0] ?? apiError.message;
      if (action.kind === "credit-adjustment") {
        adjustmentForm.setError(field === "delta" ? "amount" : "reason", { message });
      } else {
        expiryForm.setError(field === "expires_at" ? "expires_at" : "reason", { message });
      }
    });
  };

  const executeAction = async (action: PendingAction, retryNetworkFailure = true): Promise<void> => {
    const idempotencyKey = action.idempotencyKey ?? crypto.randomUUID();
    const actionWithKey = { ...action, idempotencyKey };
    setPendingAction(actionWithKey);
    setConfirmationError(null);
    try {
      if (actionWithKey.kind === "credit-adjustment") {
        await adjustCredits({
          id: params.purchaseId,
          data: { delta: actionWithKey.delta, reason: actionWithKey.reason },
          idempotencyKey,
        });
      } else {
        await overrideExpiry({
          id: params.purchaseId,
          data: { expires_at: actionWithKey.expiresAt, reason: actionWithKey.reason },
          idempotencyKey,
        });
      }
      setPendingAction(null);
      closeActionDialog();
      const wasReactivated = purchase?.status === "expired" && actionWithKey.kind === "expiry-override";
      toast.success(wasReactivated ? "Package reactivated" : "Package updated", {
        description: wasReactivated ? "Manage its credits from the member Information tab." : "The package detail has been refreshed.",
        position: "top-center",
      });
      if (wasReactivated) {
        router.push(`/admin/member/${params.id}`);
        return;
      }
      await refetch();
    } catch (caughtError) {
      const axiosError = caughtError as AxiosError<IPackagePurchaseErrorResponse>;
      if (!axiosError.response && retryNetworkFailure) {
        await executeAction(actionWithKey, false);
        return;
      }
      const status = axiosError.response?.status;
      const apiError = axiosError.response?.data?.error;
      const message = apiError?.message ?? "Unable to complete this package action. Please try again.";
      if (status === 400 && apiError) {
        applyFieldErrors(apiError, actionWithKey);
        setPendingAction(null);
        setConfirmationError(message);
        return;
      }
      if (status === 409 || status === 422) {
        setPendingAction(null);
        setConfirmationError(null);
        await refetch();
        toast.error("Package state changed", { description: message, position: "top-center" });
        return;
      }
      if (status === 404) {
        setPendingAction(null);
        closeActionDialog();
        await refetch();
        toast.error("Package purchase was not found", { position: "top-center" });
        return;
      }
      setConfirmationError(status && status >= 500 ? `${message} Retry with the same request.` : message);
    }
  };

  const requestAdjustmentConfirmation = async () => {
    if (!(await adjustmentForm.trigger())) return;
    const values = adjustmentForm.getValues();
    const amount = Number(values.amount);
    if (values.direction === "remove" && amount > balance) {
      adjustmentForm.setError("amount", { message: "Cannot remove more credits than the current balance" });
      return;
    }
    setConfirmationError(null);
    setPendingAction({ kind: "credit-adjustment", delta: values.direction === "remove" ? -amount : amount, reason: values.reason.trim() });
  };

  const requestRemoveAllConfirmation = async () => {
    if (!(await removeAllForm.trigger())) return;
    if (balance <= 0) {
      removeAllForm.setError("reason", { message: "There are no remaining credits to remove" });
      return;
    }
    setConfirmationError(null);
    setPendingAction({ kind: "credit-adjustment", delta: -balance, reason: removeAllForm.getValues().reason.trim() });
  };

  const requestExpiryConfirmation = async () => {
    if (!(await expiryForm.trigger())) return;
    const values = expiryForm.getValues();
    const isoDate = jakartaDateToExpiryIso(values.expires_at);
    if (!isoDate) {
      expiryForm.setError("expires_at", { message: "Invalid expiry date" });
      return;
    }
    setConfirmationError(null);
    setPendingAction({ kind: "expiry-override", expiresAt: isoDate, reason: values.reason.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="ml-2">Loading package purchase...</span>
      </div>
    );
  }
  if (isError || !purchase) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p>{error instanceof Error ? error.message : "Unable to load this package purchase."}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const isExpired = purchase.status === "expired";
  const canAdjust = purchase.status === "paid" && (!purchase.expires_at || new Date(purchase.expires_at).getTime() > Date.now());
  const canOverrideExpiry = purchase.status !== "pending_payment" && purchase.status !== "refunded";
  // Unused-only share: a single credit_spend locks sharing; no revoke.
  const hasSpend = purchase.ledger_history.some((e) => e.entry_type === "credit_spend");
  const isShared = purchase.shared?.is_shared === true;
  const canShare =
    purchase.status === "paid" &&
    purchase.credits_remaining > 0 &&
    purchase.credits_used === 0 &&
    !hasSpend &&
    !isShared &&
    canAdjust;

  const handleShare = async () => {
    const trimmed = shareEmail.trim();
    if (trimmed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setShareError("Enter a valid email address.");
        return;
      }
      if (shareUser) {
        setShareError("Fill either a member or an email, not both.");
        return;
      }
    } else if (!shareUser) {
      setShareError("Pick a member or enter an email.");
      return;
    }
    setShareError(null);
    try {
      const target = trimmed || shareUser?.email || shareUser?.full_name || "";
      await sharePurchase(
        trimmed
          ? { id: params.purchaseId, email: trimmed }
          : { id: params.purchaseId, user_id: shareUser?.id },
      );
      toast.success("Package shared", { description: `Shared with ${target}.`, position: "top-center" });
      closeShareDialog();
      await refetch();
    } catch (caughtError) {
      const axiosError = caughtError as AxiosError<IPackagePurchaseErrorResponse>;
      const apiError = axiosError.response?.data?.error;
      setShareError(getShareErrorMessage(apiError?.code, apiError?.message));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" className="px-0" onClick={() => router.push(`/admin/member/${params.id}`)}>
            <ArrowLeft /> Back to member
          </Button>
          <h1 className="text-2xl font-semibold text-brand-999">Package purchase detail</h1>
          <p className="text-sm text-gray-500">Review credits, payment state, and manager action history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={purchase.status === "paid" ? "default" : purchase.status === "expired" ? "destructive" : "secondary"} className="capitalize">
            {purchase.status.replace("_", " ")}
          </Badge>
          {isShared && (
            <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700">
              Shared
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="font-semibold">Customer and package</CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailItem label="Member" value={purchase.user?.full_name ?? "-"} />
            <DetailItem label="Phone" value={purchase.user?.phone ?? "-"} />
            {isShared && purchase.shared?.shared_with_user_name && (
              <DetailItem label="Shared with" value={purchase.shared.shared_with_user_name} />
            )}
            <DetailItem label="Package" value={purchase.credit_package?.name ?? "-"} />
            <DetailItem label="Original credits" value={String(purchase.credit_package?.credits ?? 0)} />
            <DetailItem label="Purchased" value={formatJakarta(purchase.purchased_at)} />
            <DetailItem label="Payment" value={purchase.payment?.status ?? (purchase.payment_id ? "Recorded" : "No payment record")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="font-semibold">Credit status</CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailItem label="Remaining balance" value={String(purchase.credits_remaining)} />
            <DetailItem label="Credits used" value={String(purchase.credits_used)} />
            <DetailItem label="Expiry (Jakarta)" value={formatJakarta(purchase.expires_at)} />
            <DetailItem label="First used" value={formatJakarta(purchase.first_used_at)} />
            <DetailItem
              label="Paid amount"
              value={purchase.actual_amount_paid_idr === null ? "-" : formatCurrency(purchase.actual_amount_paid_idr)}
            />
            <DetailItem label="Package type" value={purchase.credit_package?.package_type ?? "-"} />
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <Card>
          <CardHeader className="font-semibold">Manager actions</CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {isExpired ? (
              <>
                <Button variant="outline" onClick={() => setDialog("expiry")} disabled={!canOverrideExpiry}>
                  <CalendarClock /> Reactivate package
                </Button>
                <p className="w-full text-sm text-gray-500">After reactivation, manage credits from the member Information tab.</p>
              </>
            ) : (
              <>
                <Button onClick={() => setDialog("adjust")} disabled={!canAdjust}>
                  Adjust credits
                </Button>
                <Button variant="destructive" onClick={() => setDialog("remove-all")} disabled={!canAdjust || balance <= 0}>
                  Remove all remaining credits
                </Button>
                <Button variant="outline" onClick={() => setDialog("expiry")} disabled={!canOverrideExpiry}>
                  <CalendarClock /> Set or extend expiry
                </Button>
                <Button variant="outline" onClick={() => setDialog("share")} disabled={!canShare}>
                  Share package
                </Button>
                {!canAdjust && <p className="w-full text-sm text-gray-500">Credit adjustments are available only for active paid packages.</p>}
                {canAdjust && !canShare && !isShared && (
                  <p className="w-full text-sm text-gray-500">Sharing is available only for unused packages with remaining credits.</p>
                )}
                {isShared && (
                  <p className="w-full text-sm text-gray-500">This package has already been shared and cannot be revoked.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <HistoryTable
        title="Credit ledger history"
        emptyText="No ledger entries were recorded for this purchase."
        headers={["Date (WIB)", "Type", "Amount", "Session", "Session date (WIB)", "Spender", "Note"]}
      >
        {purchase.ledger_history.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{formatJakarta(entry.created_at)}</TableCell>
            <TableCell className="capitalize">{entry.entry_type.replaceAll("_", " ")}</TableCell>
            <TableCell className={entry.amount < 0 ? "text-destructive" : "text-green-700"}>
              {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
            </TableCell>
            <TableCell className="whitespace-normal">
              {entry.booking_session_id ? (
                <a
                  href={`/admin/session/${entry.booking_session_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline-offset-2 hover:underline"
                  title="Open session detail in new tab"
                >
                  {entry.booking_session_name ?? `${entry.booking_session_id.slice(0, 8)}…`}
                </a>
              ) : entry.booking_session_name ? (
                <span className="font-medium">{entry.booking_session_name}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="whitespace-normal">
              {entry.booking_session_start_at ? (
                <span>{formatJakarta(entry.booking_session_start_at)}</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="whitespace-normal">
              {entry.spender?.full_name ? (
                <span className="inline-flex items-center gap-1">
                  {entry.spender.full_name}
                  {entry.is_shared_credit ? (
                    <Badge variant="outline" className="text-[10px] leading-none px-1 py-0">
                      shared
                    </Badge>
                  ) : null}
                </span>
              ) : entry.user_id ? (
                <span className="text-xs text-muted-foreground">{entry.user_id.slice(0, 8)}…</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="whitespace-normal">{entry.note ?? "-"}</TableCell>
          </TableRow>
        ))}
      </HistoryTable>

      <HistoryTable
        title="Manager action history"
        emptyText="No manager actions have been recorded."
        headers={["Date (WIB)", "Type", "Actor", "Reason", "Balance"]}
      >
        {purchase.manual_action_history.map((action) => (
          <TableRow key={action.id}>
            <TableCell>{formatJakarta(action.created_at)}</TableCell>
            <TableCell className="capitalize">{action.action_type.replaceAll("_", " ")}</TableCell>
            <TableCell>{action.actor?.full_name ?? action.actor?.email ?? "Manager"}</TableCell>
            <TableCell className="whitespace-normal">{action.reason}</TableCell>
            <TableCell>
              {action.before_state.ledger_balance ?? "-"} → {action.after_state.ledger_balance ?? "-"}
            </TableCell>
          </TableRow>
        ))}
      </HistoryTable>

      <Dialog open={dialog === "adjust"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust remaining credits</DialogTitle>
            <DialogDescription>Choose whether to add or remove a whole number of credits. Current balance: {balance}.</DialogDescription>
          </DialogHeader>
          <FormProvider {...adjustmentForm}>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestAdjustmentConfirmation();
              }}
            >
              <FormField
                control={adjustmentForm.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment</FormLabel>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-2">
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                          <RadioGroupItem value="add" /> Add credits
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                          <RadioGroupItem value="remove" /> Remove credits
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustmentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Credits</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="rounded-md bg-muted p-3 text-sm">
                Resulting remaining balance: <strong>{preview}</strong>
              </p>
              <ReasonField control={adjustmentForm.control} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeActionDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={preview < 0}>
                  Review adjustment
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "remove-all"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove all remaining credits</DialogTitle>
            <DialogDescription>This will remove all {balance} remaining credits. It does not expire or refund the package.</DialogDescription>
          </DialogHeader>
          <FormProvider {...removeAllForm}>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestRemoveAllConfirmation();
              }}
            >
              <ReasonField control={removeAllForm.control} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeActionDialog}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Review removal
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "expiry"} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isExpired ? "Reactivate package" : "Set or extend expiry"}</DialogTitle>
            <DialogDescription>
              {isExpired
                ? "This returns the package to paid status and may restore prior expiry deductions."
                : "The package expires at 23:59 WIB on the selected date."}
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...expiryForm}>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestExpiryConfirmation();
              }}
            >
              <FormField
                control={expiryForm.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Expiry date (WIB)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        // min={jakartaTodayForInput()}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ReasonField control={expiryForm.control} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeActionDialog}>
                  Cancel
                </Button>
                <Button type="submit">Review {isExpired ? "reactivation" : "expiry"}</Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "share"} onOpenChange={(open) => !open && closeShareDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share package</DialogTitle>
            <DialogDescription>
              Pick a member from the list or enter a registered email. Sharing works only for unused packages, lasts
              until expiry, and cannot be revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <p className="mb-1 text-sm font-medium">Member</p>
              <Select
                options={shareCustomers?.data?.map((item) => ({
                  ...item,
                  label: `${item.full_name} - ${item.phone}`,
                }))}
                value={shareUser}
                isLoading={shareCustomersLoading}
                getOptionValue={(opt) => opt.id}
                onInputChange={setShareSearch}
                inputValue={shareSearch}
                placeholder="Search member..."
                onChange={(e) => {
                  setShareUser(e);
                  if (e) {
                    setShareEmail("");
                    setShareError(null);
                  }
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Or recipient email</p>
              <Input
                type="email"
                placeholder="friend@mail.com"
                value={shareEmail}
                onChange={(e) => {
                  setShareEmail(e.target.value);
                  if (shareError) setShareError(null);
                  if (e.target.value.trim()) setShareUser(null);
                }}
                aria-label="Recipient email"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleShare();
                  }
                }}
              />
            </div>
            {shareError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {shareError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeShareDialog} disabled={sharingPurchase}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleShare()}
              disabled={sharingPurchase || (!shareEmail.trim() && !shareUser)}
            >
              {sharingPurchase && <Loader2 className="animate-spin" />} Share package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && !isSubmitting && setPendingAction(null)}>
        <DialogContent showCloseButton={!isSubmitting}>
          <DialogHeader>
            <DialogTitle>Confirm {pendingAction ? actionTitle(pendingAction).toLowerCase() : "action"}</DialogTitle>
            <DialogDescription>
              {pendingAction?.kind === "credit-adjustment"
                ? `The remaining balance will change from ${balance} to ${balance + pendingAction.delta}.`
                : `The expiry will be ${formatJakarta(pendingAction?.expiresAt)}.`}
            </DialogDescription>
          </DialogHeader>
          {confirmationError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{confirmationError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.kind === "credit-adjustment" && pendingAction.delta < 0 ? "destructive" : "default"}
              disabled={!pendingAction || isSubmitting}
              onClick={() => pendingAction && void executeAction(pendingAction)}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {confirmationError ? "Retry same request" : "Confirm action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-gray-500">{label}</p>
    <p className="font-medium text-brand-999">{value}</p>
  </div>
);

const ReasonField = <T extends FieldValues>({ control }: { control: Control<T> }) => (
  <FormField
    control={control}
    name={"reason" as FieldPath<T>}
    render={({ field }) => (
      <FormItem>
        <FormLabel required>Reason</FormLabel>
        <FormControl>
          <Textarea maxLength={500} placeholder="Explain this manager action" {...field} />
        </FormControl>
        <p className="text-right text-xs text-gray-500">{String(field.value ?? "").length} / 500</p>
        <FormMessage />
      </FormItem>
    )}
  />
);

const HistoryTable = ({
  title,
  emptyText,
  headers,
  children,
}: {
  title: string;
  emptyText: string;
  headers: string[];
  children: React.ReactNode;
}) => {
  const rows = Array.isArray(children) ? children : [];
  return (
    <Card>
      <CardHeader className="font-semibold">{title}</CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              children
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-8 text-center text-gray-500">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
