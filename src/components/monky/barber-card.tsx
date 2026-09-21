import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = { id: string; name: string; photoUrl: string | null; delay?: number };

export function BarberAvatar({ name, photoUrl, className = "size-20" }: { name: string; photoUrl: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={`${className} relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary`}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary hosts
        <img src={photoUrl} alt="" loading="lazy" width={80} height={80} className="size-full object-cover" />
      ) : (
        <span aria-hidden className="font-script text-[1.75rem] leading-none text-primary-foreground">
          {initials}
        </span>
      )}
    </span>
  );
}

export function BarberCard({ id, name, photoUrl, delay = 0 }: Props) {
  return (
    <li className="snap-start">
      <Link
        href={`/reservar?barbero=${id}`}
        aria-label={`Reservar con ${name}`}
        style={{ "--mk-delay": `${delay}ms` } as React.CSSProperties}
        className="mk-rise group flex w-32 flex-col items-center gap-3 rounded-[20px] bg-card px-3 pt-5 pb-4 shadow-card transition-transform duration-200 ease-(--mk-ease-out) hover:-translate-y-1 active:scale-[0.97]"
      >
        <BarberAvatar name={name} photoUrl={photoUrl} />
        <span className="text-[0.9375rem] font-semibold">{name}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Reservar
          <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
        </span>
      </Link>
    </li>
  );
}
