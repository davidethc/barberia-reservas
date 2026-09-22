/**
 * The printable poster: brand, "Escanea y reserva", the QR and the address written out for
 * whoever cannot scan. Drawn on a canvas instead of rendered from the DOM so the download
 * is one file at print resolution, with no dependency on how the admin looks on screen.
 *
 * The QR itself stays black on white however dark the poster is: a scanner needs that
 * contrast, and a mustard-on-slate code is the classic way to end up with one nobody's
 * camera reads.
 */

/** Poster colors, copied from the `--mk-*` tokens in globals.css (canvas takes no CSS vars). */
const INK = "#21242b";
const SLATE = "#383f48";
const MUSTARD = "#d1a14d";
const CREAM = "#ede6d2";

/** A5 at 300 dpi, portrait: prints sharp on half a sheet. */
const WIDTH = 1748;
const HEIGHT = 2480;

export type PosterCopy = {
  brand: string;
  headline: string;
  subhead: string;
  url: string;
  footer: string;
};

export const DEFAULT_POSTER_COPY: Omit<PosterCopy, "url"> = {
  brand: "MONKY BARBER",
  headline: "Escanea y reserva",
  subhead: "Elige servicio, barbero y hora desde tu celular. Sin cuentas ni llamadas.",
  footer: "O entra directo desde tu navegador:",
};

/** Pretty address for print: no scheme, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws the poster and hands back a PNG blob. `qrPng` is the plain black-on-white code,
 * already rendered by the caller (the qrcode library runs in the browser).
 */
export async function drawPoster(qrPng: HTMLImageElement, copy: PosterCopy): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo preparar el lienzo del cartel");

  ctx.fillStyle = SLATE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const center = WIDTH / 2;
  ctx.textAlign = "center";

  // Brand, spaced out like the site header.
  ctx.fillStyle = CREAM;
  ctx.font = "700 64px system-ui, sans-serif";
  ctx.letterSpacing = "18px";
  ctx.fillText(copy.brand, center, 230);
  ctx.letterSpacing = "0px";

  // Headline.
  ctx.fillStyle = MUSTARD;
  ctx.font = "800 132px system-ui, sans-serif";
  ctx.fillText(copy.headline, center, 430);

  // Subhead, wrapped.
  ctx.fillStyle = CREAM;
  ctx.font = "400 54px system-ui, sans-serif";
  const subheadLines = wrap(ctx, copy.subhead, WIDTH - 320);
  subheadLines.forEach((line, i) => ctx.fillText(line, center, 540 + i * 74));

  // The code on a white card: the contrast is what makes it scannable.
  const qrBox = 1000;
  const qrX = center - qrBox / 2;
  const qrY = 700 + subheadLines.length * 74;
  const pad = 56;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(qrX - pad, qrY - pad, qrBox + pad * 2, qrBox + pad * 2, 48);
  ctx.fill();
  ctx.drawImage(qrPng, qrX, qrY, qrBox, qrBox);

  // Address in plain text for anyone whose camera will not scan.
  const afterQr = qrY + qrBox + pad * 2 + 120;
  ctx.fillStyle = CREAM;
  ctx.font = "400 44px system-ui, sans-serif";
  ctx.fillText(copy.footer, center, afterQr);
  ctx.fillStyle = MUSTARD;
  ctx.font = "700 52px ui-monospace, monospace";
  ctx.fillText(displayUrl(copy.url), center, afterQr + 76);

  // Ink strip at the foot, so the poster reads as finished rather than cut off.
  ctx.fillStyle = INK;
  ctx.fillRect(0, HEIGHT - 120, WIDTH, 120);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar el cartel"))),
      "image/png"
    );
  });
}

/** Hands a blob to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
