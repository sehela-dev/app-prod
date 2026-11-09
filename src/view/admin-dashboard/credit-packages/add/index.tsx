"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { useCreatePackage } from "@/hooks/api/mutations/admin";
import { Select, SelectItem, SelectGroup, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import InstructorSelect, { MultiValue } from "react-select";
import { useGetInstructor } from "@/hooks/api/queries/admin/instructor";
// import { useRouter } from "next/navigation";
// import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { OPTION_TYPE } from "@/components/page/session/form";
import { useGetClassSessionsCategory } from "@/hooks/api/queries/admin/class-session";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/helper";
import { Loader2 } from "lucide-react";
import { ICreatePackagePayload, IPackageFormValues } from "@/types/credit-package.interface";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";

export const sessionType = [
  {
    value: "all",
    label: "Online & Offline",
  },
  {
    value: "online",
    label: "Online",
  },
  {
    value: "offline",
    label: "Offline",
  },
];

const defaultValues: IPackageFormValues = {
  name: "",
  credits: "",
  price_idr: "",
  validity_days: "",
  description: "",
  session_type_restriction: "all", //regular, private, special, or null
  place_restriction: "all", // offline, online, null
  class_ids_restriction: [], //specific class UUID or null
  has_instructor_restriction: false,
  instructor_ids_restriction: [], // specific instructor auth_user_id or empty
  has_time_restriction: false,
  eligible_start_time: "",
  eligible_end_time: "",
  package_type: "purchase",
  is_active: true,
  is_visible: true,
  is_shareable: false,
  max_purchases_per_user: "",
  only_for_new_users: false,
};
export const AddCreditPacakgesPage = () => {
  const router = useRouter();
  const methods = useForm({ defaultValues });
  const { control, handleSubmit } = methods;
  const hasInstructorRestriction = methods.watch("has_instructor_restriction");
  const hasTimeRestriction = methods.watch("has_time_restriction");
  const { mutateAsync } = useCreatePackage();

  const { data: clasCategory, isLoading: loadingCategory } = useGetClassSessionsCategory({ page: 1, limit: 999, status: "true", sort_by: "name" });
  const { data: instructorData, isLoading: loadingInstructors } = useGetInstructor({ page: 1, limit: 999, status: "active" });
  const [open, setOpen] = useState({
    SUCCESS: false,
    CANCEL: false,
  });

  const classCategoryOption = useMemo(() => {
    return clasCategory?.data?.map((item) => ({
      name: item.class_name,
      id: item.id,
    }));
  }, [clasCategory?.data]);

  const instructorOptions = useMemo(
    () =>
      instructorData?.data?.map((item) => ({
        value: item.id,
        label: item.full_name,
      })) ?? [],
    [instructorData?.data],
  );

  const onSubmit = handleSubmit(async (data) => {
    methods.clearErrors(["eligible_start_time", "eligible_end_time", "instructor_ids_restriction"]);
    try {
      if (data?.has_instructor_restriction && !data?.instructor_ids_restriction?.length) {
        methods.setError("instructor_ids_restriction", {
          type: "manual",
          message: "Select at least one instructor or turn off the instructor restriction.",
        });
        return;
      }
      const start = data?.eligible_start_time?.trim() || "";
      const end = data?.eligible_end_time?.trim() || "";
      if (data?.has_time_restriction) {
        if (!start || !end) {
          methods.setError("eligible_start_time", {
            type: "manual",
            message: "Start and end time must be set together.",
          });
          return;
        }
        if (start === end) {
          methods.setError("eligible_end_time", {
            type: "manual",
            message: "Start and end time must differ.",
          });
          return;
        }
      }
      const payload: ICreatePackagePayload = {
        credits: parseInt(data?.credits),
        package_type: data?.package_type,
        description: data?.description,
        is_active: true,
        is_visible: data?.is_visible ?? true,
        name: data?.name,
        price_idr: parseInt(data?.price_idr),
        validity_days: parseInt(data?.validity_days),
        class_ids_restriction: data?.class_ids_restriction,
        ...(data?.has_instructor_restriction
          ? { instructor_ids_restriction: data.instructor_ids_restriction }
          : {}),
        ...(data?.has_time_restriction
          ? { eligible_start_time: start, eligible_end_time: end }
          : {}),
        place_restriction: data?.place_restriction,
        session_type_restriction: data?.session_type_restriction,
        is_shareable: data?.is_shareable,
        max_purchases_per_user: data?.max_purchases_per_user ? parseInt(data.max_purchases_per_user) : null,
        only_for_new_users: data?.only_for_new_users ?? false,
      };

      const res = await mutateAsync(payload);
      if (res) {
        handleOpenModal("SUCCESS");
      }
    } catch (error) {
      const responseError = (error as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response
        ?.data?.error;
      if (responseError?.code === "INVALID_INSTRUCTOR") {
        methods.setError("instructor_ids_restriction", { type: "server", message: responseError.message });
      }
      if (responseError?.code === "INVALID_TIME_WINDOW") {
        methods.setError("eligible_start_time", { type: "server", message: responseError.message });
      }
    }
  });

  const handleOpenModal = (type: "SUCCESS" | "CANCEL") => {
    setOpen((prev) => ({ ...prev, [type]: !open[type] }));
  };
  if (loadingCategory || loadingInstructors)
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  return (
    <div className="flex w-full  flex-col gap-2">
      <div className="flex flex-col">
        <h3 className="text-2xl text-brand-999 font-semibold">Create Credit Package</h3>
        <p className="text-sm text-gray-500">Fill in the details to create a new credit package.</p>
      </div>
      <FormProvider {...methods}>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <Card className="border-brand-100 w-full">
              <CardHeader className="flex flex-row text-lg w-full justify-between items-center font-semibold">Basic Information</CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 space-y-2">
                  <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Package Name
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
                    name="session_type_restriction"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Package Type
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(e) => {
                              field.onChange(e);
                            }}
                            {...field}
                          >
                            <SelectTrigger className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]">
                              <SelectValue placeholder="Select Class Type" className="!text-gray-400" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={"all"}>All</SelectItem>
                                {OPTION_TYPE.map((item) => (
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
                    control={control}
                    name="validity_days"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Valid for (days)
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
                    name="place_restriction"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Session Type
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(e) => {
                              field.onChange(e);
                            }}
                            {...field}
                          >
                            <SelectTrigger className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]">
                              <SelectValue placeholder="Select Class Type" className="!text-gray-400" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {sessionType.map((item) => (
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
                </div>
                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className=" text-brand-999 font-medium text-sm" required>
                        Description
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here.."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="is_visible"
                  render={({ field }) => (
                    <FormItem className="flex flex-row w-full justify-between items-center pt-4">
                      <div className="flex flex-col gap-2">
                        <FormLabel className=" text-brand-999 font-medium text-sm">Visible in catalog</FormLabel>
                        <FormDescription>Off = hidden from public catalog, still buyable via direct link</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="is_shareable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row w-full justify-between items-center pt-4">
                      <div className="flex flex-col gap-2">
                        <FormLabel className=" text-brand-999 font-medium text-sm">Allow Sharing</FormLabel>
                        <FormDescription>Enable if this credit can be shared with friend</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-brand-100 w-full">
              <CardHeader className="flex flex-row text-lg w-full justify-between items-center font-semibold">Package Detail</CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {" "}
                  <FormField
                    control={control}
                    name="price_idr"
                    rules={{
                      pattern: {
                        value: /^[0-9]+$/,
                        message: "Only numbers allowed",
                      },
                    }}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Price
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
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="credits"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm" required>
                          Credit Amount
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
                    name="class_ids_restriction"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className=" text-brand-999 font-medium text-sm">Select Class</FormLabel>
                        <div className="grid  grid-cols-12 gap-2 spac border border-gray-400 rounded-md p-2">
                          {classCategoryOption?.map((option) => (
                            <FormItem key={option.id} className="flex items-center space-x-2 col-span-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value.includes(option?.id as string)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, option.id])
                                      : field.onChange(field.value.filter((value) => value !== option.id));
                                  }}
                                />
                              </FormControl>
                              <FormLabel className=" text-brand-999 font-medium">{option.name}</FormLabel>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                        <FormDescription className="text-brand-500 font-medium mt-2">*) You can select multiple classes at once</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="has_instructor_restriction"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row w-full justify-between items-center pt-2">
                        <div className="flex flex-col gap-2">
                          <FormLabel className=" text-brand-999 font-medium text-sm">Limit by instructor</FormLabel>
                          <FormDescription>Off = semua instructor.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {hasInstructorRestriction && (
                    <FormField
                      control={control}
                      name="instructor_ids_restriction"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className=" text-brand-999 font-medium text-sm">Instructors</FormLabel>
                          <FormControl>
                            <InstructorSelect
                              isMulti
                              isClearable
                              isLoading={loadingInstructors}
                              options={instructorOptions}
                              value={instructorOptions.filter((option) => (field.value || []).includes(option.value))}
                              onChange={(selected: MultiValue<{ value: string; label: string }>) =>
                                field.onChange(selected.map((option) => option.value))
                              }
                              placeholder="Select instructors"
                              classNamePrefix="instructor-select"
                              classNames={{
                                control: () =>
                                  "!min-h-[42px] !border-2 !border-gray-200 !rounded-lg text-sm focus:outline-none focus:border-brand-500 transition-colors !bg-transparent",
                                placeholder: () => "text-gray-400 text-sm",
                                multiValue: () => "bg-brand-100",
                                multiValueLabel: () => "text-brand-999",
                                input: () => "text-brand-999 text-sm",
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-brand-500 font-medium">
                            Select one or more instructors.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={control}
                    name="has_time_restriction"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row w-full justify-between items-center pt-2">
                        <div className="flex flex-col gap-2">
                          <FormLabel className=" text-brand-999 font-medium text-sm">Limit by time window</FormLabel>
                          <FormDescription>Off = tanpa batas jam.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {hasTimeRestriction && (
                    <>
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name="eligible_start_time"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm">Eligible start time (WIB)</FormLabel>
                              <FormControl>
                                <Input type="time" className="w-full border-2 border-gray-200 rounded-lg h-[42px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="eligible_end_time"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm">Eligible end time (WIB)</FormLabel>
                              <FormControl>
                                <Input type="time" className="w-full border-2 border-gray-200 rounded-lg h-[42px]" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="col-span-2 text-xs text-gray-500">
                        End time is exclusive; overnight windows (e.g. 22:00–02:00) are allowed.
                      </p>
                    </>
                  )}
                  <FormField
                    control={control}
                    name="max_purchases_per_user"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className=" text-brand-999 font-medium text-sm">
                          Max purchases per user
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                            placeholder="Unlimited"
                            inputMode="numeric"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Empty = unlimited. 1 = one-time buy.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="only_for_new_users"
                    render={({ field }) => (
                      <FormItem className="flex flex-row w-full justify-between items-center pt-4 col-span-2">
                        <div className="flex flex-col gap-2">
                          <FormLabel className=" text-brand-999 font-medium text-sm">New members only</FormLabel>
                          <FormDescription>Only buyable by users with no settled package/class/transaction history</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-row items-center gap-2 mt-4 justify-end">
            <div className="">
              <Button
                variant={"secondary"}
                type="button"
                onClick={() => {
                  if (methods.formState.isDirty) {
                    handleOpenModal("CANCEL");
                  } else {
                    router.push("/admin/credit-packages");
                  }
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="">
              <Button type="submit">Create Package</Button>
            </div>
          </div>
        </form>
      </FormProvider>
      {open.SUCCESS && (
        <BaseDialogConfirmation
          image="success-add"
          onCancel={() => router.push("/admin/credit-packages")}
          open={open.SUCCESS}
          title="Credit Package Created Successfully"
          subtitle="Your new credit package has been successfully added."
          onConfirm={() => {
            methods.reset();
            handleOpenModal("SUCCESS");
          }}
          cancelText="Credit Package List"
          confirmText="Create More"
        />
      )}
      {open.CANCEL && (
        <BaseDialogConfirmation
          image="warning-1"
          onCancel={() => handleOpenModal("CANCEL")}
          open={open.CANCEL}
          title="Credit Package Not Saved"
          subtitle="If you exit now, unsaved changes will be lost and cannot be recovered. Continue?"
          onConfirm={() => router.push("/admin/credit-packages")}
          cancelText="Cancel"
          confirmText="Continue"
        />
      )}
    </div>
  );
};
