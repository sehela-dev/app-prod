"use client";

import { DateRangePicker } from "@/components/base/date-range-picker";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEditDiscountVoucher } from "@/hooks/api/mutations/admin/use-edit-duscount-voucher";
import { useGetDiscountVoucherDetail } from "@/hooks/api/queries/admin/discount-voucher";
import { defaultDate, formatCurrency, formatDateHelper } from "@/lib/helper";
import { SESSION_TYPE_OPTIONS } from "@/lib/voucher";
import { TDiscountType, TVoucherSessionType } from "@/types/discount-voucher.interface";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

const CATEGORY_OPTIONS = [
  {
    label: "Class",
    value: "booking",
  },
  {
    label: "Credit Package",
    value: "package_purchase",
  },
  {
    label: "Order",
    value: "order",
  },
];

// const categoryLabel = {
//   booking: "Class",
//   "package-purchase": "Credit Package",
//   order: "Order",
//   universal: "Universal",
// };

const defaultValues = {
  name: "",
  code: "",
  category: [],
  discount_type: "fixed",
  discount_value: "0",
  min_purchase_idr: "0",
  max_discount_idr: "0",
  usage_limit: "1",
  one_per_user: false,
  valid_from: defaultDate().formattedToday ?? "",
  valid_time_from: "",
  valid_time_until: "",
  valid_until: defaultDate().formattedOneMonthLater ?? "",
  session_types: [] as TVoucherSessionType[],
};

