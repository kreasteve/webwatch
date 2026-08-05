'use strict';
// Erzeugt data/trackerdb.json aus der gepflegten Quelle src/common/trackerdb.js.
//
// Aufruf:  node tools/export_trackerdb.js
//
// Die JSON-Datei ist das, was die Erweiterung auf Knopfdruck von GitHub holt.
// Gepflegt wird weiterhin ausschließlich trackerdb.js — dort stehen die
// Kommentare und die thematische Gliederung. Nach jeder Änderung an der
// Datenbank: WW.TRACKER_DB_STAND hochsetzen, dieses Skript laufen lassen,
// beides committen und pushen.
//
// Bewusst NICHT exportiert werden die Pfad-Hinweise (WW.PATH_HINTS): Sie
// enthalten reguläre Ausdrücke, und aus der Ferne gelieferte Muster wären ein
// unnötiges Risiko. Sie bleiben fest in der Erweiterung.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ZIEL = path.join(ROOT, 'data', 'trackerdb.json');

globalThis.WW = globalThis.WW || {};
require(path.join(ROOT, 'src', 'common', 'categories.js'));
require(path.join(ROOT, 'src', 'common', 'trackerdb.js'));

const eintraege = WW.TRACKER_ENTITIES.map((e) => ({
  id: e.id, name: e.name, owner: e.owner || '', cat: e.cat, dom: e.dom, info: e.info,
}));

// Dieselbe Prüfung, die auch die Erweiterung anwendet — was hier durchfällt,
// würde beim Nutzer verworfen. Lieber gleich hier auffliegen.
require(path.join(ROOT, 'src', 'common', 'dbupdate.js'));
const daten = { stand: WW.TRACKER_DB_STAND, eintraege };
const geprueft = WW.dbUpdate.pruefe(daten);
if (geprueft.verworfen) {
  console.error(`ABBRUCH: ${geprueft.verworfen} Eintrag/Einträge halten die eigene Prüfung nicht ein.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(daten) + '\n');

const domains = eintraege.reduce((n, e) => n + e.dom.length, 0);
console.log(`data/trackerdb.json geschrieben — Stand ${daten.stand}, `
  + `${eintraege.length} Einträge, ${domains} Domains, `
  + `${(fs.statSync(ZIEL).size / 1024).toFixed(1)} KB`);
