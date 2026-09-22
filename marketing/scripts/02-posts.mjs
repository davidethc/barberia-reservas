/**
 * Composes the vertical 1080x1350 (4:5) posts: one per feature, each a headline plus the
 * matching raw capture inside an iPhone frame. Rendered as HTML at 540x675 and shot at
 * deviceScaleFactor 2. Brand colors are the app's own --mk-* tokens (src/app/globals.css).
 */
import fs from "node:fs";
import path from "node:path";
import { launch, fontCss } from "./lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = `${ROOT}/capturas-crudas`;
const OUT = `${ROOT}/posts-1080x1350`;
fs.mkdirSync(OUT, { recursive: true });

export const POSTS = [
  {
    file: "01-reserva-en-segundos",
    shot: "01-home-hero.png",
    etiqueta: "Reservas online",
    titular: ["Tu barbería,", "abierta 24/7"],
    bajada: "Reservas sin llamadas ni WhatsApp.",
  },
  {
    file: "02-servicios-y-precios",
    shot: "05-servicios-lista.png",
    etiqueta: "Catálogo",
    titular: ["Precios claros,", "cero preguntas"],
    bajada: "Servicio, duración y precio, al día.",
  },
  {
    file: "03-elige-barbero",
    shot: "07-wizard-barbero.png",
    etiqueta: "Por barbero",
    titular: ["Cada barbero,", "su agenda"],
    bajada: "O el primero que esté libre.",
  },
  {
    file: "04-horarios-reales",
    shot: "08-wizard-horarios.png",
    etiqueta: "Disponibilidad real",
    titular: ["Solo las horas", "que están libres"],
    bajada: "Agenda en vivo, sin dobles reservas.",
  },
  {
    file: "05-resumen-antes-de-confirmar",
    shot: "10-wizard-resumen.png",
    etiqueta: "Un solo paso",
    titular: ["Todo a la vista", "antes de confirmar"],
    bajada: "Servicio, hora y total, de un vistazo.",
  },
  {
    file: "06-confirmacion-con-codigo",
    shot: "11-confirmacion.png",
    etiqueta: "Confirmación",
    titular: ["Cita lista,", "con su código"],
    bajada: "Se guarda en el teléfono del cliente.",
  },
];

const CSS = `
  ${fontCss()}

  :root {
    --slate: #383f48;
    --ink: #21242b;
    --mustard: #d1a14d;
    --cream: #ede6d2;
    --cream-muted: #bdb8aa;
    --rust: #ab6d35;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; }

  .post {
    position: relative;
    width: 540px;
    height: 675px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 30px 30px 0;
    font-family: "Jakarta", system-ui, sans-serif;
    color: var(--cream);
    background:
      radial-gradient(70% 46% at 50% 68%, rgba(209,161,77,0.5) 0%, rgba(209,161,77,0.17) 42%, transparent 72%),
      radial-gradient(90% 55% at 50% 4%, rgba(237,230,210,0.10) 0%, transparent 60%),
      linear-gradient(168deg, #454d57 0%, var(--slate) 42%, #262b32 100%);
  }
  /* Faint diagonal grain so the flat background does not band when compressed. */
  .post::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    background-image: repeating-linear-gradient(115deg, rgba(237,230,210,0.022) 0 1px, transparent 1px 9px);
    pointer-events: none;
  }

  .top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
  .pill {
    background: var(--mustard);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 7px 14px 6px;
    border-radius: 999px;
  }
  .marca { display: flex; align-items: center; gap: 7px; }
  .marca .mono {
    width: 26px; height: 26px; border-radius: 999px;
    background: var(--mustard); color: var(--ink);
    display: grid; place-items: center;
    font-family: "Yellowtail", cursive; font-size: 19px; font-weight: 400;
    line-height: 1;
  }
  .marca .mono span { margin: -2px 0 0 -1px; }
  .marca .nombre { font-size: 9.5px; font-weight: 700; letter-spacing: 0.26em; }

  h1 { position: relative; z-index: 1; margin-top: 20px; font-size: 38px; line-height: 1.02; letter-spacing: -0.03em; font-weight: 800; }
  h1 .dos { display: block; margin-top: 2px; font-family: "Yellowtail", cursive; font-weight: 400; font-size: 46px; line-height: 1.12; letter-spacing: 0; color: var(--mustard); }
  .bajada { position: relative; z-index: 1; margin-top: 11px; font-size: 15px; line-height: 1.3; color: var(--cream-muted); white-space: nowrap; }

  .telefono-wrap { position: relative; z-index: 1; flex: 1; display: flex; align-items: flex-start; justify-content: center; margin-top: 24px; }
  .telefono {
    position: relative;
    padding: 7px;
    border-radius: 44px;
    background: linear-gradient(155deg, #7b838d 0%, #171a1f 22%, #101216 62%, #6b7480 100%);
    box-shadow:
      0 30px 70px -16px rgba(8,9,11,0.9),
      0 0 0 1px rgba(237,230,210,0.14),
      0 1px 0 rgba(237,230,210,0.22) inset;
  }
  .pantalla {
    position: relative;
    width: 232px;
    border-radius: 38px;
    overflow: hidden;
    background: var(--slate);
  }
  /* A real status bar, painted in the colour sampled from the top of the capture, so the
     Dynamic Island never lands on top of the app's own header. */
  .barra {
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    font-size: 11px;
    font-weight: 700;
    color: var(--cream);
    background: var(--barra-bg, #383f48);
  }
  .barra .iconos { display: flex; align-items: center; gap: 4px; }
  .isla {
    position: absolute;
    top: 7px; left: 50%; transform: translateX(-50%);
    width: 66px; height: 19px;
    background: #050506;
    border-radius: 999px;
    z-index: 2;
  }
  .pantalla img { display: block; width: 100%; }
`;

