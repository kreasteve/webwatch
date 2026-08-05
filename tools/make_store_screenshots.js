'use strict';
// Erzeugt die Store-Screenshots für Chrome Web Store / AMO / Edge.
//
// Aufruf:  node tools/make_store_screenshots.js [zielverzeichnis]
// Ergebnis: <ziel>/*.png       1280×800 — das von Chrome verlangte Format
//           <ziel>/2x/*.png    2560×1600 — Master, u. a. für AMO und Website
//
// Vorgehen: Ein lokaler HTTPS-Server spielt sowohl die Demo-Nachrichtenseite
// als auch sämtliche Drittanbieter. Per --host-resolver-rules zeigt *.example
// auf diesen Server; .example ist nach RFC 2606 für Beispiele reserviert und
// kann von niemandem registriert werden. Es verlässt also keine einzige
// Anfrage den Rechner, und im Bild steht kein realer Anbieter.
//
// Warum keine echten Namen: Ein Store-Bild bleibt jahrelang stehen. Eine reale
// Firma dort dauerhaft mit „Risiko: hoch" zu zeigen, lässt sich weder pflegen
// noch über KORREKTUREN.md korrigieren. Die erfundenen Domains sagen statt-
// dessen selbst, worum es geht (anzeigen-auktion.example, profil-daten.example).
//
// Zwei Anpassungen bekommt die Wegwerf-Kopie des Builds, dist/ bleibt unberührt:
//   1. trackerdb.js erhält die Demo-Anbieter, damit das Dashboard sie wie echte
//      Einträge einordnet (Firma, Kategorie, Erklärtext).
//   2. popup.js akzeptiert ?tab=<id>, damit das Popup im Bild den Artikel-Tab
//      zeigt und nicht den Tab, in dem es gerade gerendert wird.

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const EXT_SRC = path.join(ROOT, 'dist', 'chrome');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'store', 'screenshots'));
const OUT2X = path.join(OUT, '2x');
const HOST = 'demo-nachrichten.example';
const PORT = 8443;
const W = 1280;
const H = 800;

// ── Demo-Anbieter ───────────────────────────────────────────────────────────
// Frei erfunden. Die Texte beschreiben das jeweilige Geschäftsmodell so, wie
// die echten Kategorie-Texte es tun — nur ohne eine reale Firma zu benennen.
const DEMO_ENTITIES = [
  ['demo-tag', 'Tag-Verwaltung', 'Beispiel-Tagdienste', 'tagmanager', 'tag-verwaltung.example',
    'Lädt und steuert weitere Tracking-Skripte nach. Die Anfragen direkt danach zeigen, was dieser Dienst gestartet hat.'],
  ['demo-cmp', 'Cookie-Banner', 'Beispiel-Consent', 'cmp', 'cookie-banner.example',
    'Verwaltet das Einwilligungs-Banner und gibt die Entscheidung an alle eingebundenen Dienste weiter.'],
  ['demo-analytics', 'Reichweiten-Messung', 'Beispiel-Analytik', 'analytics', 'reichweiten-messung.example',
    'Misst, wie viele Menschen die Seite besuchen, woher sie kommen und was sie anklicken.'],
  ['demo-session', 'Sitzungs-Aufzeichnung', 'Beispiel-Analytik', 'session', 'sitzung-aufzeichnung.example',
    'Zeichnet Mausbewegungen, Klicks und Scrollen auf und erstellt daraus Heatmaps und abspielbare Sitzungen.'],
  ['demo-adexchange', 'Anzeigen-Auktion', 'Beispiel-Werbebörse', 'advertising', 'anzeigen-auktion.example',
    'Versteigert den Werbeplatz in Millisekunden. Dabei gehen Daten über den Besuch an viele Bieter gleichzeitig.'],
  ['demo-adnetwork', 'Werbe-Netzwerk', 'Beispiel-Media', 'advertising', 'werbe-netzwerk.example',
    'Liefert Anzeigen aus und verfolgt dabei, welche Seiten dieselbe Person über viele Websites hinweg besucht.'],
  ['demo-datahub', 'Profil-Daten', 'Beispiel-Datenkontor', 'audience', 'profil-daten.example',
    'Sammelt Merkmale zu einer Kennung und reichert daraus Profile an, die an Werbetreibende verkauft werden.'],
  ['demo-idsync', 'ID-Abgleich', 'Beispiel-Datenkontor', 'audience', 'id-abgleich.example',
    'Gleicht Kennungen zwischen Werbefirmen ab, damit getrennt gesammelte Profile derselben Person zusammenfinden.'],
  ['demo-social', 'Soziales Netzwerk', 'Beispiel-Social', 'social', 'soziales-netzwerk.example',
    'Meldet Seitenbesuche an ein soziales Netzwerk — auch bei Menschen, die dort gar kein Konto haben.'],
  ['demo-fonts', 'Schrift-Quelle', 'Beispiel-CDN', 'cdn', 'schrift-quelle.example',
    'Liefert Schriftarten aus. Schon der Abruf übermittelt IP-Adresse und besuchte Seite.'],
  ['demo-cdn', 'Bild-Auslieferung', 'Beispiel-CDN', 'cdn', 'bild-auslieferung.example',
    'Liefert Bilder und Skripte aus — sieht dabei aber IP-Adresse und besuchte Seite.'],
  ['demo-mailing', 'Newsletter-Versand', 'Beispiel-Mailing', 'marketing', 'newsletter-versand.example',
    'Verknüpft das Surfverhalten mit einer E-Mail-Adresse, um Werbemails auf den Besuch abzustimmen.'],
];

