'use strict';
// Unit-Tests für die Kernlogik (Domain, Klassifikation, Dekoder,
// Erkenntnisse, Bewertung). Läuft mit Node: `node tests/run_tests.js`
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'common');
const FILES = ['compat.js', 'domain.js', 'categories.js', 'trackerdb.js', 'decoder.js', 'insights.js', 'score.js'];

const sandbox = {
  console, JSON, Math, Date, URL, URLSearchParams,
  TextDecoder, TextEncoder, atob, btoa,
};
vm.createContext(sandbox);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
}
const WW = sandbox.WW;

let pass = 0;
let fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; }
  else { fail++; console.error(`FAIL: ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`); }
};

// ── Domain ────────────────────────────────────────────────────
const D = WW.domain;
t('getHost einfach', D.getHost('https://sub.example.co.uk/x?y=1') === 'sub.example.co.uk');
t('getHost ungültig', D.getHost('keine-url') === '');
t('baseDomain co.uk', D.getBaseDomain('sub.example.co.uk') === 'example.co.uk');
t('baseDomain tief', D.getBaseDomain('a.b.example.com') === 'example.com');
t('baseDomain zweiteilig', D.getBaseDomain('example.com') === 'example.com');
t('baseDomain cloudfront-Kunde', D.getBaseDomain('d123.cloudfront.net') === 'd123.cloudfront.net');
t('baseDomain amazonaws-Kunde', D.getBaseDomain('mybucket.s3.amazonaws.com') === 's3.amazonaws.com');
t('baseDomain IPv4', D.getBaseDomain('192.168.1.1') === '192.168.1.1');
t('thirdParty nein', D.isThirdParty('cdn.example.com', 'example.com') === false);
t('thirdParty ja', D.isThirdParty('stats.doubleclick.net', 'example.com') === true);

// ── Klassifikation ────────────────────────────────────────────
const c1 = WW.classifyHost('stats.g.doubleclick.net');
t('classify doubleclick', c1 && c1.id === 'google-ads', c1);
const c2 = WW.classifyHost('fonts.googleapis.com');
t('classify fonts (längster Treffer)', c2 && c2.id === 'google-fonts', c2);
const c3 = WW.classifyHost('ajax.googleapis.com');
t('classify googleapis generisch', c3 && c3.id === 'google-cdn', c3);
const c4 = WW.classifyHost('www.google.com', '/pagead/1p-conversion/123/');
t('classify Pfad-Hinweis google.com/pagead', c4 && c4.id === 'google-ads', c4);
const c5 = WW.classifyHost('script.hotjar.com');
t('classify hotjar', c5 && c5.cat === 'session', c5);
t('classify unbekannt', WW.classifyHost('voellig-unbekannt.example') === null);
const c6 = WW.classifyHost('edge.adobedc.net');
t('classify adobedc', c6 && c6.id === 'adobe-experience', c6);
const c7 = WW.classifyHost('firefly.adobe.io');
t('classify adobe.io', c7 && c7.id === 'adobe-experience', c7);
const c8 = WW.classifyHost('assets.adobedtm.com');
t('classify adobedtm', c8 && c8.id === 'adobe-launch', c8);
const c9 = WW.classifyHost('yt3.ggpht.com');
t('classify ggpht', c9 && c9.id === 'google-cdn', c9);
const c10 = WW.classifyHost('www.google.com', '/js/th/abc.js');
t('classify google.com/js', c10 && c10.id === 'google-cdn', c10);
t('classify yieldlab', WW.classifyHost('ad.yieldlab.net') && WW.classifyHost('ad.yieldlab.net').id === 'yieldlab');
t('classify iubenda', WW.classifyHost('cdn.iubenda.com') && WW.classifyHost('cdn.iubenda.com').cat === 'cmp');
t('classify trustedshops', WW.classifyHost('widgets.trustedshops.com') && WW.classifyHost('widgets.trustedshops.com').id === 'trustedshops');
t('classify wp.com', WW.classifyHost('stats.wp.com') && WW.classifyHost('stats.wp.com').id === 'wpcom');
t('classify tinypass', WW.classifyHost('experience.tinypass.com') && WW.classifyHost('experience.tinypass.com').id === 'piano');
t('classify bildstatic', WW.classifyHost('a.bildstatic.de') && WW.classifyHost('a.bildstatic.de').id === 'bild-cdn');
t('classify datadome', WW.classifyHost('ct.captcha-delivery.com') && WW.classifyHost('ct.captcha-delivery.com').id === 'datadome');
t('classify bombora', WW.classifyHost('cdn.ml314.com') && WW.classifyHost('cdn.ml314.com').cat === 'audience');
t('classify adition html-load', WW.classifyHost('html-load.com') && WW.classifyHost('html-load.com').id === 'adition');
t('classify accounts.google', WW.classifyHost('accounts.google.com') && WW.classifyHost('accounts.google.com').id === 'google-login');
t('classify trustindex', WW.classifyHost('cdn.trustindex.io') && WW.classifyHost('cdn.trustindex.io').id === 'trustindex');
t('classify mateti → Mapp', WW.classifyHost('cdn.mateti.net') && WW.classifyHost('cdn.mateti.net').id === 'mapp');
t('classify netid', WW.classifyHost('einwilligungsspeicher.netid.de') && WW.classifyHost('einwilligungsspeicher.netid.de').id === 'netid');
t('classify anthropic', WW.classifyHost('api.anthropic.com') && WW.classifyHost('api.anthropic.com').id === 'anthropic');

