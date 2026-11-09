"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useUpdateAdminPaymentChannels } from "@/hooks/api/mutations/admin";
import { useGetAdminPaymentChannels } from "@/hooks/api/queries/admin/payments";
import { CreditCard, Loader2 } from "lucide-react";
import { useMemo } from "react";

export const PaymentMethodsCard = () => {
  const { data, isLoading, isError, refetch } = useGetAdminPaymentChannels();
  const updateMutation = useUpdateAdminPaymentChannels();
  const channels = useMemo(() => data?.data ?? [], [data]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof channels>();
    channels
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((channel) => {
        const group = map.get(channel.group_label) ?? [];
        group.push(channel);
        map.set(channel.group_label, group);
      });
    return Array.from(map, ([label, items]) => ({ label, items }));
  }, [channels]);

  const allMidtransUnknown = channels.length > 0 && channels.every((channel) => channel.midtrans_active === null);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-brand-500" />
          Payment Methods
        </CardTitle>
        <CardDescription>Enable the channels members can pick at checkout.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>Couldn&apos;t load payment methods.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {allMidtransUnknown && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Tidak bisa memverifikasi Midtrans, coba lagi nanti.
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
                <div className="divide-y divide-brand-50 overflow-hidden rounded-lg border border-brand-100">
                  {group.items.map((channel) => {
                    // `midtrans_active: false` still allows turning a locally-enabled
                    // channel off; only enabling is blocked.
                    const disabled =
                      updateMutation.isPending ||
                      channel.midtrans_active === null ||
                      (channel.midtrans_active === false && !channel.is_enabled);
                    return (
                      <div key={channel.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex min-w-0 flex-col">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-brand-999">{channel.label}</span>
                            {channel.is_enabled && channel.midtrans_active === false && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                                Midtrans menonaktifkan channel ini
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{channel.code}</span>
                        </div>
                        <Switch
                          checked={channel.is_enabled}
                          disabled={disabled}
                          title={
                            channel.midtrans_active === true
                              ? undefined
                              : channel.midtrans_active === false
                                ? channel.is_enabled
                                  ? "Midtrans disabled this channel — switch it off locally"
                                  : "Aktifkan dulu di dashboard Midtrans"
                                : "Tidak bisa memverifikasi Midtrans, coba lagi nanti"
                          }
                          onCheckedChange={(checked) =>
                            updateMutation.mutate([{ code: channel.code, is_enabled: checked }])
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};
