import { Scissors, Sparkles } from "lucide-react";

const STROKE = 1.75;

function Mustache(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 11.2c-1.6-2.4-4.6-3-6.6-1.4-.9.7-1.4 1.6-2.4 1.8.4 1.9 2.2 3.4 4.4 3.3 2.3-.1 3.7-1.6 4.6-3.7Z" />
      <path d="M12 11.2c1.6-2.4 4.6-3 6.6-1.4.9.7 1.4 1.6 2.4 1.8-.4 1.9-2.2 3.4-4.4 3.3-2.3-.1-3.7-1.6-4.6-3.7Z" />
    </svg>
  );
}

/** Picks an icon from the service name; the DB `icon` column holds emoji, which never ship as icons. */
export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const n = name.toLowerCase();
  const props = { className, "aria-hidden": true as const };

  if (n.includes("barba") && n.includes("corte"))
    return (
      <span aria-hidden className="relative inline-grid size-7 place-items-center">
        <Scissors strokeWidth={STROKE} className="absolute top-0 left-0 size-4" />
        <Mustache className="absolute right-0 bottom-0 size-5" />
      </span>
    );
  if (n.includes("barba") || n.includes("bigote") || n.includes("afeit")) return <Mustache {...props} />;
  if (n.includes("ceja") || n.includes("facial") || n.includes("mascar")) return <Sparkles strokeWidth={STROKE} {...props} />;
  return <Scissors strokeWidth={STROKE} {...props} />;
}
