import type { Viewport } from "next";
import { Plus_Jakarta_Sans, Yellowtail } from "next/font/google";
import { cn } from "@/lib/utils";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const yellowtail = Yellowtail({
  subsets: ["latin"],
  variable: "--font-yellowtail",
  weight: "400",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#383f48",
};

export default function ClienteLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-theme="monky" className={cn(jakarta.variable, yellowtail.variable, "flex min-h-dvh flex-1 flex-col antialiased")}>
      {children}
    </div>
  );
}
