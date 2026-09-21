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
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Paso ${current} de ${total}: ${label}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < current - 1;
        const isCurrent = i === current - 1;
        return (
          <motion.span
            key={i}
            className={cn(
              "rounded-full",
              isDone && "bg-foreground",
              isCurrent && "bg-primary",
              !isDone && !isCurrent && "bg-border"
            )}
            animate={{
              width: isDone ? 20 : isCurrent ? 36 : 12,
              height: 5,
            }}
            transition={SPRING_SNAPPY}
          />
        );
      })}
    </div>
  );
}
