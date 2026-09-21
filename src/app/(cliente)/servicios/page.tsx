import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getBookingData } from "@/app/actions/booking";
import { ServiceRowContent, serviceRowClasses } from "@/components/monky/service-row";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Servicios · ${BRAND_NAME}`,
};

export default async function ServiciosPage() {
  const { services } = await getBookingData();

  return (
    <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-16">
      <div className="sticky top-0 z-(--mk-z-header) -mx-5 flex h-16 items-center gap-2 bg-background/92 px-3 backdrop-blur-md">
        <Link href="/" aria-label="Volver al inicio" className="grid size-11 place-items-center rounded-full hover:bg-card">
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <span className="text-[0.8125rem] font-bold tracking-[0.28em]">{BRAND_NAME}</span>
      </div>

      <h1 className="mt-4 text-[2rem] leading-tight font-extrabold tracking-[-0.03em]">
        Nuestros <span className="font-script text-[2.75rem] font-normal tracking-normal text-primary">servicios</span>
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">Elige uno y te llevamos directo a reservar.</p>

      {services.length === 0 ? (
        <p className="mt-8 rounded-[20px] bg-card px-5 py-6 text-sm text-muted-foreground">
          Estamos actualizando nuestros servicios. Vuelve en un rato.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {services.map((s, i) => (
            <li key={s.id} className="mk-rise" style={{ "--mk-delay": `${i * 50}ms` } as React.CSSProperties}>
              <Link href={`/reservar?servicio=${s.id}`} className={serviceRowClasses}>
                <ServiceRowContent
                  name={s.name}
                  description={s.description}
                  durationMinutes={s.duration_minutes}
                  price={s.price}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