// ── Demo-Seite ──────────────────────────────────────────────────────────────
const CID = '1847263.1754301122';
const UID = 'a7d93f5081cb2e4a6d70f381';
const EMAIL_HASH = 'b6f4c1e2a7d93f5081cb2e4a6d70f3819ac52b6e0d4f7a19c3b85e2d6f014a7c';

// Bewusst knapp gehalten: Ein Store-Bild soll auf einen Blick lesbar sein,
// nicht jede Zeile füllen. Rund ein Dutzend Gegenstellen genügt dafür.
const THIRD_PARTY = `
  S('https://tag-verwaltung.example/tm.js?id=TM-4711');
  S('https://cookie-banner.example/cmp/loader.js');

  I('https://reichweiten-messung.example/collect?v=2&cid=${CID}&sr=1920x1080'
    + '&ul=de-de&dl=' + DL + '&dt=' + encodeURIComponent(document.title));
  S('https://sitzung-aufzeichnung.example/rec/9912.js?sv=6');

  I('https://anzeigen-auktion.example/gebot?uid=${UID}&colordepth=24&timezone=-120'
    + '&platform=MacIntel&hardwareconcurrency=10&devicememory=8&lat=52.520008&lon=13.404954');
  S('https://werbe-netzwerk.example/ads.js?slot=leaderboard');
  I('https://werbe-netzwerk.example/pixel?uid=${UID}&ref=' + DL);

  I('https://profil-daten.example/id?uid=${UID}&em=${EMAIL_HASH}');
  I('https://id-abgleich.example/usersync?partner_uid=${UID}&gdpr=1');

  I('https://soziales-netzwerk.example/tr?id=4711&ev=PageView&uid=${UID}&dl=' + DL);
  I('https://newsletter-versand.example/track/open?uid=${UID}');
  S('https://bild-auslieferung.example/js/lazy.js');

  if (navigator.sendBeacon) {
    navigator.sendBeacon('https://reichweiten-messung.example/collect?v=2&cid=${CID}',
      'en=scroll&epn.percent_scrolled=90');
  }
`;

