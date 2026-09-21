const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SocialIcon({ network, className }: { network: "instagram" | "facebook" | "tiktok"; className?: string }) {
  if (network === "instagram")
    return (
      <svg {...base} className={className}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    );
  if (network === "facebook")
    return (
      <svg {...base} className={className}>
        <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3.5H9V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15Z" />
      </svg>
    );
  return (
    <svg {...base} className={className}>
      <path d="M13 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M13 3c.3 2.6 2.2 4.6 5 4.8" />
    </svg>
  );
}
