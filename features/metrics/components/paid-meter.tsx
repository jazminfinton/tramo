type PaidMeterProps = {
  /** Blocks marked as paid. */
  paid: number;
  /** Every block of the period. */
  total: number;
  /** What the numbers say, for screen readers: the bar alone doesn't. */
  label: string;
};

/**
 * How much of a period is paid: a progress bar over a track of its own hue, with
 * the numbers written next to it by the caller, so the bar never speaks alone.
 */
export function PaidMeter({ paid, total, label }: PaidMeterProps) {
  const share = total > 0 ? (paid / total) * 100 : 0;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={paid}
      className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-accent/20"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${share.toFixed(2)}%` }} />
    </div>
  );
}
