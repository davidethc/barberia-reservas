import Image from "next/image";
import Link from "next/link";
import { Clock, Gift, MapPin, MessageCircle, Star, ChevronRight } from "lucide-react";
import { getBookingData } from "@/app/actions/booking";
import { SiteHeader, Monogram } from "@/components/monky/site-header";
import { PillLink } from "@/components/monky/pill-link";
import { ServiceCard } from "@/components/monky/service-card";
import { BarberCard } from "@/components/monky/barber-card";
import { StickyCta } from "@/components/monky/sticky-cta";
import { SocialIcon } from "@/components/monky/social-icon";
import {
  BRAND_NAME,
  IMAGES,
  POLICY_LINKS,
  SOCIAL_LINKS,
  SOCIAL_PROOF,
  groupHours,
  mapsUrl,
  toWhatsAppNumber,
} from "@/lib/brand";
import { DEFAULT_LOYALTY_CYCLE, ordinalTurn } from "@/lib/loyalty";

export default async function HomePage() {
  const { services, barbers, business, hours } = await getBookingData();
  const featured = services.slice(0, 3);
  const loyaltyCycle = business.loyalty_cycle ?? DEFAULT_LOYALTY_CYCLE;
  const schedule = groupHours(hours);
  const whatsapp = business.phone
    ? `https://wa.me/${toWhatsAppNumber(business.phone)}?text=${encodeURIComponent(`Hola ${BRAND_NAME}, tengo una consulta.`)}`
    : null;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-[480px] flex-1 pb-8">
        <figure className="relative h-[min(50svh,465px)] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] min-[481px]:[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <Image
            src={IMAGES.hero.src}
            width={IMAGES.hero.width}
            height={IMAGES.hero.height}
            alt={IMAGES.hero.alt}
            priority
            sizes="(max-width: 480px) 100vw, 480px"
            className="mk-disc size-full object-cover object-top"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-background from-15% via-background/85 via-55% to-transparent" />
        </figure>

        <section aria-labelledby="titular" className="relative -mt-14 px-5">
          <h1 id="titular" className="mk-rise text-foreground" style={{ "--mk-delay": "120ms" } as React.CSSProperties}>
            <span className="block text-[clamp(2.125rem,9.5vw,2.625rem)] leading-[1.05] font-extrabold tracking-[-0.03em]">
              Tu estilo,
            </span>
            <span className="-mt-1 block font-script text-[clamp(2.75rem,13vw,3.5rem)] leading-[1.1] text-primary">
              en buenas manos.
            </span>
          </h1>
          <p
            className="mk-rise mt-2 max-w-[32ch] text-[0.9375rem] leading-relaxed text-muted-foreground"
            style={{ "--mk-delay": "200ms" } as React.CSSProperties}
          >
            Reserva tu cita en segundos y vive una experiencia única.
          </p>

          <div className="mk-rise mt-6" style={{ "--mk-delay": "280ms" } as React.CSSProperties}>
            <PillLink id="cta-principal" href="/reservar" className="w-full">
              Reservar cita
            </PillLink>
          </div>

          {business.loyalty_enabled ? (
            // A real promise in place of the made-up rating: the client learns about the
            // stamp card before booking.
            <p
              className="mk-rise mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
              style={{ "--mk-delay": "340ms" } as React.CSSProperties}
            >
              <Gift aria-hidden className="size-4 text-primary" strokeWidth={2} />
              <span>
                <strong className="font-bold text-foreground">
                  El {ordinalTurn(loyaltyCycle)} corte va por la casa
                </strong>
                <span aria-hidden> · </span>
                sin registro
              </span>
            </p>
          ) : (
            // MOCKUP: rating and client count are placeholders until real figures exist.
            <p
              className="mk-rise mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
              style={{ "--mk-delay": "340ms" } as React.CSSProperties}
            >
              <Star aria-hidden className="size-4 fill-primary text-primary" />
              <span>
                <strong className="font-bold text-foreground tabular-nums">{SOCIAL_PROOF.rating.toFixed(1)}</strong>
                <span aria-hidden> · </span>
                <span className="sr-only">de 5, </span>
                {SOCIAL_PROOF.clients} clientes atendidos
              </span>
            </p>
          )}
        </section>

        <section id="servicios" aria-labelledby="servicios-titulo" className="mt-14 scroll-mt-20 px-5">
          <div className="flex items-baseline justify-between">
            <h2 id="servicios-titulo" className="text-xl font-bold tracking-[-0.02em]">
              Nuestros servicios
            </h2>
            <Link
              href="/servicios"
              className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-sm font-semibold text-primary hover:underline hover:underline-offset-4"
            >
              Ver todos
              <ChevronRight aria-hidden className="size-4" strokeWidth={2.25} />
            </Link>
          </div>
          {featured.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {featured.map((s, i) => (
                <ServiceCard key={s.id} id={s.id} name={s.name} price={s.price} delay={i * 60} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-[20px] bg-card px-5 py-6 text-sm text-muted-foreground">
              Estamos actualizando nuestros servicios. Escríbenos por WhatsApp y te ayudamos.
            </p>
          )}
        </section>

        {barbers.length > 0 && (
          <section id="barberos" aria-labelledby="barberos-titulo" className="mt-14 scroll-mt-20">
            <h2 id="barberos-titulo" className="px-5 text-xl font-bold tracking-[-0.02em]">
              Nuestros barberos
            </h2>
            <ul className="mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
              {barbers.map((b, i) => (
                <BarberCard key={b.id} id={b.id} name={b.name} photoUrl={b.photo_url} delay={i * 60} />
              ))}
            </ul>
          </section>
        )}

        <section id="visitanos" aria-labelledby="visitanos-titulo" className="mt-14 scroll-mt-20 px-5">
          <h2 id="visitanos-titulo" className="text-xl font-bold tracking-[-0.02em]">
            Visítanos
          </h2>
          <ul className="mt-4 divide-y divide-border rounded-[20px] bg-card shadow-card">
            {schedule.length > 0 && (
              <li className="flex gap-4 px-5 py-4">
                <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
                <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {schedule.map((g) => (
                    <div key={g.days} className="contents">
                      <dt className="font-semibold">{g.days}</dt>
                      <dd className="text-right text-muted-foreground tabular-nums">{g.hours}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            )}
            {business.address && (
              <li>
                <a
                  href={mapsUrl(business.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center gap-4 px-5 py-4 text-sm transition-colors hover:text-primary"
                >
                  <MapPin aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="flex-1 font-semibold">{business.address}</span>
                  <span className="text-xs text-muted-foreground">Abrir mapa</span>
                  <span className="sr-only">(se abre en una pestaña nueva)</span>
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center gap-4 px-5 py-4 text-sm transition-colors hover:text-primary"
                >
                  <MessageCircle aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="flex-1 font-semibold">Escríbenos por WhatsApp</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{business.phone}</span>
                  <span className="sr-only">(se abre en una pestaña nueva)</span>
                </a>
              </li>
            )}
          </ul>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[480px] px-5 pt-4 pb-32 text-sm text-muted-foreground">
        <div className="flex items-center gap-3 border-t border-border pt-8">
          <Monogram />
          <span className="text-xs font-bold tracking-[0.28em] text-foreground">{BRAND_NAME}</span>
        </div>
        {/* MOCKUP: social profiles and policy pages are pending; null urls render as non-links. */}
        <ul className="mt-6 flex gap-2" aria-label="Redes sociales">
          {SOCIAL_LINKS.map((s) => (
            <li key={s.network}>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid size-11 place-items-center rounded-full bg-card text-foreground transition-colors hover:text-primary"
                >
                  <SocialIcon network={s.network} className="size-5" />
                </a>
              ) : (
                <span
                  role="img"
                  aria-label={`${s.label} (próximamente)`}
                  title="Próximamente"
                  className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground"
                >
                  <SocialIcon network={s.network} className="size-5" />
                </span>
              )}
            </li>
          ))}
        </ul>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          {POLICY_LINKS.map((p) =>
            p.url ? (
              <li key={p.label}>
                <a href={p.url} className="underline-offset-4 hover:underline">
                  {p.label}
                </a>
              </li>
            ) : (
              <li key={p.label}>{p.label}</li>
            )
          )}
        </ul>
        <p className="mt-6 text-xs">
          © {new Date().getFullYear()} {BRAND_NAME} · {business.address ?? "Ecuador"}
        </p>
      </footer>

      <StickyCta />
    </>
  );
}
