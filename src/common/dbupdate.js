'use strict';
// Nachladen der Tracker-Datenbank — ausschließlich auf Knopfdruck.
//
// Datenspur baut von sich aus keine Verbindungen auf. Diese Datei ändert daran
// nichts: Sie holt die Liste nur, wenn jemand im Dashboard „Aktualisieren"
// drückt. Ohne diesen Klick passiert hier gar nichts.
//
// Geladen werden ausschließlich DATEN (JSON), niemals Code — nichts davon wird
// ausgewertet, ausgeführt oder in ein RegExp verwandelt. Alles, was nicht
// exakt dem erwarteten Schema entspricht, fliegt raus. Die Pfad-Hinweise
// (WW.PATH_HINTS) bleiben bewusst fest eingebaut, weil sie reguläre Ausdrücke
// enthalten und aus der Ferne gelieferte Muster ein unnötiges Risiko wären.
globalThis.WW = globalThis.WW || {};

(() => {
  const B = WW.B;

  const QUELLE = 'https://raw.githubusercontent.com/kreasteve/datenspur/main/data/trackerdb.json';
  const KEY = 'ds_trackerdb';

  const MAX_ZEICHEN = 2 * 1024 * 1024; // 2 MB Rohtext genügt weit über Bedarf
  const MAX_EINTRAEGE = 5000;
  const MAX_DOMAINS = 60;
  const RE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
  const RE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  const RE_STAND = /^\d{4}-\d{2}-\d{2}$/;

  const text = (v, max) => (typeof v === 'string' && v.length && v.length <= max ? v : null);

  // Rohdaten → geprüfte Liste. Wirft bei strukturellen Fehlern; einzelne
  // fehlerhafte Einträge werden übersprungen und gezählt.
  const pruefe = (roh) => {
    if (!roh || typeof roh !== 'object') throw new Error('Datei hat nicht das erwartete Format.');
    if (!RE_STAND.test(String(roh.stand || ''))) throw new Error('Kein gültiges Standsdatum in der Datei.');
    if (!Array.isArray(roh.eintraege)) throw new Error('Die Datei enthält keine Einträge.');
    if (roh.eintraege.length > MAX_EINTRAEGE) throw new Error('Die Datei enthält unplausibel viele Einträge.');

    const erlaubteKategorien = new Set(Object.keys(WW.CATEGORIES || {}).filter((c) => c !== 'unknown'));
    const eintraege = [];
    const idsGesehen = new Set();
    let verworfen = 0;

    for (const e of roh.eintraege) {
      const id = e && text(e.id, 60);
      const name = e && text(e.name, 80);
      const cat = e && text(e.cat, 30);
      const info = e && text(e.info, 400);
      if (!id || !RE_ID.test(id) || idsGesehen.has(id) || !name || !info
        || !cat || !erlaubteKategorien.has(cat) || !Array.isArray(e.dom) || !e.dom.length
        || e.dom.length > MAX_DOMAINS) {
        verworfen++;
        continue;
      }
      const dom = [];
      for (const d of e.dom) {
        const s = text(d, 100);
        if (s && RE_DOMAIN.test(s.toLowerCase())) dom.push(s.toLowerCase());
      }
      if (!dom.length) { verworfen++; continue; }
      idsGesehen.add(id);
      eintraege.push({ id, name, owner: text(e.owner, 80) || '', cat, dom, info });
    }

    if (!eintraege.length) throw new Error('Kein einziger Eintrag war verwertbar.');
    // Einzelne Ausreißer sind hinnehmbar (etwa ein Doppeleintrag), eine
    // größtenteils kaputte Datei nicht. Untergrenze, damit kleine Listen nicht
    // schon an einem einzigen Fehler scheitern.
    const grenze = Math.max(5, Math.floor((eintraege.length + verworfen) / 20));
    if (verworfen > grenze) {
      throw new Error(`Zu viele unbrauchbare Einträge (${verworfen}) — Datei wird nicht übernommen.`);
    }
    return { stand: roh.stand, eintraege, verworfen };
  };

  // Geprüfte Liste in den laufenden Index einspielen. Die Array-Referenz bleibt
  // erhalten, weil andere Module sie festhalten.
  const anwenden = (geprueft) => {
    WW.TRACKER_ENTITIES.length = 0;
    for (const e of geprueft.eintraege) WW.TRACKER_ENTITIES.push(e);
    WW.rebuildTrackerIndex();
    WW.TRACKER_DB_STAND = geprueft.stand;
    WW.TRACKER_DB_QUELLE = 'nachgeladen';
  };

  // Beim Start: bereits gespeicherte Fassung einspielen, wenn sie jünger ist
  // als die mitgelieferte. Kein Netzzugriff.
  const ausStorage = async () => {
    if (!B || !B.storage || !B.storage.local) return false;
    let gespeichert;
    try {
      const o = await B.storage.local.get(KEY);
      gespeichert = o && o[KEY];
    } catch (e) { return false; }
    if (!gespeichert) return false;
    try {
      const geprueft = pruefe(gespeichert);
      if (geprueft.stand <= WW.TRACKER_DB_STAND) return false;
      anwenden(geprueft);
      return true;
    } catch (e) {
      // Unbrauchbares Gespeichertes entfernen, damit es nicht bei jedem Start
      // erneut scheitert. Die mitgelieferte Liste bleibt in Kraft.
      B.storage.local.remove(KEY).catch(() => {});
      return false;
    }
  };

  // Nur von einem Klick aufgerufen: Liste holen, prüfen, speichern, einspielen.
  const holen = async () => {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    let roh;
    try {
      const antwort = await fetch(QUELLE, {
        cache: 'no-cache',
        redirect: 'follow',
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!antwort.ok) throw new Error(`Server antwortete mit ${antwort.status}.`);
      const rohtext = await antwort.text();
      if (rohtext.length > MAX_ZEICHEN) throw new Error('Die Datei ist unerwartet groß.');
      roh = JSON.parse(rohtext);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('Zeitüberschreitung — keine Antwort erhalten.');
      if (e instanceof SyntaxError) throw new Error('Die Datei ließ sich nicht lesen.');
      throw new Error(e && e.message ? e.message : 'Abruf fehlgeschlagen.');
    } finally {
      if (timer) clearTimeout(timer);
    }

    const geprueft = pruefe(roh);
    const neuer = geprueft.stand > WW.TRACKER_DB_STAND;
    if (neuer) {
      if (B && B.storage && B.storage.local) {
        await B.storage.local.set({ [KEY]: { stand: geprueft.stand, eintraege: geprueft.eintraege } })
          .catch(() => {});
      }
      anwenden(geprueft);
    }
    return { neuer, stand: geprueft.stand, anzahl: geprueft.eintraege.length, verworfen: geprueft.verworfen };
  };

  WW.dbUpdate = { QUELLE, KEY, pruefe, anwenden, ausStorage, holen };
})();
