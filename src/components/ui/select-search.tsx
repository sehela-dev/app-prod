"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SelectSearchOption {
  value: string;
  label: string;
}

interface SelectSearchProps {
  options: SelectSearchOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (search: string) => void;
  debounceMs?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  loading?: boolean;
  loadingMessage?: string;
}

export function SelectSearch({
  options,
  value,
  onValueChange,
  searchValue,
  onSearchChange,
  debounceMs = 300,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  clearable = false,
  loading = false,
  loadingMessage = "Loading...",
}: SelectSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [internalSearch, setInternalSearch] = React.useState(searchValue || "");

  React.useEffect(() => {
    if (onSearchChange && internalSearch !== searchValue) {
      const timer = setTimeout(() => {
        onSearchChange(internalSearch);
      }, debounceMs);

      return () => clearTimeout(timer);
    }
  }, [internalSearch, debounceMs, onSearchChange, searchValue]);

  React.useEffect(() => {
    if (searchValue !== undefined) {
      setInternalSearch(searchValue);
    }
  }, [searchValue]);

  const selectedOption = options.find((option) => option.value === value);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange?.("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between border-gray-200 shadow-sm",
              clearable && value && "pr-9",
              !value && "text-muted-foreground",
              className,
            )}
            disabled={disabled}
          >
            <span className="truncate text-gray-300">{loading ? loadingMessage : selectedOption ? selectedOption.label : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {clearable && value && !loading && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-700 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0 border-brand-50">
        {/* Options are already filtered by the caller/server. cmdk would otherwise
            filter on the UUID value again and hide valid results. */}
        <Command shouldFilter={false} className="bg-gray-50 border-brand-50">
          <CommandInput placeholder={searchPlaceholder} value={internalSearch} onValueChange={setInternalSearch} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onValueChange?.(option.value === value ? "" : option.value);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
