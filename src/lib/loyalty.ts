/**
 * Stamp card: every completed turn is a stamp, and the one after `cycle - 1` paid turns is
 * on the house. The progress itself is derived in Postgres (`loyalty_progress`) from the
 * appointments, so nothing here counts — it only shapes what the SQL returns.
 */
export type LoyaltyProgress = {
  cycle: number;
  progress: number;
  eligible: boolean;
};

export type LoyaltySettings = {
  enabled: boolean;
  cycle: number;
};

/** Mirrors the column default and the `businesses_loyalty_cycle_check` bounds. */
export const DEFAULT_LOYALTY_CYCLE = 6;
export const MIN_LOYALTY_CYCLE = 2;
export const MAX_LOYALTY_CYCLE = 20;

/** Paid turns that earn the free one: with a cycle of 6, the client pays 5. */
export function paidTurnsPerReward(cycle: number): number {
  return cycle - 1;
}

const ORDINAL_SUFFIX: Record<number, string> = { 1: "ro", 2: "do", 3: "ro", 7: "mo", 8: "vo", 9: "no", 10: "mo" };

/** "6to", "10mo", "12vo"… the ordinal the copy uses for the free turn (cycle is 2–20). */
export function ordinalTurn(n: number): string {
  if (n > 10) return `${n}vo`;
  return `${n}${ORDINAL_SUFFIX[n] ?? "to"}`;
}

export function toLoyaltyProgress(row: unknown): LoyaltyProgress | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.cycle !== "number" || typeof r.progress !== "number" || typeof r.eligible !== "boolean") {
    return null;
  }
  return { cycle: r.cycle, progress: r.progress, eligible: r.eligible };
}