const ICONOS = `
  <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor" aria-hidden="true">
    <rect x="0" y="6.5" width="2.5" height="3.5" rx="0.6"/>
    <rect x="4" y="4.5" width="2.5" height="5.5" rx="0.6"/>
    <rect x="8" y="2.5" width="2.5" height="7.5" rx="0.6"/>
    <rect x="12" y="0.5" width="2.5" height="9.5" rx="0.6"/>
  </svg>
  <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
    <path d="M1 3.2a8 8 0 0 1 11 0"/><path d="M3.2 5.6a5 5 0 0 1 6.6 0"/><path d="M5.4 8a2 2 0 0 1 2.2 0"/>
  </svg>
  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
    <rect x="0.6" y="0.6" width="16" height="8.8" rx="2.6" stroke="currentColor" stroke-opacity="0.55"/>
    <rect x="2.1" y="2.1" width="12" height="5.8" rx="1.6" fill="currentColor"/>
    <path d="M18.2 3.4v3.2a2 2 0 0 0 0-3.2Z" fill="currentColor" fill-opacity="0.6"/>
  </svg>
`;

function html(post) {
  const [uno, dos] = post.titular;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="post" id="post">
      <div class="top">
        <span class="pill">${post.etiqueta}</span>
        <span class="marca"><span class="mono"><span>M</span></span><span class="nombre">MONKY BARBER</span></span>
      </div>
      <h1>${uno}<span class="dos">${dos}</span></h1>
      <p class="bajada">${post.bajada}</p>
      <div class="telefono-wrap">
        <div class="telefono">
          <div class="pantalla">
            <div class="isla"></div>
            <div class="barra"><span>9:41</span><span class="iconos">${ICONOS}</span></div>
            <img id="captura" src="captura.png">
          </div>
        </div>
      </div>
    </div>
  </body></html>`;
}

/** Reads the capture's top-left pixel so the fake status bar continues the app header. */
const SAMPLE = () => {
  const img = document.getElementById("captura");
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d").drawImage(img, 0, 0);
  const [r, g, b] = c.getContext("2d").getImageData(2, 2, 1, 1).data;
  document.documentElement.style.setProperty("--barra-bg", `rgb(${r},${g},${b})`);
  return `rgb(${r},${g},${b})`;
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2, locale: "es-EC" });
const page = await ctx.newPage();

// Serve the page from the captures folder so <img src="captura.png"> resolves per post.
await page.route("**/post.html", (route, req) => {
  route.fulfill({ contentType: "text/html", body: pageHtml });
});
let pageHtml = "";
await page.route("**/captura.png", (route) => {
  route.fulfill({ contentType: "image/png", body: fs.readFileSync(`${RAW}/${current.shot}`) });
});

let current;
for (const post of POSTS) {
  current = post;
  pageHtml = html(post);
  await page.goto("http://post.local/post.html", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const bg = await page.evaluate(SAMPLE);
  await page.waitForTimeout(600);
  await page.locator("#post").screenshot({ path: `${OUT}/${post.file}.png` });
  console.log(`  ✓ ${post.file}  (barra ${bg})`);
}

await browser.close();
console.log("Posts →", OUT);
