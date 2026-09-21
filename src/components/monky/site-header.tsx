"use client";

import Link from "next/link";
import { useRef } from "react";
import { Menu, X } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

// MOCKUP: the "M" is a typeset stand-in until the official logo exists.
export function Monogram({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`${className} grid place-items-center rounded-full bg-primary font-script text-[1.35rem] leading-none text-primary-foreground`}
    >
      <span className="-mt-0.5 -ml-0.5">M</span>
    </span>
  );
}

const MENU_LINKS = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#barberos", label: "Barberos" },
  { href: "/#visitanos", label: "Horario y ubicación" },
  { href: "/reservar", label: "Mi reserva" },
];

export function SiteHeader() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <header className="sticky top-0 z-(--mk-z-header) bg-background/92 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-[480px] grid-cols-[44px_1fr_44px] items-center px-4">
        <span aria-hidden />
        <Link href="/" className="flex items-center justify-center gap-2.5 rounded-full py-1" aria-label={`${BRAND_NAME}, inicio`}>
          <Monogram className="size-8" />
          <span className="text-[0.8125rem] font-bold tracking-[0.28em] text-foreground">{BRAND_NAME}</span>
        </Link>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Abrir menú"
          aria-haspopup="dialog"
          className="grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-card active:scale-95"
        >
          <Menu className="size-6" strokeWidth={1.75} />
        </button>
      </div>

      {/* MOCKUP: open-menu state is not in the reference. */}
      <dialog
        ref={dialogRef}
        aria-label="Menú"
        onClick={(e) => e.target === e.currentTarget && close()}
        className="mk-sheet fixed inset-0 z-(--mk-z-sheet) m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-(--mk-ink)/70 backdrop:backdrop-blur-sm"
      >
        <nav className="ml-auto flex h-full w-[min(84vw,340px)] flex-col bg-card px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card">
          <div className="flex h-12 items-center justify-between">
            <Monogram />
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar menú"
              className="grid size-11 place-items-center rounded-full hover:bg-(--mk-slate)"
            >
              <X className="size-6" strokeWidth={1.75} />
            </button>
          </div>
          <ul className="mt-8 flex flex-col">
            {MENU_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex min-h-14 items-center border-b border-border text-lg font-semibold transition-colors hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/reservar"
            onClick={close}
            className="mt-auto flex min-h-14 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
          >
            Reservar cita
          </Link>
        </nav>
      </dialog>
    </header>
  );
}
