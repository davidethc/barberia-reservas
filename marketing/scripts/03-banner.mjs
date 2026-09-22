/**
 * LinkedIn banner, 1200x627: headline on the left, three tilted phones (-6°, 0°, 6°)
 * on the right. Same brand tokens and phone frame as the posts.
 */
import fs from "node:fs";
import path from "node:path";
import { launch, fontCss } from "./lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = `${ROOT}/capturas-crudas`;
const OUT = `${ROOT}/banner-linkedin-1200x627.png`;

const SHOTS = ["08-wizard-horarios.png", "01-home-hero.png", "11-confirmacion.png"];
const TILTS = [-6, 0, 6];

const CSS = `
  ${fontCss()}
  :root { --slate:#383f48; --ink:#21242b; --mustard:#d1a14d; --cream:#ede6d2; --cream-muted:#bdb8aa; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; }

  .banner {
    position: relative;
    width: 600px; height: 313.5px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 268px 1fr;
    align-items: center;
    padding: 0 26px 0 34px;
    font-family: "Jakarta", system-ui, sans-serif;
    color: var(--cream);
    background:
      radial-gradient(60% 90% at 78% 55%, rgba(209,161,77,0.40) 0%, rgba(209,161,77,0.12) 45%, transparent 72%),
      linear-gradient(110deg, #262b32 0%, var(--slate) 55%, #434b55 100%);
  }
  .banner::after {
    content:""; position:absolute; inset:0; z-index:0;
    background-image: repeating-linear-gradient(115deg, rgba(237,230,210,0.022) 0 1px, transparent 1px 9px);
  }

  .texto { position: relative; z-index: 1; }
  .marca { display:flex; align-items:center; gap:7px; margin-bottom:16px; }
  .marca .mono {
    width:24px; height:24px; border-radius:999px; background:var(--mustard); color:var(--ink);
    display:grid; place-items:center; font-family:"Yellowtail",cursive; font-size:17px; font-weight:400; line-height:1;
  }
  .marca .mono span { margin:-2px 0 0 -1px; }
  .marca .nombre { font-size:9px; font-weight:700; letter-spacing:0.26em; }

  h1 { font-size:26px; line-height:1.04; letter-spacing:-0.03em; font-weight:800; }
  h1 .dos { display:block; margin-top:2px; font-family:"Yellowtail",cursive; font-weight:400; font-size:33px; line-height:1.15; letter-spacing:0; color:var(--mustard); }
  p { margin-top:11px; font-size:12px; line-height:1.4; color:var(--cream-muted); max-width:34ch; }
  .pill {
    display:inline-block; margin-top:18px; background:var(--mustard); color:var(--ink);
    font-size:10.5px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase;
    padding:7px 13px 6px; border-radius:999px;
  }

  .telefonos { position:relative; z-index:1; height:100%; }
  .telefono {
    position:absolute; top:50%;
    padding:5px; border-radius:30px;
    background: linear-gradient(155deg, #7b838d 0%, #171a1f 22%, #101216 62%, #6b7480 100%);
    box-shadow: 0 22px 48px -14px rgba(8,9,11,0.9), 0 0 0 1px rgba(237,230,210,0.14);
  }
  .pantalla { width:92px; border-radius:26px; overflow:hidden; background:var(--slate); }
  .barra .iconos { display:flex; align-items:center; gap:2.5px; }
  .barra {
    height:18px; display:flex; align-items:center; justify-content:space-between;
    padding:0 9px; font-size:7px; font-weight:700; color:var(--cream); background:var(--slate);
  }
  .isla { position:absolute; top:5px; left:50%; transform:translateX(-50%); width:34px; height:10px; background:#050506; border-radius:999px; z-index:2; }
  .pantalla img { display:block; width:100%; }
`;

const ICONOS = `
  <svg width="9" height="6" viewBox="0 0 15 10" fill="currentColor" aria-hidden="true">
    <rect x="0" y="6.5" width="2.5" height="3.5" rx="0.6"/><rect x="4" y="4.5" width="2.5" height="5.5" rx="0.6"/>
    <rect x="8" y="2.5" width="2.5" height="7.5" rx="0.6"/><rect x="12" y="0.5" width="2.5" height="9.5" rx="0.6"/>
  </svg>
  <svg width="8" height="6" viewBox="0 0 13 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
    <path d="M1 3.2a8 8 0 0 1 11 0"/><path d="M3.2 5.6a5 5 0 0 1 6.6 0"/><path d="M5.4 8a2 2 0 0 1 2.2 0"/>
  </svg>
  <svg width="12" height="6" viewBox="0 0 20 10" fill="none" aria-hidden="true">
    <rect x="0.6" y="0.6" width="16" height="8.8" rx="2.6" stroke="currentColor" stroke-opacity="0.55"/>
    <rect x="2.1" y="2.1" width="12" height="5.8" rx="1.6" fill="currentColor"/>
  </svg>
`;

const telefono = (shot, i) => {
  const left = [0, 82, 164][i];
  return `<div class="telefono" style="left:${left}px; transform:translateY(-50%) rotate(${TILTS[i]}deg); z-index:${i === 1 ? 3 : 2};">
    <div class="pantalla" data-shot="${shot}">
      <div class="isla"></div>
      <div class="barra"><span>9:41</span><span class="iconos">${ICONOS}</span></div>
      <img src="${shot}">
    </div>
  </div>`;
};

const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="banner" id="banner">
    <div class="texto">
      <div class="marca"><span class="mono"><span>M</span></span><span class="nombre">MONKY BARBER</span></div>
      <h1>Reservas de barbería<span class="dos">desde el celular</span></h1>
      <p>Servicios, barberos y horarios reales. El cliente reserva en segundos; la agenda se actualiza sola.</p>
      <span class="pill">Next.js 16 · React 19 · Supabase</span>
    </div>
    <div class="telefonos">${SHOTS.map(telefono).join("")}</div>
  </div>
</body></html>`;

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 600, height: 314 }, deviceScaleFactor: 2, locale: "es-EC" });
const page = await ctx.newPage();

await page.route("**/banner.html", (route) => route.fulfill({ contentType: "text/html", body: HTML }));
for (const shot of SHOTS) {
  await page.route(`**/${shot}`, (route) => route.fulfill({ contentType: "image/png", body: fs.readFileSync(`${RAW}/${shot}`) }));
}

page.on("requestfailed", (r) => console.error("  ✗ no cargó:", r.url(), r.failure()?.errorText));
await page.goto("http://post.local/banner.html", { waitUntil: "networkidle" });
const anchos = await page.$$eval(".pantalla img", (els) => els.map((e) => e.naturalWidth));
console.log("  anchos de captura:", anchos.join(", "));
await page.evaluate(() => document.fonts.ready);
// Each status bar picks up the colour at the top of its own capture.
await page.evaluate(() => {
  for (const pantalla of document.querySelectorAll(".pantalla")) {
    const img = pantalla.querySelector("img");
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const [r, gg, b] = g.getImageData(2, 2, 1, 1).data;
    pantalla.querySelector(".barra").style.background = `rgb(${r},${gg},${b})`;
  }
});
await page.waitForTimeout(600);
await page.locator("#banner").screenshot({ path: OUT });
await browser.close();
console.log("Banner →", OUT);