// Typ-Labels für den Einfach-Modus
t('typeLabel Bild', WW.typeLabel('image', 'GET') === 'Bild laden');
t('typeLabel XHR POST', WW.typeLabel('xmlhttprequest', 'POST') === 'Daten senden (im Hintergrund)');
t('typeLabel XHR GET', WW.typeLabel('xmlhttprequest', 'GET') === 'Daten abrufen (im Hintergrund)');
t('typeLabel Beacon', WW.typeLabel('ping', 'POST') === 'Tracking-Signal senden');
t('typeLabel unbekannt+POST', WW.typeLabel('irgendwas', 'POST') === 'Daten senden');
t('classify utiq', WW.classifyHost('idc.utiq.com') && WW.classifyHost('idc.utiq.com').cat === 'audience');

// Alle Entity-Kategorien müssen existieren
for (const e of WW.TRACKER_ENTITIES) {
  if (!WW.CATEGORIES[e.cat]) { t(`Kategorie existiert: ${e.id}`, false, e.cat); }
}
t('Entity-Kategorien konsistent', true);
// Keine Domain doppelt vergeben
{
  const seen = new Map();
  let dup = null;
  for (const e of WW.TRACKER_ENTITIES) {
    for (const d of e.dom) {
      if (seen.has(d) && seen.get(d) !== e.id) dup = d + ' (' + seen.get(d) + ' vs ' + e.id + ')';
      seen.set(d, e.id);
    }
  }
  t('keine Domain doppelt', dup === null, dup);
}

// ── Dekoder ───────────────────────────────────────────────────
const q = WW.parseQuery('https://region1.google-analytics.com/g/collect?v=2&tid=G-123&cid=123.456&sr=1920x1080&ul=de-de&dl=https%3A%2F%2Fexample.com%2Fseite');
t('parseQuery Anzahl', q.length === 6, q);
t('parseQuery dekodiert', q.find((p) => p.k === 'dl').v === 'https://example.com/seite');
t('paramLabel cid', WW.paramLabel('cid') === 'Client-ID (Browser-Wiedererkennung)');
t('paramLabel unbekannt', WW.paramLabel('xyz_foo') === null);
t('paramLabel ud[em]', WW.paramLabel('ud[em]') === 'E-Mail-Adresse (gehasht)');

const bodyForm = WW.decodeRequestBody({ formData: { email: ['max@example.com'], x: ['1', '2'] } });
t('body formData', bodyForm.kind === 'form' && bodyForm.params.length === 3, bodyForm);

const enc = new TextEncoder();
const jsonBytes = enc.encode('{"user":{"email":"max@example.com"},"screen":"1920x1080","list":[1,2]}');
const bodyJson = WW.decodeRequestBody({ raw: [{ bytes: jsonBytes.buffer }] });
t('body JSON erkannt', bodyJson.kind === 'json', bodyJson && bodyJson.kind);
t('body JSON geflattet', bodyJson.params.some((p) => p.k === 'user.email' && p.v === 'max@example.com'), bodyJson.params);

const urlencBytes = enc.encode('a=1&mail=max%40example.com');
const bodyUrlenc = WW.decodeRequestBody({ raw: [{ bytes: urlencBytes.buffer }] });
t('body urlencoded', bodyUrlenc.kind === 'form' && bodyUrlenc.params.find((p) => p.k === 'mail').v === 'max@example.com', bodyUrlenc);

const binBytes = new Uint8Array([0, 1, 2, 3, 255, 254, 7, 8, 0, 0, 1, 2]);
const bodyBin = WW.decodeRequestBody({ raw: [{ bytes: binBytes.buffer }] });
t('body binär erkannt', bodyBin.kind === 'binary', bodyBin && bodyBin.kind);

