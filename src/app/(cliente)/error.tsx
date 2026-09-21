"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { pillClasses } from "@/components/monky/pill-link";
import { cn } from "@/lib/utils";

export default function ClienteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-card text-primary">
        <WifiOff className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="mt-6">
        <span className="block text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em]">Algo se</span>
        <span className="-mt-1 block font-script text-[2.75rem] leading-[1.15] text-primary">enredó</span>
      </h1>
      <p className="mt-3 max-w-[30ch] text-[0.9375rem] text-muted-foreground">
        No pudimos cargar la información. Revisa tu conexión e intenta otra vez.
      </p>
      <button type="button" onClick={() => retry()} className={cn(pillClasses, "mt-8 w-full")}>
        Reintentar
      </button>
      <Link href="/" className="mt-3 inline-flex min-h-11 items-center px-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
        Ir al inicio
      </Link>
    </main>
  );
}
