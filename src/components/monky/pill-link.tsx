import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const pillClasses = cn(
  "group inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full px-7",
  "bg-primary text-primary-foreground text-[1.0625rem] font-bold tracking-[-0.01em]",
  "shadow-cta transition-[transform,background-color,box-shadow] duration-200 ease-(--mk-ease-out)",
  "hover:bg-(--mk-mustard-hover) active:scale-[0.97] active:shadow-none",
  "aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:shadow-none",
  "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none"
);

export function PillLink({
  href,
  children,
  className,
  ...rest
}: React.ComponentProps<typeof Link> & { children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(pillClasses, className)} {...rest}>
      {children}
      <ArrowRight
        aria-hidden
        className="size-5 transition-transform duration-200 ease-(--mk-ease-out) group-hover:translate-x-1"
        strokeWidth={2.25}
      />
    </Link>
  );
}
