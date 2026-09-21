import { ChevronRight, Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { ServiceIcon } from "./service-icon";

export const serviceRowClasses =
  "group flex w-full items-center gap-4 rounded-[20px] bg-card p-4 text-left shadow-card transition-[transform,box-shadow] duration-200 ease-(--mk-ease-out) hover:-translate-y-0.5 active:scale-[0.98]";

/** Inner layout only, so the same row works as a Link (catalogue) or a button (wizard). */
export function ServiceRowContent({
  name,
  description,
  durationMinutes,
  price,
}: {
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
}) {
  return (
    <>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-background text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-aria-pressed:bg-primary group-aria-pressed:text-primary-foreground">
        <ServiceIcon name={name} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{name}</span>
          <span className="font-bold text-primary tabular-nums">{formatPrice(price)}</span>
        </span>
        {description && <span className="mt-1 block text-sm leading-snug text-muted-foreground">{description}</span>}
        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock aria-hidden className="size-3.5" strokeWidth={2} />
          {durationMinutes} min
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
    </>
  );
}
