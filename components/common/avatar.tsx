/** Initials for an avatar. No remote image, so nothing leaks to Google's CDN. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs" } as const;

/** Decorative: the person's name is always rendered as text next to it. */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={`flex flex-none items-center justify-center rounded-full bg-tile font-display ${SIZES[size]}`}
    >
      {initials(name)}
    </span>
  );
}
