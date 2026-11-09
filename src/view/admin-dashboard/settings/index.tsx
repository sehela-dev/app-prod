"use client";

import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { PasswordInput } from "@/components/general/password-input";
import { PaymentMethodsCard } from "./payment-methods-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuthAdmin } from "@/context/admin/admin-context";
import { useAdminChangePassword } from "@/hooks/api/mutations/admin";
import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

const passwordInputClassName =
  "w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]";

interface IChangePasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const defaultValues: IChangePasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export const AdminSettingsPage = () => {
  const router = useRouter();
  const { logout } = useAuthAdmin();
  const { mutateAsync, isPending } = useAdminChangePassword();

  const [openReloginDialog, setOpenReloginDialog] = useState(false);

  const methods = useForm<IChangePasswordForm>({ defaultValues });

  const onSubmit = methods.handleSubmit(async (data) => {
    try {
      if (data.new_password !== data.confirm_password) {
        methods.setError("confirm_password", { message: "Passwords do not match" });
        return;
      }

      await mutateAsync({
        current_password: data.current_password,
        new_password: data.new_password,
      });

      methods.reset();
      setOpenReloginDialog(true);
    } catch (error) {
      console.log(error);
    }
  });

  const handleConfirmRelogin = () => {
    setOpenReloginDialog(false);
    logout();
    router.push("/admin-login");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-2xl font-semibold">Settings</h3>
        <p className="text-gray-400 text-sm">Manage your account security settings.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand-500" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <FormField
                control={methods.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-brand-999 font-medium text-sm" required>
                      Current Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput className={passwordInputClassName} placeholder="Current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={methods.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-brand-999 font-medium text-sm" required>
                      New Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput className={passwordInputClassName} placeholder="New password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={methods.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-brand-999 font-medium text-sm" required>
                      Confirm New Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput className={passwordInputClassName} placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isPending} className="min-w-[160px]">
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Password"}
                </Button>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>

      <PaymentMethodsCard />

      <BaseDialogConfirmation
        open={openReloginDialog}
        image="warning-1"
        title="Password updated successfully"
        subtitle="For your security, please sign in again. Your current session will be replaced after you log in."
        confirmText="Login again"
        hideCancel
        onCancel={() => {}}
        onConfirm={handleConfirmRelogin}
      />
    </div>
  );
};
