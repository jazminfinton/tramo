import { workedMs, type Timed } from "@/features/time/worked";

// Where some blocks stand with their paid mark. Pure, so the server, the
// client and the tests agree.

type Markable = { endedAt: Date | null; paidAt: Date | null };

export type PaidStatus = "paid" | "partial" | "unpaid";

/**
 * How a set of blocks reads, a day's for instance: all paid, none, or some.
 * Only finished blocks count, since an open one can't be marked yet. With no
 * finished block there's nothing to say, and nothing to mark.
 */
export function paidStatus(entries: Markable[]): PaidStatus | null {
  const finished = entries.filter((entry) => entry.endedAt !== null);
  if (finished.length === 0) return null;

  const paid = finished.filter((entry) => entry.paidAt !== null).length;
  if (paid === finished.length) return "paid";
  return paid === 0 ? "unpaid" : "partial";
}

/**
 * The minutes worked that nobody has paid for yet. A block still running counts
 * up to `now`, so this and the paid hours add up to the total a view shows.
 */
export function unpaidMinutes(entries: (Timed & { paidAt: Date | null })[], now: Date): number {
  return entries.reduce((sum, entry) => (entry.paidAt ? sum : sum + workedMs(entry, now) / 60_000), 0);
}
