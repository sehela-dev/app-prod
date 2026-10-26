import { Construction } from "lucide-react";

export const ShopUnderDevelopmentView = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center font-serif text-brand-500 pb-28">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
        <Construction className="text-brand-400" size={24} />
      </div>
      <h1 className="text-2xl font-extrabold">Shop</h1>
      <p className="text-sm font-semibold">This page is under development</p>
      <p className="max-w-[260px] text-xs text-brand-400">
        We&apos;re working on it. Please check back soon!
      </p>
    </div>
  );
};
