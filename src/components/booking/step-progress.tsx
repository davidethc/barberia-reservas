"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion";

/**
 * Keeps the header's hairline rule as the progress affordance: the completed
 * steps are full-width strokes, the pending ones short ticks.
 */
export function StepProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div
      className="mt-4 flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Paso ${current} de ${total}: ${label}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <motion.span
          key={i}
          className={cn(
            "h-0.5 rounded-full",
            i < current ? "bg-foreground" : "bg-muted-foreground/40"
          )}
          animate={{ width: i < current ? 36 : 16 }}
          transition={SPRING_SNAPPY}
        />
      ))}
    </div>
  );
}
