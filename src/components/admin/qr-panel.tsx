"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_NAME } from "@/lib/brand";
import {
  DEFAULT_POSTER_COPY,
  downloadBlob,
  drawPoster,
  displayUrl,
} from "@/lib/qr-poster";

/** Black on white, generous margin: what a cheap phone camera reads on the first try. */
const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 2,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export function QrPanel() {
  // Resolved in the browser, so the code is right in production, in a preview and in local,
  // and keeps working the day the shop gets its own domain — nothing to edit here.
  const [url, setUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"qr" | "poster" | null>(null);

  useEffect(() => {
    const bookingUrl = new URL("/reservar", window.location.origin).toString();
    let cancelled = false;
    QRCode.toString(bookingUrl, { ...QR_OPTIONS, type: "svg", width: 320 })
      .then((code) => {
        if (cancelled) return;
        setUrl(bookingUrl);
        setSvg(code);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo generar el código QR");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace a mano.");
    }
  }

  async function handleDownloadQr() {
    if (!url) return;
    setBusy("qr");
    try {
      const dataUrl = await QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1200 });
      downloadBlob(await (await fetch(dataUrl)).blob(), "monky-qr-reservar.png");
    } catch {
      toast.error("No se pudo descargar el código");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadPoster() {
    if (!url) return;
    setBusy("poster");
    try {
      const dataUrl = await QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1000 });
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const poster = await drawPoster(image, {
        ...DEFAULT_POSTER_COPY,
        brand: BRAND_NAME,
        url,
      });
      downloadBlob(poster, "monky-cartel-qr.png");
    } catch {
      toast.error("No se pudo generar el cartel");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-slot="qr-panel" className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Código QR</h2>
      <p className="text-sm text-muted-foreground">
        Para pegar en el local. Quien lo escanea con la cámara entra directo a reservar, sin
        escribir la dirección ni crear ninguna cuenta.
      </p>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {svg ? (
              <div
                role="img"
                aria-label={`Código QR que abre ${displayUrl(url ?? "")}`}
                className="w-56 rounded-xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <Skeleton className="size-56 rounded-xl" />
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Lleva a</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2.5 text-sm">
                {url ? displayUrl(url) : "…"}
              </code>
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={!url}
                className="h-11 shrink-0 gap-1.5 sm:h-9"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleDownloadQr}
              disabled={!url || busy !== null}
              className="h-11 flex-1 gap-2 sm:h-9"
            >
              <Download className="size-4" />
              {busy === "qr" ? "Preparando…" : "Descargar QR (PNG)"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPoster}
              disabled={!url || busy !== null}
              className="h-11 flex-1 gap-2 sm:h-9"
            >
              <Printer className="size-4" />
              {busy === "poster" ? "Preparando…" : "Descargar cartel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p>
          El QR es el mismo siempre y no caduca: puedes imprimirlo una vez y dejarlo pegado
          en el espejo, la caja o la vitrina.
        </p>
        <p>
          El cartel sale en vertical, listo para media hoja. Antes de mandar a imprimir,
          escanéalo con tu propio celular para ver que abre la página de reservas.
        </p>
      </div>
    </div>
  );
}
