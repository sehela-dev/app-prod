import { TNC_PARAGRAPHS } from "@/constants/nav-item";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions — Sehela Space",
  description: "Syarat dan Ketentuan keikutsertaan kegiatan di Sehela Space (PT Ruang Bugar Sehela)",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="flex flex-col w-full font-serif">
      <div className="bg-brand-500 px-4 py-8 text-gray-50">
        <h1 className="text-2xl font-extrabold leading-tight">Terms and Conditions</h1>
        <p className="mt-1 text-sm text-brand-50/90">Syarat dan Ketentuan Sehela Space — PT Ruang Bugar Sehela</p>
        {/* <p className="mt-1 text-xs text-brand-100">Last updated from TNC dialog • Scroll to read all 12 points</p> */}
      </div>

      <div className="px-4 py-6 flex flex-col gap-4">
        <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
          <p className="text-sm leading-relaxed text-brand-700">
            Dengan mengikuti kegiatan di Sehela Space, Anda menyetujui seluruh ketentuan di bawah ini. Jika Anda mendaftar untuk orang lain, pastikan
            mereka juga telah membaca dan menyetujuinya.
          </p>
        </div>

        <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed text-brand-900">
          {TNC_PARAGRAPHS?.map((paragraph: string) => (
            <li key={paragraph.slice(0, 48)} className="pl-1">
              {paragraph}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
