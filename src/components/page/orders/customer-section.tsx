"use client";
import { GeneralTabComponent } from "@/components/general/tabs-component";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminManualTransaction } from "@/context/admin/add-transaction.ctx";
import { useDebounce } from "@/hooks";
import { useGetCustomers } from "@/hooks/api/queries/admin/customers";
import { useGetThirdPartyApp } from "@/hooks/api/queries/admin/orders/use-get-third-party";
import { ICustomerData } from "@/types/customers.interface";
import { IThirdPartyApp } from "@/types/orders.interface";
import { SEHELA_BRANCH } from "@/constants/sample-data";

// import { useCreateNewGuest } from "@/hooks/api/mutations/admin";
import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import Select from "react-select";
const customerSectionTab = [
  // {
  //   value: "new",
  //   name: "New Customer",
  // },
  {
    value: "search",
    name: "Find Member",
  },
];

const defaultValues = {
  id: "",
  name: "",
  phone: "",
  email: "",
  third_party_id: "",
  booking_id: "",
  branch: "",
};

export const OrderCustomerSectionComponent = ({ enroll = false }: { enroll?: boolean }) => {
  const { addCustomer } = useAdminManualTransaction();
  // const { mutateAsync } = useCreateNewGuest();
  const methods = useForm({ defaultValues });
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce(search, 300);
  const [selectedUser, setSelectedUser] = useState<ICustomerData | null>();
  const { data: thirdPartyApp } = useGetThirdPartyApp(enroll);
  const [thirdParty, setThirdParty] = useState<IThirdPartyApp | null>(null);

  const onSearch = (e: string) => {
    setSearch(e);
  };

  const { control, handleSubmit } = methods;
  const [tabCustomer, setTabCustomer] = useState("search");

  const { data, isLoading, refetch } = useGetCustomers({ search: debounceSearch, status: 'true' });
  const bookings = methods.watch("booking_id");

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        email: data.email,
        name: data.name,
        phone: data.phone,
        ...(data.branch ? { branch: data.branch } : null),
        ...(tabCustomer === "search" ? { id: data?.id } : null),
        ...(enroll && {
          third_party: thirdParty as IThirdPartyApp,
          booking_id: data?.booking_id ?? bookings,
        }),
        branch: data.branch as string | undefined,
      };
      // const res = await mutateAsync(payload);
      // if (res) {
      //   console.log(res);
      // }
      addCustomer(payload);
      if (!enroll) {
        methods.reset();
      }
    } catch (error) {
      console.log(error);
    }
  });

  const optionData = useCallback(() => {
    return data?.data?.map((item) => ({
      ...item,
      label: `${item.full_name} - ${item.phone}`,
    }));
  }, [data?.data]);

  return (
    <Card className="p-6  border-brand-100 w-full">
      <CardHeader className="p-0">
        <h3 className="text-3xl font-semibold">Customer Information</h3>
        <p className="text-sm text-gray-500">Enter Customer Information</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col gap-1">
          {/* <div className="max-w-fit">
            <GeneralTabComponent
              selecetedTab={tabCustomer}
              setTab={(e) => {
                setTabCustomer(e);
                methods.reset();
                addCustomer();
                if (tabCustomer === "new") {
                  setSelectedUser(null);
                }
              }}
              tabs={customerSectionTab}
            />
          </div> */}
          <div className="flex w-full pt-4">
            <FormProvider {...methods}>
              <form onSubmit={onSubmit} className="w-full">
                {enroll && (
                  <div className="flex flex-col gap-4 mb-4">
                    <FormField
                      control={control}
                      name="third_party_id"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className=" text-brand-999 font-medium text-sm" required>
                            Select Third Party App
                          </FormLabel>
                          <FormControl>
                            <RadioGroup
                              defaultValue="no"
                              value={field.value}
                              className="flex flex-row gap-3 items-center"
                              onValueChange={(e) => {
                                field.onChange(e);
                              }}
                            >
                              {thirdPartyApp?.data?.map((item) => (
                                <div className="flex items-center gap-3" key={item.id}>
                                  <RadioGroupItem value={item.id} id="third_party_id" onClick={() => setThirdParty(item)} />
                                  <Label htmlFor="r1" className="text-brand-999">
                                    {item.name}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2">
                      <div className="col-span-4">
                        <FormField
                          control={control}
                          name="booking_id"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm" required>
                                Booking ID
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
                      </div>
                    </div>
                  </div>
                )}

                {tabCustomer === "new" ? (
                  <>
                    <div className="grid grid-cols-12 gap-4 ">
                      <div className="col-span-4">
                        <FormField
                          control={control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm" required>
                                Name
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
                      </div>
                      <div className="col-span-4">
                        <FormField
                          control={control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm" required>
                                WhatsApp
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-brand-999 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                                  placeholder="Type here.."
                                  {...field}
                                // className="w-auto min-w-[388px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-4">
                        <FormField
                          control={control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className=" text-brand-999 font-medium text-sm">Email (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-brand-999 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                                  placeholder="Type here.."
                                  type="email"
                                  {...field}
                                // className="w-auto min-w-[388px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                      <div>
                        <Button type="button" variant={"secondary"} onClick={() => methods.reset()}>
                          Clear
                        </Button>
                      </div>
                      <div>
                        <Button type="submit">Add Customer</Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <Label className=" text-brand-999 font-medium text-sm">Select Member</Label>
                      <Select
                        options={optionData()}
                        value={selectedUser}
                        classNames={{
                          control: () =>
                            "w-full !border-2 !border-gray-200 rounded-lg text-gray-999  focus:outline-none focus:border-brand-500 transition-colors !rounded-md !bg-transparent shadow-xs h-[42px]",
                          placeholder: () => "placeholder-gray-400",
                          singleValue: () => "text-brand-999",
                          input: () => "text-brand-999 bg-none",
                        }}
                        isLoading={isLoading}
                        getOptionValue={(opt) => opt.id}
                        onInputChange={onSearch}
                        inputValue={search}
                        onChange={(e) => {
                          setSelectedUser(e);

                          if (enroll) {
                          } else {
                            methods.setValue("name", e?.full_name as string);
                            methods.setValue("email", e?.email as string);
                            methods.setValue("phone", e?.phone as string);
                            methods.setValue("id", e?.id as string);
                            addCustomer({
                              name: e?.full_name as string,
                              email: e?.email as string,
                              phone: e?.phone as string,
                              id: e?.id,
                              branch: methods.getValues("branch") as string | undefined,
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className=" text-brand-999 font-medium text-sm">Branch</Label>
                      <Select
                        options={SEHELA_BRANCH as unknown as { value: string; label: string }[]}
                        value={SEHELA_BRANCH.find((b) => b.value === methods.watch("branch")) ?? null}
                        classNames={{
                          control: () =>
                            "w-full !border-2 !border-gray-200 rounded-lg text-gray-999 focus:outline-none focus:border-brand-500 transition-colors !rounded-md !bg-transparent shadow-xs h-[42px]",
                          placeholder: () => "placeholder-gray-400",
                          singleValue: () => "text-brand-999",
                          input: () => "text-brand-999 bg-none",
                        }}
                        placeholder="Select branch..."
                        getOptionValue={(opt) => (opt as unknown as { value: string }).value}
                        getOptionLabel={(opt) => (opt as unknown as { label: string }).label}
                        onChange={(opt) => {
                          const v = (opt as unknown as { value: string } | null)?.value ?? "";
                          methods.setValue("branch", v);
                          // keep customerData in sync if member already chosen
                          const currentId = methods.getValues("id");
                          if (currentId) {
                            addCustomer({
                              name: methods.getValues("name") as string,
                              email: methods.getValues("email") as string,
                              phone: methods.getValues("phone") as string,
                              id: currentId as string,
                              branch: v || undefined,
                            });
                          }
                        }}
                      />
                    </div>
                    {enroll && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => {
                            addCustomer({
                              name: selectedUser?.full_name as string,
                              email: selectedUser?.email as string,
                              phone: selectedUser?.phone as string,
                              id: selectedUser?.id,
                              branch: methods.getValues("branch") as string | undefined,
                              third_party: thirdParty as IThirdPartyApp,
                              booking_id: bookings,
                            });
                          }}
                        >
                          Select Customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </FormProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
