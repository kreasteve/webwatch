'use strict';
// Erzeugt die Werbegrafiken für den Chrome Web Store aus dem offiziellen Logo.
//
// Aufruf:  node tools/make_promo_tiles.js [zielverzeichnis]
// Ergebnis: <ziel>/promo-440x280.png    kleine Kachel (Pflicht für Werbeplätze)
//           <ziel>/promo-1400x560.png   Marquee-Kachel (für Präsentationsplätze)
// Standard-Ziel: store/promo/
//
// Das Logo (assets/datenspur-logo.jpg) hat einen fast weißen Hintergrund. Damit
// es auf der Kachelfläche nicht als hellgraues Quadrat sitzt, wird es im
// Browser über ein Canvas freigestellt: Helligkeit → Transparenz, Strichfarbe
// bleibt die des Originals. Das Motiv wird anschließend auf seine Bounding-Box
// beschnitten, damit es optisch mittig sitzt und nicht am Rand klebt.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const LOGO = path.join(ROOT, 'assets', 'datenspur-logo.jpg');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'store', 'promo'));

// Farben aus dashboard.css, damit die Kacheln zur Oberfläche passen.
const INK = '#0b0b0b';
const INK2 = '#52514e';
const MUTED = '#898781';
const GOOD = '#0ca30c';
const WARN = '#fab219';
const CRIT = '#d03b3b';

const TAGLINE = 'Sichtbar machen, wo deine Daten landen';
const SUBLINE = 'Für jede Website: wer kontaktiert wird und was dabei übertragen wird — '
  + 'in verständlichem Deutsch. Alles bleibt lokal im Browser.';

// Freistellen im Browser: Helligkeit steuert die Deckkraft, die Strichfarbe des
// Originals bleibt erhalten. Danach auf das Motiv beschneiden.
const KEYING = `
  async function freistellen(dataUri) {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    const HELL = 225, DUNKEL = 110; // darüber ganz transparent, darunter ganz deckend
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let i = 0; i < p.length; i += 4) {
      const L = (p[i] + p[i + 1] + p[i + 2]) / 3;
      let a = (HELL - L) / (HELL - DUNKEL);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      p[i] = 80; p[i + 1] = 80; p[i + 2] = 80; // Strichfarbe des Logos
      p[i + 3] = Math.round(a * 255);
      if (a > 0.15) {
        const px = (i / 4) % c.width, py = Math.floor((i / 4) / c.width);
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    }
    g.putImageData(d, 0, 0);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
    return out.toDataURL('image/png');
  }
`;

const tile = (logoUri, breit) => {
  const W = breit ? 1400 : 440;
  const H = breit ? 560 : 280;
  const logo = breit ? 232 : 96;
  const titel = breit ? 104 : 44;
  const tag = breit ? 34 : 15; // Montserrat läuft breiter — knapper setzen, damit die Zeile hält
  return `<!doctype html><meta charset="utf-8"><style>
  html, body { margin:0; width:${W}px; height:${H}px; overflow:hidden; }
  body { font-family: Montserrat, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:
           radial-gradient(120% 150% at ${breit ? '18% 30%' : '50% 12%'},
             #ffffff 0%, #f7f7f4 55%, #efeeea 100%);
         display:flex; align-items:center; justify-content:center; }
  .inhalt { display:flex; align-items:center;
            ${breit ? 'gap:74px;' : 'flex-direction:column; gap:20px; text-align:center;'} }
  .logo { width:${logo}px; height:${logo}px; flex:none;
          filter: drop-shadow(0 ${breit ? 10 : 5}px ${breit ? 22 : 12}px rgba(20,20,18,.14)); }
  h1 { margin:0; font-size:${titel}px; font-weight:700; letter-spacing:-.015em;
       color:${INK}; line-height:1; }
  .tag { margin-top:${breit ? 20 : 9}px; font-size:${tag}px; color:${INK2};
         line-height:1.35; ${breit ? '' : 'white-space:nowrap;'} }
  .sub { margin-top:16px; font-size:21px; color:${MUTED}; line-height:1.5; max-width:640px; }
  .ampel { display:flex; align-items:center; gap:11px; margin-top:26px; }
  .ampel i { width:15px; height:15px; border-radius:50%; display:block; }
  .ampel span { font-size:17px; color:${MUTED}; margin-left:5px; }
</style>
<div class="inhalt">
  <img class="logo" src="${logoUri}" alt="">
  <div>
    <h1>Datenspur</h1>
    <div class="tag">${TAGLINE}</div>
    ${breit ? `<div class="sub">${SUBLINE}</div>
    <div class="ampel"><i style="background:${GOOD}"></i><i style="background:${WARN}"></i>
      <i style="background:${CRIT}"></i><span>Ampel-Bewertung für jede Seite</span></div>` : ''}
  </div>
</div>`;
};

(async () => {
  if (!fs.existsSync(LOGO)) throw new Error('assets/datenspur-logo.jpg fehlt');
  fs.mkdirSync(OUT, { recursive: true });
  const quelle = 'data:image/jpeg;base64,' + fs.readFileSync(LOGO).toString('base64');

  const browser = await chromium.launch({ headless: true });
  try {
    const vorbereiten = await browser.newPage();
    await vorbereiten.setContent('<meta charset="utf-8">');
    // Montserrat muss auf dem Rechner installiert sein. Ohne Prüfung fiele das
    // Layout still auf Helvetica zurück und die Kacheln sähen falsch aus.
    const hatFont = await vorbereiten.evaluate(() =>
      document.fonts.check('700 100px Montserrat') && document.fonts.check('400 100px Montserrat'));
    if (!hatFont) {
      throw new Error('Montserrat (Regular + Bold) ist nicht installiert — '
        + 'ohne die Schrift würden die Kacheln in Helvetica erzeugt. '
        + 'Kostenlos unter https://fonts.google.com/specimen/Montserrat (SIL Open Font License).');
    }
    const logoUri = await vorbereiten.evaluate(
      async ([src, code]) => { eval(code); return await freistellen(src); }, [quelle, KEYING]);
    await vorbereiten.close();

    for (const [name, breit] of [['promo-440x280.png', false], ['promo-1400x560.png', true]]) {
      const W = breit ? 1400 : 440;
      const H = breit ? 560 : 280;
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.setContent(tile(logoUri, breit));
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, name) });
      await page.close();
      console.log('  ✓', name, `${W}×${H}`);
    }
  } finally {
    await browser.close();
  }
  console.log('\nFertig. Kacheln in:', OUT);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(1); });