t('tryDecodeValue base64-json', String(WW.tryDecodeValue('eyJhIjoxfQ==')).includes('"a":1'));
t('tryDecodeValue urlencoded', WW.tryDecodeValue('https%3A%2F%2Fx.de%2F') === 'https://x.de/');

// ── Erkenntnisse ──────────────────────────────────────────────
const page = { url: 'https://example.com/artikel', base: 'example.com' };
const mkRec = (over) => Object.assign({
  url: 'https://tracker.example.net/collect', host: 'tracker.example.net',
  base: 'example.net', method: 'GET', type: 'xmlhttprequest', tp: true,
  entity: null, query: [], body: null, cookieCount: 0, cookieNames: [],
}, over);

let ins = WW.analyzeRequest(mkRec({ query: [{ k: 'email', v: 'max@example.com' }] }), page);
t('Erkenntnis E-Mail', ins.some((i) => i.kind === 'email' && i.sev === 3), ins);

// Kein Fehlalarm bei Retina-Assets und Asset-URLs (Regression)
ins = WW.analyzeRequest(mkRec({ query: [{ k: 'img', v: 'logo@2x.png' }] }), page);
t('kein E-Mail-Fehlalarm @2x.png', !ins.some((i) => i.kind === 'email'), ins);
ins = WW.analyzeRequest(mkRec({ body: { kind: 'json', params: [{ k: 'asset', v: 'https://cdn.example.net/img/hero@3x.jpg' }] } }), page);
t('kein E-Mail-Fehlalarm Asset-URL', !ins.some((i) => i.kind === 'email'), ins);
ins = WW.analyzeRequest(mkRec({ query: [{ k: 'kontakt', v: 'mailto:info@firma.de' }] }), page);
t('E-Mail in mailto erkannt', ins.some((i) => i.kind === 'email'), ins);
// Google-Fonts-Parameter darf keine E-Mail sein (Regression: wght@300..900)
ins = WW.analyzeRequest(mkRec({ query: [{ k: 'family', v: 'YouTube+Sans:wght@300..900' }] }), page);
t('kein E-Mail-Fehlalarm wght@300..900', !ins.some((i) => i.kind === 'email'), ins);

ins = WW.analyzeRequest(mkRec({ query: [{ k: 'ud[em]', v: 'a'.repeat(0) + 'ab12'.repeat(16) }] }), page);
t('Erkenntnis E-Mail-Hash', ins.some((i) => i.kind === 'email-hash'), ins);

ins = WW.analyzeRequest(mkRec({ query: [{ k: 'sr', v: '1920x1080' }] }), page);
t('Erkenntnis Bildschirm', ins.some((i) => i.kind === 'screen'), ins);

ins = WW.analyzeRequest(mkRec({ query: [{ k: 'dl', v: 'https%3A%2F%2Fexample.com%2Fartikel' }] }), page);
t('Erkenntnis URL-Weitergabe', ins.some((i) => i.kind === 'url-leak'), ins);

ins = WW.analyzeRequest(mkRec({ query: [{ k: 'cid', v: '123456.789012' }] }), page);
t('Erkenntnis Kennung (cid)', ins.some((i) => i.kind === 'id'), ins);

ins = WW.analyzeRequest(mkRec({ cookieCount: 3, cookieNames: ['_ga', '_gid', 'x'] }), page);
t('Erkenntnis Cookies', ins.some((i) => i.kind === 'cookies'), ins);

ins = WW.analyzeRequest(mkRec({ type: 'ping' }), page);
t('Erkenntnis Beacon', ins.some((i) => i.kind === 'beacon'), ins);

ins = WW.analyzeRequest(mkRec({ type: 'image', url: 'https://t.example.net/pixel.gif?a=1&b=2&c=3', query: [{ k: 'a', v: '1' }, { k: 'b', v: '2' }, { k: 'c', v: '3' }] }), page);
t('Erkenntnis Zählpixel', ins.some((i) => i.kind === 'pixel'), ins);

ins = WW.analyzeRequest(mkRec({
  body: { kind: 'json', params: [
    { k: 'device.colorDepth', v: '24' }, { k: 'device.timezone', v: 'Europe/Berlin' },
    { k: 'device.plugins', v: 'PDF' }, { k: 'device.platform', v: 'MacIntel' },
  ] },
}), page);
t('Erkenntnis Fingerprint', ins.some((i) => i.kind === 'fingerprint' && i.sev === 3), ins);