const PAGE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<title>Mieten steigen langsamer — was hinter den neuen Zahlen steckt | Demo-Nachrichten</title>
<link rel="stylesheet" href="https://schrift-quelle.example/css/schriften.css">
<style>
  :root { --ink:#14161a; --mut:#5b6472; --line:#e3e6ea; --akzent:#a4212b; }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.6 -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--ink); background:#fff; }
  header { border-bottom:2px solid var(--ink); }
  .bar { max-width:1080px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; gap:26px; }
  .logo { font:800 25px/1 Georgia, serif; letter-spacing:-.5px; }
  .logo span { color:var(--akzent); }
  nav { display:flex; gap:20px; font-size:14px; color:var(--mut); }
  .leader { max-width:1080px; margin:16px auto 0; padding:0 24px; }
  .ad { border:1px dashed var(--line); color:#aeb4bd; font-size:11px; letter-spacing:.14em;
        text-transform:uppercase; display:flex; align-items:center; justify-content:center; background:#fafbfc; }
  .ad.leader-slot { height:92px; }
  .wrap { max-width:1080px; margin:0 auto; padding:26px 24px 60px; display:grid;
          grid-template-columns:1fr 300px; gap:40px; }
  .kicker { color:var(--akzent); font-weight:700; font-size:13px; letter-spacing:.1em; text-transform:uppercase; }
  h1 { font:700 39px/1.18 Georgia, serif; margin:8px 0 14px; letter-spacing:-.4px; }
  .lead { font-size:20px; line-height:1.5; color:#2b3038; margin:0 0 18px; }
  .meta { color:var(--mut); font-size:13px; border-top:1px solid var(--line);
          border-bottom:1px solid var(--line); padding:10px 0; margin-bottom:22px; }
  p.body { margin:0 0 16px; }
  .ad.rect { height:250px; margin-bottom:22px; }
  aside h3 { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:var(--mut);
             border-bottom:2px solid var(--ink); padding-bottom:7px; margin:0 0 12px; }
  aside li { list-style:none; padding:9px 0; border-bottom:1px solid var(--line); font-size:14px; }
  aside ul { margin:0; padding:0; }
  .banner { position:fixed; left:0; right:0; bottom:0; background:#fff; border-top:1px solid var(--line);
            box-shadow:0 -6px 24px rgba(0,0,0,.09); padding:14px 24px; display:flex; gap:16px;
            align-items:center; justify-content:center; font-size:13px; color:var(--mut); }
  .banner b { color:var(--ink); }
  .banner button { font:inherit; padding:8px 16px; border-radius:6px; border:1px solid var(--line);
                   background:#fff; cursor:pointer; }
  .banner button.ok { background:var(--akzent); border-color:var(--akzent); color:#fff; font-weight:600; }
</style></head>
<body>
<header>
  <div class="bar">
    <div class="logo">Demo<span>·</span>Nachrichten</div>
    <nav><span>Politik</span><span>Wirtschaft</span><span>Panorama</span><span>Sport</span><span>Kultur</span></nav>
  </div>
</header>
<div class="leader"><div class="ad leader-slot">Anzeige</div></div>
<div class="wrap">
  <article>
    <div class="kicker">Wohnungsmarkt</div>
    <h1>Mieten steigen langsamer — was hinter den neuen Zahlen steckt</h1>
    <p class="lead">Zum ersten Mal seit sieben Quartalen wachsen die Angebotsmieten in den großen
      Städten schwächer als die Löhne. Fachleute warnen davor, darin schon eine Wende zu sehen.</p>
    <div class="meta">Von der Demo-Redaktion · Veröffentlicht am 4. August · Lesezeit 6 Minuten</div>
    <p class="body">Die Zahlen, die das Institut am Dienstag vorgelegt hat, lesen sich zunächst
      beruhigend: Um 2,4 Prozent legten die Angebotsmieten im zweiten Quartal zu — nach 4,1 Prozent
      im Vorjahreszeitraum. In vier der sieben untersuchten Großstädte fiel der Anstieg sogar
      geringer aus als die Inflationsrate.</p>
    <div class="ad rect">Anzeige</div>
    <p class="body">Wer genauer hinsieht, findet allerdings einen Sondereffekt. Ein erheblicher Teil
      der neu inserierten Wohnungen liegt in Randlagen, in denen das Preisniveau ohnehin niedriger
      ist. Rechnet man diese Angebote heraus, bleibt vom gebremsten Anstieg wenig übrig.</p>
    <p class="body">„Der Markt entspannt sich nicht, er verschiebt sich", sagt eine Stadtforscherin,
      die die Erhebung seit Jahren begleitet. Entscheidend sei, wie viele Wohnungen tatsächlich neu
      entstehen — und dort zeigten die Genehmigungszahlen weiter nach unten.</p>
  </article>
  <aside>
    <div class="ad rect">Anzeige</div>
    <h3>Meistgelesen</h3>
    <ul>
      <li>Warum die Bauzinsen wieder sinken</li>
      <li>Neue Regeln für Kurzzeitvermietung</li>
      <li>Wo Wohnen noch bezahlbar ist</li>
      <li>Der lange Weg zur Baugenehmigung</li>
    </ul>
  </aside>
</div>
<div class="banner">
  <span><b>Wir schätzen Ihre Privatsphäre.</b> Wir und 847 Partner verarbeiten Daten für
    personalisierte Werbung und Inhalte.</span>
  <button>Einstellungen</button><button class="ok">Alle akzeptieren</button>
</div>
<script>
  var DL = encodeURIComponent(location.href);
  function I(u) { var i = new Image(); i.referrerPolicy = 'unsafe-url'; i.src = u; }
  function S(u) { var s = document.createElement('script'); s.src = u; s.async = true;
                  s.onerror = function () {}; document.head.appendChild(s); }
${THIRD_PARTY}
</script>
</body></html>`;

// ── Server: spielt Verlag und sämtliche Drittanbieter ───────────────────────
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function handle(req, res) {
  const host = (req.headers.host || '').split(':')[0];
  const url = req.url || '/';
  if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }

  if (host === HOST) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  // Cookies setzen nur die Dienste, die es auch in echt tun — Werbung,
  // Datenplattformen, Messung. Auslieferungs-Netze kommen ohne aus.
  const setztCookie = /^(anzeigen-auktion|werbe-netzwerk|profil-daten|id-abgleich|soziales-netzwerk|sitzung-aufzeichnung|reichweiten-messung)\./.test(host);
  const head = setztCookie
    ? { 'Set-Cookie': `sid=${UID}; Max-Age=15552000; Path=/; SameSite=None; Secure` }
    : {};
  if (url.endsWith('.css')) {
    res.writeHead(200, { ...head, 'Content-Type': 'text/css' });
    res.end('/* Demo-Schriften */');
  } else if (/\.js(\?|$)/.test(url)) {
    res.writeHead(200, { ...head, 'Content-Type': 'application/javascript' });
    res.end('/* Demo-Skript */');
  } else {
    res.writeHead(200, { ...head, 'Content-Type': 'image/gif' });
    res.end(GIF);
  }
}

// ── Wegwerf-Build ───────────────────────────────────────────────────────────
function makeShotBuild(tmp) {
  const dir = path.join(tmp, 'ext');
  fs.cpSync(EXT_SRC, dir, { recursive: true });

  // 1. Demo-Anbieter in die Tracker-DB einhängen (vor dem Aufbau des Index).
  const dbFile = path.join(dir, 'common', 'trackerdb.js');
  const db = fs.readFileSync(dbFile, 'utf8');
  const dbAnchor = '  // Pfad-Hinweise für Domains';
  if (!db.includes(dbAnchor)) throw new Error('trackerdb.js hat sich geändert — Screenshot-Patch anpassen');
  const push = DEMO_ENTITIES.map(([id, name, owner, cat, dom, info]) =>
    `    { id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)}, owner: ${JSON.stringify(owner)},`
    + ` cat: ${JSON.stringify(cat)}, dom: [${JSON.stringify(dom)}], info: ${JSON.stringify(info)} },`).join('\n');
  fs.writeFileSync(dbFile, db.replace(dbAnchor,
    `  // Nur im Screenshot-Build: erfundene Anbieter für die Demo-Seite.\n`
    + `  WW.TRACKER_ENTITIES.push(\n${push}\n  );\n\n${dbAnchor}`));

  // 2. Popup soll den Artikel-Tab zeigen können.
  const popFile = path.join(dir, 'popup', 'popup.js');
  const pop = fs.readFileSync(popFile, 'utf8');
  const needle = `    const tabs = await B.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) return;
    tabId = tabs[0].id;`;
  if (!pop.includes(needle)) throw new Error('popup.js hat sich geändert — Screenshot-Patch anpassen');
  fs.writeFileSync(popFile, pop.replace(needle, `    const forced = new URLSearchParams(location.search).get('tab');
    if (forced) { tabId = Number(forced); } else {
      const tabs = await B.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) return;
      tabId = tabs[0].id;
    }`));
  return dir;
}

