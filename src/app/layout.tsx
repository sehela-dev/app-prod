import type { Metadata } from "next";

import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";

import { PaymentMethodProvider } from "@/context/payment-method.ctx";
import { QueryProvider } from "@/layout/query-provide";

export const metadata: Metadata = {
  title: "Sehela App",
  description: "Sehela Booking App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <QueryProvider>
          <PaymentMethodProvider>
            {children}
            <Toaster />
          </PaymentMethodProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