ins = WW.analyzeRequest(mkRec({ query: [{ k: 'lat', v: '52.520008' }, { k: 'lon', v: '13.404954' }] }), page);
t('Erkenntnis Standort', ins.some((i) => i.kind === 'geo'), ins);

// Erstanbieter: Cookies sind normal, keine Erkenntnis
ins = WW.analyzeRequest(mkRec({ tp: false, cookieCount: 5, cookieNames: ['sess'] }), page);
t('Erstanbieter-Cookies ok', !ins.some((i) => i.kind === 'cookies'), ins);

const sc = WW.analyzeResponse(mkRec({}), [{ name: 'Set-Cookie', value: 'id=abc; Max-Age=63072000; Path=/' }]);
t('Set-Cookie Langzeit', sc && sc.kind === 'set-cookie' && sc.sev === 3, sc);

// ── Aggregation & Bewertung ───────────────────────────────────
const mkTab = (requests) => ({ tabId: 1, pageUrl: page.url, pageHost: 'example.com', pageBase: 'example.com', requests, dropped: 0 });

let agg = WW.computeAgg(mkTab([]));
let score = WW.scoreTab(agg);
t('leer → grün', score.level === 'gruen', score);

const gaRec = mkRec({
  host: 'www.google-analytics.com', base: 'google-analytics.com',
  entity: { id: 'google-analytics', name: 'Google Analytics', owner: 'Google', cat: 'analytics' },
  insights: [{ kind: 'id', sev: 2, label: 'Eindeutige Kennung übertragen', detail: 'cid' }],
});
agg = WW.computeAgg(mkTab([gaRec]));
score = WW.scoreTab(agg);
t('nur Analytics → gelb', score.level === 'gelb', score);
t('Aggregat: 1 Entity', Object.keys(agg.entities).length === 1, agg.entities);

const hjRec = mkRec({
  host: 'insights.hotjar.com', base: 'hotjar.com', method: 'POST',
  entity: { id: 'hotjar', name: 'Hotjar', owner: 'Contentsquare', cat: 'session' },
  insights: [{ kind: 'session-rec', sev: 3, label: 'Verhaltensdaten an Sitzungsaufzeichner gesendet', detail: '' }],
});
agg = WW.computeAgg(mkTab([gaRec, hjRec]));
score = WW.scoreTab(agg);
t('Session-Recording → rot', score.level === 'rot', score);
t('Satz erwähnt Stellen', score.satz.includes('fremden Stellen'), score.satz);

const unkRec = mkRec({ host: 'x1.unbekannt.example', base: 'unbekannt.example', entity: null, insights: [] });
agg = WW.computeAgg(mkTab([unkRec]));
t('Unbekannte Entity benannt', agg.entities['d:unbekannt.example'].name === 'unbekannt.example', agg.entities);

// Erstanbieter zählt nicht als Entity
agg = WW.computeAgg(mkTab([mkRec({ tp: false, host: 'example.com', base: 'example.com' })]));
t('Erstanbieter keine Entity', Object.keys(agg.entities).length === 0, agg.entities);

// Gleicher Konzern wie die Seite: Infrastruktur wird markiert und nicht
// als fremde Kategorie gezählt — Werbung desselben Konzerns aber schon.
{
  const ytTab = { tabId: 1, pageUrl: 'https://www.youtube.com/', pageHost: 'www.youtube.com', pageBase: 'youtube.com', requests: [
    mkRec({ host: 'i.ytimg.com', base: 'ytimg.com', entity: { id: 'youtube', name: 'YouTube', owner: 'Google (Alphabet)', cat: 'social' }, insights: [] }),
    mkRec({ host: 'yt3.ggpht.com', base: 'ggpht.com', entity: { id: 'google-cdn', name: 'Google APIs', owner: 'Google (Alphabet)', cat: 'cdn' }, insights: [] }),
    mkRec({ host: 'ad.doubleclick.net', base: 'doubleclick.net', entity: { id: 'google-ads', name: 'Google Ads / DoubleClick', owner: 'Google (Alphabet)', cat: 'advertising' }, insights: [] }),
  ], dropped: 0 };
  const a = WW.computeAgg(ytTab);
  t('sameOwner: ytimg markiert', a.entities['youtube'].sameOwner === true, a.entities);
  t('sameOwner: ggpht markiert', a.entities['google-cdn'].sameOwner === true, a.entities);
  t('sameOwner: social nicht gezählt', !a.byCat.social, a.byCat);
  t('sameOwner: Werbung zählt trotzdem', a.byCat.advertising === 1 && !a.entities['google-ads'].sameOwner, a.byCat);
  t('sameOwner: Anfragen getrennt gezählt', a.tpOwn === 2 && a.tpForeign === 1, { tpOwn: a.tpOwn, tpForeign: a.tpForeign });
  const ysc = WW.scoreTab(a);
  t('sameOwner: zählt nicht als fremde Stelle', ysc.entTotal === 1 && ysc.ownTotal === 2, ysc);
}