function makeCert(dir) {
  const key = path.join(dir, 'demo.key');
  const crt = path.join(dir, 'demo.crt');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', crt, '-days', '2', '-subj', `/CN=${HOST}`,
    '-addext', `subjectAltName=DNS:${HOST},DNS:*.example`], { stdio: 'ignore' });
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

const dataUri = (buf) => 'data:image/png;base64,' + buf.toString('base64');

(async () => {
  if (!fs.existsSync(path.join(EXT_SRC, 'manifest.json'))) {
    throw new Error('dist/chrome fehlt — bitte zuerst ./build.sh ausführen');
  }
  fs.mkdirSync(OUT2X, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'datenspur-shots-'));

  let server;
  let scheme = 'https';
  try {
    server = https.createServer(makeCert(tmp), handle).listen(PORT);
  } catch (e) {
    console.warn('openssl nicht verfügbar — weiche auf http aus:', e.message);
    scheme = 'http';
    server = http.createServer(handle).listen(PORT);
  }

  const ext = makeShotBuild(tmp);
  const launchOpts = {
    headless: true,
    channel: 'chromium',
    viewport: { width: W, height: H },
    deviceScaleFactor: 2, // Master in 2560×1600, damit die Schrift scharf bleibt
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      `--host-resolver-rules=MAP *.example 127.0.0.1:${PORT}`,
      '--ignore-certificate-errors',
      `--window-size=${W},${H}`,
    ],
  };

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), launchOpts);
  } catch (e) {
    console.log('Headless mit Erweiterung fehlgeschlagen, versuche sichtbares Fenster …');
    ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile2'),
      { ...launchOpts, headless: false, channel: undefined });
  }

  const masters = [];
  const shot = async (page, name, opts) => {
    const buf = await page.screenshot(opts);
    fs.writeFileSync(path.join(OUT2X, name), buf);
    masters.push({ name, buf });
    console.log('  ✓', name);
    return buf;
  };

  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = new URL(sw.url()).host;

    // Artikel besuchen. Der allererste Aufruf nach dem Start kann in die
    // Installation der Erweiterung fallen — deshalb einmal neu laden.
    const page = await ctx.newPage();
    await page.goto(`${scheme}://${HOST}/artikel/mieten-steigen-langsamer`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(4000); // Anfragen + Flush (600 ms Drossel)

    const tabs = await sw.evaluate(() => WW.store.listTabs());
    const tab = tabs.find((t) => (t.pageUrl || '').includes(HOST));
    if (!tab) throw new Error('Demo-Seite wurde nicht erfasst');
    const info = await sw.evaluate(async (id) => {
      const t = await WW.store.getTab(id);
      const agg = WW.computeAgg(t);
      const s = WW.scoreTab(agg);
      return { stellen: s.entTotal, ampel: s.level, anfragen: t.requests.length,
        erkenntnisse: Object.keys(agg.insights),
        unbekannt: Object.values(agg.entities).filter((e) => e.cat === 'unknown').map((e) => e.name),
        fehler: t.requests.filter((r) => r.err).map((r) => r.err + ' ' + r.url.slice(0, 60)) };
    }, tab.tabId);
    console.log(`\nErfasst: ${info.anfragen} Anfragen, ${info.stellen} fremde Stellen, Ampel ${info.ampel}`);
    console.log('Erkenntnisse:', info.erkenntnisse.join(', '));
    if (info.unbekannt.length) console.log('NICHT ZUGEORDNET:', info.unbekannt.join(', '));
    if (info.fehler.length) console.log('FEHLER:', info.fehler.join('\n  '));
    console.log('');

    const dash = await ctx.newPage();
    await dash.setViewportSize({ width: W, height: H });
    await dash.goto(`chrome-extension://${extId}/dashboard/dashboard.html?tab=${tab.tabId}`);
    await dash.waitForSelector('.hero');
    await dash.waitForTimeout(600);
    await shot(dash, '1-uebersicht.png');

    await dash.click('.views button[data-view="anfragen"]');
    await dash.waitForSelector('table.req tbody tr');
    const rows = await dash.$$('table.req tbody tr');
    const texts = await dash.$$eval('table.req tbody tr', (trs) => trs.map((t) => t.textContent));
    const wanted = texts.findIndex((t) => /reichweiten-messung|profil-daten/.test(t));
    await rows[wanted >= 0 ? wanted : Math.min(2, rows.length - 1)].click();
    await dash.waitForSelector('#detail .card');
    await dash.waitForTimeout(400);
    await shot(dash, '2-anfragen.png');

    await dash.click('.views button[data-view="netzwerk"]');
    await dash.waitForSelector('#view-netzwerk svg');
    await dash.waitForTimeout(900);
    // Ganze Karte messen, nicht nur die Grafik — sonst fällt die Legende
    // unter die 800-px-Kante.
    const gh = await dash.$eval('#view-netzwerk .card', (c) => c.getBoundingClientRect().height);
    const zoom = Math.min(1, (H - 80) / gh);
    if (zoom < 1) {
      await dash.evaluate((z) => { document.body.style.zoom = String(z); }, zoom);
      await dash.waitForTimeout(500);
      console.log(`  (Graph ${Math.round(gh)} px hoch → Zoom ${zoom.toFixed(2)})`);
    }
    await shot(dash, '3-netzwerk.png');
    await dash.evaluate(() => { document.body.style.zoom = '1'; });

    await dash.click('#mode-profi');
    await dash.click('.views button[data-view="anfragen"]');
    await dash.waitForSelector('table.req tbody tr');
    await dash.waitForTimeout(400);
    await shot(dash, '4-profi.png');

    await dash.click('#mode-laie');
    await dash.click('.views button[data-view="lexikon"]');
    await dash.waitForSelector('.glos dt');
    await dash.waitForTimeout(400);
    await shot(dash, '5-lexikon.png');

    // Popup über dem Artikel: beide Bilder einzeln aufnehmen und montieren.
    await page.bringToFront();
    await page.waitForTimeout(300);
    const articleShot = await page.screenshot();

    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 360, height: 640 });
    await pop.goto(`chrome-extension://${extId}/popup/popup.html?tab=${tab.tabId}`);
    await pop.waitForSelector('.ampel');
    await pop.waitForTimeout(600);
    const popH = await pop.$eval('body', (b) => Math.min(b.scrollHeight, 620));
    const popupShot = await pop.screenshot({ clip: { x: 0, y: 0, width: 360, height: popH } });
    await pop.close();

    const comp = await ctx.newPage();
    await comp.setViewportSize({ width: W, height: H });
    await comp.setContent(`<style>
      html,body { margin:0; width:${W}px; height:${H}px; overflow:hidden; }
      .page { position:absolute; inset:0; }
      .page img { width:${W}px; display:block; }
      .dim { position:absolute; inset:0; background:rgba(16,18,22,.28); }
      .pop { position:absolute; top:14px; right:18px; border-radius:12px; overflow:hidden;
             box-shadow:0 18px 48px rgba(0,0,0,.34), 0 2px 8px rgba(0,0,0,.2); }
      .pop img { display:block; width:360px; }
    </style>
    <div class="page"><img src="${dataUri(articleShot)}"></div>
    <div class="dim"></div>
    <div class="pop"><img src="${dataUri(popupShot)}"></div>`);
    await comp.waitForTimeout(400);
    await shot(comp, '6-popup.png');
  } finally {
    await ctx.close().catch(() => {});
    server.close();
  }

  // Store-Format 1280×800 aus den Mastern herunterrechnen (Chrome nimmt nur
  // 1280×800 oder 640×400). Ohne Zusatzwerkzeug: im Browser einbetten.
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const m of masters) {
    await p.setContent(`<style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
      img{width:${W}px;height:${H}px;display:block}</style><img src="${dataUri(m.buf)}">`);
    await p.waitForTimeout(120);
    await p.screenshot({ path: path.join(OUT, m.name) });
  }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\nFertig.\n  ${OUT}      1280×800 (Chrome Web Store)\n  ${OUT2X}   2560×1600 (Master)`);
})().catch((e) => { console.error('ABBRUCH:', e); process.exit(1); });
