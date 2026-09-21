"use client";

import { useEffect, useState } from "react";
import { PillLink } from "./pill-link";

/** Shows once the hero's own CTA (#cta-principal) has scrolled out of view. */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("cta-principal");
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => entry && setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-(--mk-z-sticky) bg-linear-to-t from-background via-background/85 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[opacity,transform] duration-250 ease-(--mk-ease-out) motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="mx-auto max-w-[448px]">
        <PillLink href="/reservar" className="pointer-events-auto w-full">
          Reservar cita
        </PillLink>
      </div>
    </div>
  );
}
