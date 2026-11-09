import { CalendarClock, Check, GemIcon, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateHelper } from "@/lib/helper";

interface ICardCreditProps {
  title: string;
  value: number;
  isActive: boolean;
  id: string | number;
  onClick: () => void;
  disabled?: boolean;
  expiryDate?: string;
  totalCredits?: number;
  description?: string | null;
  restriction?: string;
  isShared?: boolean;
}

export const CardCreditComponent = ({
  value,
  id,
  isActive,
  title,
  onClick,
  disabled = false,
  expiryDate,
  totalCredits,
  description,
  restriction,
  isShared = false,
}: ICardCreditProps) => {
  return (
    <button
      type="button"
      key={id}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        "relative min-h-[150px] min-w-[220px] rounded-2xl border p-4 text-left flex flex-col justify-between gap-3 transition-all duration-300 select-none",
        isActive
          ? "border-brand-500 bg-brand-500 text-gray-50 shadow-md shadow-brand-500/25"
          : "border-brand-100 bg-brand-25 text-brand-500 hover:border-brand-500/60 hover:shadow-sm",
        disabled && "opacity-45 cursor-not-allowed",
        !disabled && "cursor-pointer",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <p className="flex items-baseline gap-1.5">
          <GemIcon size={18} className="shrink-0 self-center" />
          <span className="text-2xl font-bold leading-none tracking-tight">{value}</span>
          <span className="text-xs font-medium opacity-75">
            credits{totalCredits != null && totalCredits > 0 && value <= totalCredits ? ` / ${totalCredits}` : ""}
          </span>
        </p>
        <p className={cn("text-sm font-medium leading-snug line-clamp-2", isActive ? "text-gray-50/90" : "text-brand-500/80")}>{title}</p>
        {description && (
          <p className={cn("text-[11px] leading-snug line-clamp-2", isActive ? "text-gray-50/70" : "text-brand-500/60")}>
            {description}
          </p>
        )}
        {restriction && (
          <p className={cn("flex items-start gap-1.5 text-[11px] leading-snug", isActive ? "text-gray-50/70" : "text-brand-500/60")}>
            <Info size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{restriction}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isShared && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              isActive ? "bg-gray-50/20 text-gray-50" : "bg-brand-100 text-brand-700",
            )}
          >
            <Users size={11} /> Shared
          </span>
        )}
        {expiryDate && (
          <p className={cn("flex items-center gap-1.5 text-xs", isActive ? "text-gray-50/80" : "text-brand-500/60")}>
            <CalendarClock size={13} className="shrink-0" />
            Exp {formatDateHelper(expiryDate, "dd MMM yyyy")}
          </p>
        )}
      </div>

      {isActive && (
        <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-gray-50 text-brand-500">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
};