export const EditDiscountVoucherPage = () => {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const { data: detail, isLoading, isFetching } = useGetDiscountVoucherDetail(id as string);

  const [open, setOpen] = useState({
    SUCCESS: false,
    CANCEL: false,
  });

  const values = useMemo(() => {
    if (!detail?.data) return defaultValues;
    return {
      name: detail?.data?.name,
      code: detail?.data?.code,
      category: detail?.data?.categories,
      discount_type: detail?.data?.discount_type,
      discount_value: detail?.data?.discount_value,
      min_purchase_idr: detail?.data?.min_purchase_idr,
      max_discount_idr: detail?.data?.max_discount_idr ?? "",
      usage_limit: detail?.data?.usage_limit ?? "",
      one_per_user: detail?.data?.one_per_user,
      valid_from: detail?.data?.valid_from,
      valid_until: detail?.data?.valid_until,
      valid_time_from: detail?.data?.valid_time_from,
      valid_time_until: detail?.data?.valid_time_until,
      session_types: detail?.data?.session_types ?? [],
    };
  }, [detail?.data]);

  const methods = useForm({ defaultValues, values });
  const { control, handleSubmit } = methods;

  const isFixed = methods.watch("discount_type") === "fixed";
  const category = methods.watch("category") as string[] | undefined;
  const sessionTypesEnabled =
    !!category?.some((value) => value === "booking" || value === "package_purchase") && !category?.includes("order");

  const { mutateAsync } = useEditDiscountVoucher();

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data?.name,
        code: data?.code,
        categories: data?.category,
        discount_type: data?.discount_type as TDiscountType,
        discount_value: parseInt(data?.discount_value as string),
        min_purchase_idr: parseInt(data?.min_purchase_idr as string),
        usage_limit: parseInt(data?.usage_limit as string),
        one_per_user: data?.one_per_user,
        valid_from: formatDateHelper(data?.valid_from, "yyyy-MM-dd"),
        valid_until: formatDateHelper(data?.valid_until, "yyyy-MM-dd"),
        valid_time_from: data?.valid_time_from,
        valid_time_until: data?.valid_time_until,
        session_types: sessionTypesEnabled && data?.session_types?.length ? data.session_types : null,
        ...(data?.discount_type === "percentage" ? { max_discount_idr: parseInt(data?.max_discount_idr as string) } : null),
      };
      const res = await mutateAsync({ data: payload, id: id as string });
      if (res) {
        handleOpenModal("SUCCESS");
      }
    } catch (error) {
      const responseError = (error as { response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } } })
        ?.response?.data?.error;
      const message = responseError?.details?.session_types?.[0] ?? responseError?.message;
      if (message && /session/i.test(message)) {
        methods.setError("session_types", { type: "server", message });
      }
    }
  });

  const handleOpenModal = (type: "SUCCESS" | "CANCEL") => {
    setOpen((prev) => ({ ...prev, [type]: !open[type] }));
  };

  if (isLoading || isFetching)
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <h3 className="text-2xl font-semibold">Edit Discount</h3>
        <p className="text-sm text-gray-500">Modify existing discount for transactions</p>
      </div>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Card>
            <CardHeader className="font-semibold">Basic Information</CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Discount Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here.."
                          {...field}
                          // className="w-auto min-w-[388px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Discount Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999   placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here.."
                          value={field.value.toUpperCase()}
                          // className="w-auto min-w-[388px]"
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription className="text-brand-200">*) Only uppercase letters and numbers allowed</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="font-semibold">Discount Detail</CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField
                control={control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className=" text-brand-999 font-medium text-sm">Select Category</FormLabel>
                    <div className="grid  grid-cols-8 gap-2 spac border border-gray-400 rounded-md p-2">
                      {CATEGORY_OPTIONS?.map((option) => (
                        <FormItem key={option.value} className="flex items-center space-x-2 col-span-4">
                          <FormControl>
                            <Checkbox
                              checked={(field.value || []).includes(option?.value as never)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked && option.value === "order") {
                                  methods.setValue("session_types", []);
                                }
                                return checked
                                  ? field.onChange([...currentValue, option.value])
                                  : field.onChange(currentValue.filter((value) => value !== option.value));
                              }}
                            />
                          </FormControl>
                          <FormLabel className=" text-brand-999 font-medium">{option.label}</FormLabel>
                        </FormItem>
                      ))}
                    </div>
                    <FormMessage />
                    <FormDescription className="text-brand-500 font-medium mt-2">*) You can select multiple category</FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="session_types"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className=" text-brand-999 font-medium text-sm">Session Types</FormLabel>
                    <div className={`grid grid-cols-3 gap-2 rounded-md border border-gray-400 p-2 ${sessionTypesEnabled ? "" : "opacity-50"}`}>
                      {SESSION_TYPE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-brand-999 font-medium">
                          <Checkbox
                            checked={(field.value || []).includes(option.value)}
                            disabled={!sessionTypesEnabled}
                            onCheckedChange={(checked) => {
                              const currentValue = field.value || [];
                              field.onChange(
                                checked
                                  ? [...currentValue, option.value]
                                  : currentValue.filter((value) => value !== option.value),
                              );
                            }}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                    <FormDescription className="text-brand-500 font-medium">
                      {sessionTypesEnabled
                        ? "Leave all unchecked to allow all session types."
                        : category?.includes("order")
                          ? "Session types cannot be combined with Order."
                          : "Select Class or Credit Package to set session types."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="discount_type"
                defaultValue={"fixed"}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className=" text-brand-999 font-medium text-sm" required>
                      Discount Type
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        defaultValue="fixed"
                        value={field.value}
                        className="flex flex-row gap-3 items-center"
                        onValueChange={(e) => {
                          field.onChange(e);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="fixed" id="discount_type" />
                          <Label htmlFor="r1" className="text-brand-999">
                            Fix (Rp)
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="percentage" id="discount_type" />
                          <Label htmlFor="r1" className="text-brand-999">
                            Percentage(%)
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className={`grid grid-cols-${isFixed ? 2 : 3} gap-4`}>
                <FormField
                  control={control}
                  name="discount_value"
                  rules={{
                    pattern: {
                      value: /^[0-9]+$/,
                      message: "Only numbers allowed",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Discount Value
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          {...field}
                          onChange={(e) => {
                            // Remove all non-numeric characters (including currency symbols and separators)
                            const numericValue = e.target.value.replace(/\D/g, "");
                            field.onChange(numericValue);
                          }}
                          onBlur={field.onBlur}
                          value={isFixed ? formatCurrency(field.value || 0) : `${field.value} %`}

                          // className="w-auto min-w-[388px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="min_purchase_idr"
                  rules={{
                    pattern: {
                      value: /^[0-9]+$/,
                      message: "Only numbers allowed",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Minimun Purchase (Rp)
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Rp"
                          {...field}
                          onChange={(e) => {
                            // Remove all non-numeric characters (including currency symbols and separators)
                            const numericValue = e.target.value.replace(/\D/g, "");
                            field.onChange(numericValue);
                          }}
                          onBlur={field.onBlur}
                          value={field.value ? formatCurrency(field.value) : ""}

                          // className="w-auto min-w-[388px]"
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription className="text-brand-200"> *) Leave empty for no minimum purchase requirement</FormDescription>
                    </FormItem>
                  )}
                />
                {!isFixed && (
                  <FormField
                    control={control}
                    name="max_discount_idr"
                    rules={{
                      pattern: {
                        value: /^[0-9]+$/,
                        message: "Only numbers allowed",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Maximum Value (Rp)
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                            placeholder="Rp"
                            {...field}
                            onChange={(e) => {
                              // Remove all non-numeric characters (including currency symbols and separators)
                              const numericValue = e.target.value.replace(/\D/g, "");
                              field.onChange(numericValue);
                            }}
                            onBlur={field.onBlur}
                            value={field.value ? formatCurrency(field.value) : ""}

                            // className="w-auto min-w-[388px]"
                          />
                        </FormControl>
                        <FormMessage />
                        <FormDescription className="text-brand-200"> *) Leave empty for no minimum purchase requirement</FormDescription>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="font-semibold">Usage Limit</CardHeader>
              <CardContent className="flex flex-col w-full gap-4">
                <FormField
                  control={control}
                  name="usage_limit"
                  rules={{
                    pattern: {
                      value: /^[0-9]+$/,
                      message: "Only numbers allowed",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Maximum Usage
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here..."
                          {...field}
                          onChange={(e) => {
                            // Remove all non-numeric characters (including currency symbols and separators)
                            const numericValue = e.target.value.replace(/\D/g, "");
                            field.onChange(numericValue);
                          }}
                          onBlur={field.onBlur}
                          // className="w-auto min-w-[388px]"
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription className="text-brand-200"> *) Leave empty for no maximum purchase requirement</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="one_per_user"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-row items-center gap-1">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                            }}
                          />
                          <FormLabel className=" text-brand-999 font-medium">Limit 1 per user</FormLabel>
                        </div>
                      </FormControl>

                      <FormMessage />
                      <FormDescription className="text-brand-200 font-medium mt-2">Each user can only use this discount for once</FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="font-semibold">Period</CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={control}
                  name="valid_from"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Start Date
                      </FormLabel>
                      <FormControl>
                        <DateRangePicker
                          {...field}
                          mode="single"
                          allowPastDates={false}
                          allowFutureDates
                          onDateRangeChange={(e) => {
                            field.onChange(e);
                          }}
                          startDate={field.value ?? detail?.data?.valid_from}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="valid_time_from"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm">&nbsp;</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          id="valid_time_from-picker"
                          // defaultValue="10:30"
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]  appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        End Date
                      </FormLabel>
                      <FormControl>
                        <DateRangePicker
                          {...field}
                          mode="single"
                          allowPastDates={false}
                          allowFutureDates
                          onDateRangeChange={(e) => {
                            field.onChange(e);
                            console.log(e, field);
                          }}
                          startDate={field.value ?? detail?.data?.valid_until}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="valid_time_until"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm">&nbsp;</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          id="valid_time_until-picker"
                          // defaultValue="10:30"
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]  appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
          <div className="flex w-full justify-end items-center gap-2">
            <div className="">
              <Button variant={"secondary"} type="button" onClick={() => handleOpenModal("CANCEL")}>
                Cancel
              </Button>
            </div>
            <div className="">
              <Button type="submit" disabled={!methods.formState.isValid}>
                Update Discount Voucher
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
      {open.SUCCESS && (
        <BaseDialogConfirmation
          image="success-edit"
          onCancel={() => router.push("/admin/discount-voucher")}
          open={open.SUCCESS}
          hideCancel
          title="Discount Code Updated Successfully"
          subtitle="Your new discount code has been successfully updated."
          onConfirm={() => {
            methods.reset();
            handleOpenModal("SUCCESS");
            router.push("/admin/discount-voucher");
          }}
          cancelText="Discount List"
          confirmText="Ok"
        />
      )}
      {open.CANCEL && (
        <BaseDialogConfirmation
          image="warning-1"
          onCancel={() => handleOpenModal("CANCEL")}
          open={open.CANCEL}
          title="Unsaved Changes"
          subtitle="Any unsaved changes will be lost if you exit now."
          onConfirm={() => router.push("/admin/discount-voucher/")}
          cancelText="Cancel"
          confirmText="Exit"
        />
      )}
    </div>
  );
};
