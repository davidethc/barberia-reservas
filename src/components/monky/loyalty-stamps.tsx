"use client";

import { motion } from "motion/react";
import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion";
import { ordinalTurn, paidTurnsPerReward, type LoyaltyProgress } from "@/lib/loyalty";

/**
 * The stamp card as a strip: one dot per paid turn and a gift for the free one. Same
 * mechanics as StepProgress (progressbar semantics, SPRING_SNAPPY) so the wizard keeps a
 * single visual language. Announcing it is the caller's job: a live region only speaks
 * about changes, so it has to be mounted before the card arrives.
 *
 * `moment` changes only the copy: while typing the phone the booking does not exist yet;
 * on the confirmation it exists but is still pending, so it has not added a stamp — the
 * copy says what *this* cut will do.
 */
export function LoyaltyStamps({
  card,
  moment,
  className,
}: {
  card: LoyaltyProgress;
  moment: "details" | "confirmation";
  className?: string;
}) {
  const needed = paidTurnsPerReward(card.cycle);
  const filled = card.eligible ? needed : Math.min(card.progress, needed);
  const freeTurn = ordinalTurn(card.cycle);

  return (
    <div
      data-slot="loyalty-stamps"
      className={cn(
        "rounded-[20px] bg-card px-5 py-4 shadow-card",
        card.eligible && "ring-1 ring-primary/60",
        className
      )}
    >
      <div
        className="flex items-center gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={filled}
        aria-label={`Tarjeta de sellos: ${filled} de ${needed}`}
      >
        {Array.from({ length: needed }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className={cn(
              "size-3 rounded-full border",
              // Empty dots at 3:1 against ink; the sentence below carries the count anyway.
              i < filled ? "border-primary bg-primary" : "border-muted-foreground/70 bg-transparent"
            )}
            initial={false}
            animate={{ scale: i < filled ? 1 : 0.85 }}
            transition={{ ...SPRING_SNAPPY, delay: i * 0.04 }}
          />
        ))}
        <motion.span
          aria-hidden
          className={cn(
            "ml-1 grid size-7 place-items-center rounded-full border",
            card.eligible
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground"
          )}
          initial={false}
          animate={{ scale: card.eligible ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Gift className="size-3.5" strokeWidth={2} />
        </motion.span>
      </div>

      <p className="mt-3 text-sm leading-snug">
        {copyFor(card, needed, freeTurn, moment)}
      </p>
    </div>
  );
}

function copyFor(
  card: LoyaltyProgress,
  needed: number,
  freeTurn: string,
  moment: "details" | "confirmation"
) {
  if (card.eligible) {
    return (
      <>
        <strong className="font-bold text-primary">Este corte va por la casa.</strong>{" "}
        <span className="text-muted-foreground">Recuérdaselo a tu barbero al llegar.</span>
      </>
    );
  }

  const left = needed - card.progress;

  if (moment === "confirmation") {
    const after = card.progress + 1;
    return after >= needed ? (
      <>
        <strong className="font-bold">Con este corte completas tu tarjeta.</strong>{" "}
        <span className="text-muted-foreground">El próximo va por la casa.</span>
      </>
    ) : (
      <>
        <strong className="font-bold tabular-nums">
          Con este corte llevarás {after} de {needed} sellos.
        </strong>{" "}
        <span className="text-muted-foreground">El {freeTurn} va por la casa.</span>
      </>
    );
  }

  if (card.progress === 0) {
    return (
      <>
        <strong className="font-bold">Este corte suma tu primer sello.</strong>{" "}
        <span className="text-muted-foreground">El {freeTurn} va por la casa.</span>
      </>
    );
  }

  return (
    <>
      <strong className="font-bold tabular-nums">
        Llevas {card.progress} de {needed} sellos.
      </strong>{" "}
      <span className="text-muted-foreground">
        {left === 1 ? "Te falta 1 para el corte gratis." : `Te faltan ${left} para el corte gratis.`}
      </span>
    </>
  );
}
