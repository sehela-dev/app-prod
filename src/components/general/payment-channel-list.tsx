"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, Check, ChevronDown, CircleDollarSign, CreditCard, QrCode, Wallet } from "lucide-react";

import type { IPaymentChannel } from "@/api-req/customer-app";
import { cn } from "@/lib/utils";

interface IPaymentChannelListProps {
  channels: IPaymentChannel[];
  selected: string | null;
  onSelect: (code: string) => void;
  /** Open the list immediately (e.g. inside a change-method dialog). */
  defaultOpen?: boolean;
}

const groupIcon = (groupLabel: string) => {
  switch (groupLabel) {
    case "Virtual Account":
      return Building2;
    case "E-Wallet":
      return Wallet;
    case "QRIS":
      return QrCode;
    case "Card":
      return CreditCard;
    default:
      return CircleDollarSign;
  }
};

// Small local marks keyed by channel code. The human-readable name always comes
// from the API; this is only the icon fallback when `icon_url` is empty.
const CHANNEL_MARK: Record<string, { text: string; className: string }> = {
  bni_va: { text: "BNI", className: "border-orange-200 bg-orange-50 text-orange-700" },
  bri_va: { text: "BRI", className: "border-blue-200 bg-blue-50 text-blue-700" },
  permata_va: { text: "PRMT", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  echannel: { text: "MDR", className: "border-amber-200 bg-amber-50 text-amber-700" },
  cimb_va: { text: "CIMB", className: "border-red-200 bg-red-50 text-red-700" },
  danamon_va: { text: "DAN", className: "border-sky-200 bg-sky-50 text-sky-700" },
  bsi_va: { text: "BSI", className: "border-teal-200 bg-teal-50 text-teal-700" },
  seabank_va: { text: "SEA", className: "border-orange-200 bg-orange-50 text-orange-700" },
  other_va: { text: "VA", className: "border-brand-100 bg-brand-25 text-brand-500" },
  gopay: { text: "GP", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  other_qris: { text: "QR", className: "border-brand-200 bg-brand-50 text-brand-700" },
  credit_card: { text: "CARD", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
};

const groupChannels = (channels: IPaymentChannel[]) => {
  const groups = new Map<string, IPaymentChannel[]>();
  channels
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((channel) => {
      const group = groups.get(channel.group_label) ?? [];
      group.push(channel);
      groups.set(channel.group_label, group);
    });
  return Array.from(groups, ([label, items]) => ({ label, items }));
};

const ChannelMark = ({ channel }: { channel: IPaymentChannel }) => {
  const GroupIcon = groupIcon(channel.group_label);
  const mark = CHANNEL_MARK[channel.code];
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
        mark?.className ?? "border-brand-100 bg-brand-25 text-brand-500",
      )}
    >
      {channel.icon_url ? (
        <Image src={channel.icon_url} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
      ) : mark ? (
        <span className="text-[8px] font-extrabold tracking-tight">{mark.text}</span>
      ) : (
        <GroupIcon className="h-4 w-4" />
      )}
    </span>
  );
};

export const PaymentChannelList = ({ channels, selected, onSelect, defaultOpen = false }: IPaymentChannelListProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const groups = groupChannels(channels);
  const selectedChannel = channels.find((channel) => channel.code === selected) ?? null;

  if (channels.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        {selectedChannel ? (
          <ChannelMark channel={selectedChannel} />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-25 text-brand-500">
            <CreditCard className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-999">
          {selectedChannel?.label ?? "Choose a payment method"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-brand-500/60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="max-h-[min(60vh,320px)] overflow-y-auto border-t border-brand-50">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && "border-t border-brand-50")}>
              <p className="px-3 pb-0.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-500/50">
                {group.label}
              </p>
              {group.items.map((channel) => {
                const isSelected = selected === channel.code;
                return (
                  <button
                    key={channel.code}
                    type="button"
                    onClick={() => {
                      onSelect(channel.code);
                      setOpen(false);
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      isSelected ? "bg-brand-25" : "hover:bg-brand-25/60",
                    )}
                  >
                    <ChannelMark channel={channel} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-999">
                      {channel.label}
                    </span>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white",
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
