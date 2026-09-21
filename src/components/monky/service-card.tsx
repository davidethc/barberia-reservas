import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { ServiceIcon } from "./service-icon";

type Props = {
  id: string;
  name: string;
  price: number;
  delay?: number;
};

export function ServiceCard({ id, name, price, delay = 0 }: Props) {
  return (
    <Link
      href={`/reservar?servicio=${id}`}
      aria-label={`Reservar ${name}, ${formatPrice(price)}`}
      style={{ "--mk-delay": `${delay}ms` } as React.CSSProperties}
      className="mk-rise group flex min-h-36 flex-col items-center justify-between gap-3 rounded-[20px] bg-card px-2.5 pt-5 pb-4 text-center shadow-card transition-transform duration-200 ease-(--mk-ease-out) hover:-translate-y-1 active:scale-[0.97]"
    >
      <span className="grid size-12 place-items-center rounded-full bg-(--mk-slate) text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        <ServiceIcon name={name} className="size-6" />
      </span>
      <span className="text-[0.8125rem] leading-tight font-semibold text-balance text-foreground">{name}</span>
      <span className="text-base font-bold text-primary tabular-nums">{formatPrice(price)}</span>
    </Link>
  );
}
