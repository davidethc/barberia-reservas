export const SPRING_SNAPPY = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;
export const TAP_SCALE = 0.97;

export const stepVariants = {
  enter: (direction: 1 | -1) => ({ x: direction > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({ x: direction > 0 ? -24 : 24, opacity: 0 }),
};
