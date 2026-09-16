import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Exclusive Barber Shop",
  description: "Reserva tu turno en Exclusive Barber Shop - Milagro, Ecuador",
  manifest: "/manifest.json",
  // iOS ignores the manifest's icons; the home-screen icon comes from here.
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Exclusive Barber",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
  // No maximumScale: the 16px inputs already stop iOS from zooming on focus,
  // so locking the scale would only take pinch-zoom away from the client.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes escribe la clase del tema en <html> antes de hidratar, así que
    // el atributo nunca coincide con el del servidor.
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", spaceGrotesk.variable, "font-sans", geist.variable)}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-space-grotesk), system-ui, sans-serif" }}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
