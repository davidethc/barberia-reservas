const bar = "animate-pulse rounded-full bg-card motion-reduce:animate-none";

export default function ReservarLoading() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-5" aria-busy="true">
      <span className="sr-only">Cargando la reserva…</span>
      <div className="flex h-16 items-center justify-between">
        <div className={`${bar} size-11`} />
        <div className={`${bar} h-4 w-36`} />
        <div className="size-11" />
      </div>
      <div className={`${bar} mt-2 h-8 w-40`} />
      <div className={`${bar} mt-3 h-11 w-52`} />
      <div className="mt-8 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[20px] bg-card motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