// Erkenntnisse an Anbieter-eigene Server: nicht in der globalen Liste
// („Was übertragen wurde"), aber weiter am Entity-Kärtchen sichtbar.
{
  const cTab = { tabId: 3, pageUrl: 'https://claude.ai/', pageHost: 'claude.ai', pageBase: 'claude.ai', requests: [
    mkRec({ host: 's-cdn.anthropic.com', base: 'anthropic.com',
      entity: { id: 'anthropic', name: 'Anthropic (Claude)', owner: 'Anthropic', cat: 'cdn' },
      insights: [{ kind: 'url-leak', sev: 2, label: 'Besuchte Seite weitergegeben', detail: 'u=…' }] }),
    mkRec({ host: 'api-iam.intercom.io', base: 'intercom.io',
      entity: { id: 'intercom', name: 'Intercom', owner: 'Intercom', cat: 'functional' },
      insights: [{ kind: 'email', sev: 3, label: 'E-Mail-Adresse übertragen', detail: 'user@example.org' }] }),
  ], dropped: 0 };
  const a = WW.computeAgg(cTab);
  t('eigene Erkenntnis nicht global', !a.insights['url-leak'], a.insights);
  t('fremde Erkenntnis bleibt global', a.insights['email'] && a.insights['email'].count === 1, a.insights);
  t('eigene Erkenntnis am Kärtchen', a.entities['anthropic'].kinds['url-leak'] === 1, a.entities['anthropic']);
  t('Label-Fallback vorhanden', a.insightLabels['url-leak'].label === 'Besuchte Seite weitergegeben', a.insightLabels);
  const sc = WW.scoreTab(a);
  t('nur Intercom ist fremd', sc.entTotal === 1 && sc.ownTotal === 1, sc);
  t('Satz zählt eigene Infra nicht mit', sc.satz.includes('1 fremden Stelle'), sc.satz);
}

// Nur Anbieter-eigene Verbindungen → eigener Satz, grün
{
  const oTab = { tabId: 4, pageUrl: 'https://claude.ai/', pageHost: 'claude.ai', pageBase: 'claude.ai', requests: [
    mkRec({ host: 's-cdn.anthropic.com', base: 'anthropic.com',
      entity: { id: 'anthropic', name: 'Anthropic (Claude)', owner: 'Anthropic', cat: 'cdn' }, insights: [] }),
  ], dropped: 0 };
  const sc = WW.scoreTab(WW.computeAgg(oTab));
  t('nur eigene Infra → grün', sc.level === 'gruen', sc);
  t('nur eigene Infra → eigener Satz', sc.satz.includes('eigenen Anbieter'), sc.satz);
}

// sameOwner über Verlags-Entities: bildstatic auf bild.de
{
  const bTab = { tabId: 2, pageUrl: 'https://www.bild.de/', pageHost: 'www.bild.de', pageBase: 'bild.de', requests: [
    mkRec({ host: 'a.bildstatic.de', base: 'bildstatic.de', entity: { id: 'bild-cdn', name: 'BILD', owner: 'Axel Springer (DE)', cat: 'cdn' }, insights: [] }),
    mkRec({ host: 'www.asadcdn.com', base: 'asadcdn.com', entity: { id: 'asadcdn', name: 'AS Werbe-CDN', owner: 'Axel Springer (DE)', cat: 'advertising' }, insights: [] }),
  ], dropped: 0 };
  const a = WW.computeAgg(bTab);
  t('bildstatic ist sameOwner auf bild.de', a.entities['bild-cdn'].sameOwner === true, a.entities);
  t('Springer-Werbung zählt trotzdem', a.byCat.advertising === 1, a.byCat);
}

// Blockierte Anfragen: Chrome- UND Firefox-Fehlercodes zählen (Regression)
agg = WW.computeAgg(mkTab([
  mkRec({ err: 'net::ERR_BLOCKED_BY_CLIENT', insights: [] }),
  mkRec({ err: 'NS_ERROR_ABORT', insights: [] }),
]));
t('blockiert zählt beide Browser', agg.blocked === 2, agg.blocked);

// ── Ergebnis ─────────────────────────────────────────────────
console.log(`\n${pass} Tests bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
