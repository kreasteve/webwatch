'use strict';
// Dashboard: Übersicht, Anfragenliste mit Detailansicht, Netzwerk-Graph,
// Lexikon. Läuft als Extension-Seite; alle Daten kommen per Message aus
// dem Hintergrund.
(() => {
  const B = WW.B;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    tabId: null,
    data: null,        // {tab, agg, score}
    ver: -1,
    view: 'uebersicht',
    mode: 'laie',      // 'laie' | 'profi'
    search: '',
    onlyTp: false,
    cat: '',
    onlyIns: false,
    selectedRid: null,
    lexikonRendered: false,
  };

  const cat = (c) => WW.CATEGORIES[c] || WW.CATEGORIES.unknown;
  const anfragen = (n) => `${n} ${n === 1 ? 'Anfrage' : 'Anfragen'}`;
  const REPO_URL = 'https://github.com/kreasteve/datenspur';

  // Meldung unbekannter Domains: öffnet ein vorausgefülltes GitHub-Issue.
  // Bewusst KEIN direkter Versand — der Nutzer sieht vor dem Absenden genau,
  // was gemeldet wird, und kann es bearbeiten oder abbrechen.
  const reportUnknown = (keys) => {
    const d = state.data;
    if (!d) return;
    const ents = keys.map((k) => d.agg.entities[k]).filter(Boolean);
    if (!ents.length) return;
    const lines = ['**Unbekannte Drittanbieter-Domain(s):**', ''];
    for (const e of ents) {
      lines.push(`- \`${e.name}\` (gesehen als: ${Object.keys(e.hosts).join(', ')}; ${anfragen(e.count)})`);
    }
    lines.push('', `**Gesehen beim Besuch von:** ${d.tab.pageBase || '?'}`,
      '_(Hinweis: Die besuchte Seite hilft bei der Zuordnung — du kannst sie vor dem Absenden aber entfernen.)_',
      '', `_Gemeldet aus Datenspur ${B.runtime.getManifest().version}. Zu klären: Wem gehört die Domain, was macht der Dienst, welche Kategorie passt?_`);
    const title = ents.length === 1
      ? 'Unbekannte Domain: ' + ents[0].name
      : `Unbekannte Domains (${ents.length}) von ${d.tab.pageBase || '?'}`;
    const url = REPO_URL + '/issues/new?labels=unbekannte-domain'
      + '&title=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(lines.join('\n'));
    B.tabs.create({ url });
  };
  const riskClass = (c) => 'r' + cat(c).risiko;
  const RISK_NAME = { 1: 'Risiko: gering', 2: 'Risiko: mittel', 3: 'Risiko: hoch' };
  const isProfi = () => state.mode === 'profi';

  // ── Daten holen ─────────────────────────────────────────────
  const fetchData = async (force) => {
    if (state.tabId == null) return;
    let resp = null;
    state.bgError = null;
    try {
      resp = await B.runtime.sendMessage({ type: 'getTab', tabId: state.tabId });
    } catch (e) {
      state.bgError = String(e && e.message || e);
    }
    if (!resp || !resp.tab) {
      // Keine Daten (Seite seit Installation nicht geladen o. ä.):
      // trotzdem einmal rendern, damit der Leerzustand erklärt, was zu tun ist.
      if (force || (!state.data && !state.emptyShown)) {
        state.emptyShown = true;
        renderHeader();
        renderView();
      }
      return;
    }
    if (!force && resp.tab.ver === state.ver) return;
    state.ver = resp.tab.ver;
    state.data = resp;
    renderHeader();
    renderView();
  };

  // ── Kopf ────────────────────────────────────────────────────
  const renderHeader = () => {
    const d = state.data;
    $('#pageinfo').textContent = d && d.tab.pageUrl
      ? `Beobachtete Seite: ${d.tab.pageUrl}`
      : 'Noch keine Seite beobachtet — Seite im Tab neu laden.';
  };

  // Leerzustand mit Anleitung — wird gezeigt, solange der Hintergrund
  // für diesen Tab nichts aufgezeichnet hat.
  const emptyStateHtml = () => `<div class="card">
      <h2>Noch keine Daten für diesen Tab</h2>
      <p class="hint" style="margin-top:6px">Die Aufzeichnung beginnt, wenn eine Seite <b>geladen</b> wird. Wechsle zum beobachteten Tab und lade die Seite neu (F5) — diese Ansicht füllt sich dann von selbst. Direkt nach der Installation kennt Datenspur bereits offene Seiten noch nicht.</p>
      ${state.bgError ? `<p class="hint" style="margin-top:6px">⚠ Der Hintergrund-Prozess war nicht erreichbar (<code>${WW.esc(state.bgError)}</code>). Prüfe unter <code>chrome://extensions</code> bei Datenspur den Punkt „Service Worker" auf Fehler und lade die Erweiterung ggf. neu.</p>` : ''}
      <div style="margin-top:12px"><button class="std" id="btn-picker">Beobachtete Tabs anzeigen</button></div>
    </div>`;

  const wireEmptyState = (el) => {
    const b = el.querySelector('#btn-picker');
    if (b) b.addEventListener('click', showPicker);
  };

  // ── Übersicht ───────────────────────────────────────────────
  const renderOverview = () => {
    const el = $('#view-uebersicht');
    const d = state.data;
    if (!d) { el.innerHTML = emptyStateHtml(); wireEmptyState(el); return; }
    const { tab, agg, score } = d;
    const info = WW.LEVEL_INFO[score.level];

    let html = `
      <div class="card hero">
        <div class="dot" style="background:${info.farbe}"></div>
        <div>
          <h1>${WW.esc(info.titel)}</h1>
          <p>${WW.esc(score.satz)}</p>
          <div class="chips">
            <span class="chip"><b>${tab.requests.length}</b> Anfragen gesamt</span>
            <span class="chip"><b>${agg.tpForeign}</b> an fremde Server</span>
            <span class="chip"><b>${score.entTotal}</b> fremde Stellen</span>
            ${agg.tpOwn ? `<span class="chip"><b>${agg.tpOwn}</b> an eigene Server des Anbieters</span>` : ''}
            ${tab.navCount > 1 ? `<span class="chip"><b>${tab.navCount}</b> Seiten in dieser Aufzeichnung</span>` : ''}
            ${agg.blocked ? `<span class="chip"><b>${agg.blocked}</b> blockiert (Adblocker o. ä.)</span>` : ''}
            ${tab.dropped ? `<span class="chip">älteste ${tab.dropped} Anfragen verworfen</span>` : ''}
          </div>
        </div>
      </div>`;

    // Erkenntnisse
    const insights = Object.values(agg.insights).sort((a, b) => b.sev - a.sev || b.count - a.count);
    if (insights.length) {
      html += '<div class="card"><h2>Was übertragen wurde <small>— Klick auf „Anfragen" zeigt die Belege</small></h2><div class="inslist">';
      for (const i of insights) {
        html += `<div class="ins">
          <span class="rdot ${i.sev >= 3 ? 'r3' : i.sev === 2 ? 'r2' : 'r1'}"></span>
          <div><b>${WW.esc(i.label)}</b>
            <div class="det">z. B. an ${WW.esc(i.sampleHost || '?')}${i.sample ? ': ' + WW.esc(i.sample) : ''}</div>
          </div>
          <span class="cnt">${i.count}×</span>
        </div>`;
      }
      html += '</div></div>';
    }

    // Firmen nach Kategorie — Anbieter-eigene Dienste getrennt am Ende
    const ents = Object.values(agg.entities);
    const foreign = ents.filter((e) => !e.sameOwner);
    const own = ents.filter((e) => e.sameOwner).sort((a, b) => b.count - a.count);
    const entCard = (e, c) => {
      const full = e.known ? WW.entityById(e.key) : null;
      const kinds = Object.keys(e.kinds || {});
      const isUnknown = c === 'unknown';
      return `<div class="entcard">
        <div class="head"><span class="rdot ${e.sameOwner ? 'r1' : riskClass(c)}"></span><b title="${WW.esc(e.name)}">${WW.esc(e.name)}</b><span class="cnt">${anfragen(e.count)}${e.cookies ? ', Cookies' : ''}</span></div>
        ${e.owner ? `<div class="owner">gehört zu: ${WW.esc(e.owner)}${e.sameOwner ? ' — Anbieter dieser Seite' : ''}</div>` : `<div class="owner">${WW.esc(Object.keys(e.hosts).join(', '))}</div>`}
        ${full ? `<div class="info">${WW.esc(full.info)}</div>` : `<div class="info">${WW.esc(cat(c).kurz)}</div>`}
        ${kinds.length ? `<div class="badges">${kinds.map((k) => badgeFor(k, e.kinds[k], agg)).join('')}</div>` : ''}
        ${isUnknown ? `<div style="margin-top:8px"><button class="std small report" data-key="${WW.esc(e.key)}" title="Öffnet ein vorausgefülltes GitHub-Issue — du siehst vor dem Absenden genau, was gemeldet wird">Domain melden — hilft der Datenbank</button></div>` : ''}
      </div>`;
    };
    if (ents.length) {
      html += '<div class="card"><h2>Wer kontaktiert wurde</h2>';
      for (const c of WW.CATEGORY_ORDER) {
        const group = foreign.filter((e) => e.cat === c).sort((a, b) => b.count - a.count);
        if (!group.length) continue;
        const ci = cat(c);
        const isUnknown = c === 'unknown';
        html += `<div class="cathead">
            <span class="rdot ${riskClass(c)}"></span><h3>${WW.esc(ci.titel)}</h3>
            <span class="riskchip ${riskClass(c)}">${RISK_NAME[ci.risiko]}</span>
            <span class="desc">${WW.esc(ci.kurz)}</span>
            ${isUnknown && group.length > 1 ? `<button class="std small" id="report-all-unknown" title="Öffnet ein vorausgefülltes GitHub-Issue — du siehst vor dem Absenden genau, was gemeldet wird">Alle ${group.length} melden</button>` : ''}
          </div><div class="entgrid">`;
        for (const e of group) html += entCard(e, c);
        html += '</div>';
      }
      if (own.length) {
        html += `<div class="cathead">
            <span class="rdot r1"></span><h3>Anbieter dieser Seite</h3>
            <span class="riskchip r1">${RISK_NAME[1]}</span>
            <span class="desc">Diese Server gehören zum Betreiber der besuchten Seite — technisch eigene Adressen, faktisch derselbe Anbieter. Sie zählen nicht als fremde Stellen.</span>
          </div><div class="entgrid">`;
        for (const e of own) html += entCard(e, e.cat);
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<div class="card hint">Keine Verbindungen zu Drittservern beobachtet.</div>';
    }
    el.innerHTML = html;

    $$('#view-uebersicht .report').forEach((b) => b.addEventListener('click', () => reportUnknown([b.dataset.key])));
    const all = $('#report-all-unknown');
    if (all) all.addEventListener('click', () => {
      reportUnknown(Object.values(agg.entities).filter((e) => !e.known).map((e) => e.key));
    });
  };

  const badgeFor = (kind, n, agg) => {
    const g = agg.insights[kind] || (agg.insightLabels || {})[kind];
    const label = g ? g.label : kind;
    const sev = g ? g.sev : 1;
    return `<span class="badge s${sev}">${WW.esc(label)}${n > 1 ? ` ${n}×` : ''}</span>`;
  };

  // ── Anfragen ────────────────────────────────────────────────
  const reqMatches = (r) => {
    if (state.onlyTp && !r.tp) return false;
    if (state.cat && (r.entity ? r.entity.cat : 'unknown') !== state.cat) return false;
    if (state.onlyIns && !(r.insights && r.insights.length)) return false;
    if (state.search) {
      const s = state.search.toLowerCase();
      const hay = (r.host + ' ' + r.url + ' ' + (r.entity ? r.entity.name + ' ' + (r.entity.owner || '') : '')).toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  };

  const renderRequests = () => {
    const el = $('#view-anfragen');
    const d = state.data;
    if (!d) { el.innerHTML = emptyStateHtml(); wireEmptyState(el); return; }

    const rows = d.tab.requests.filter(reqMatches);
    const profi = isProfi();

    // Kategorien, die tatsächlich vorkommen
    const cats = [...new Set(d.tab.requests.map((r) => r.entity ? r.entity.cat : (r.tp ? 'unknown' : null)))].filter(Boolean);

    const prevScroll = el.querySelector('.tablewrap') ? el.querySelector('.tablewrap').scrollTop : 0;
    // Fokus/Caret des Suchfelds über den innerHTML-Neuaufbau retten
    const act = document.activeElement;
    const searchFocus = act && act.id === 'f-search'
      ? { s: act.selectionStart, e: act.selectionEnd } : null;

    let html = `<div class="card">
      <div class="toolbar">
        <input type="search" id="f-search" placeholder="Suchen (Domain, Firma, URL) …" value="${WW.esc(state.search)}">
        <select id="f-cat">
          <option value="">Alle Kategorien</option>
          ${WW.CATEGORY_ORDER.filter((c) => cats.includes(c)).map((c) => `<option value="${c}" ${state.cat === c ? 'selected' : ''}>${WW.esc(cat(c).titel)}</option>`).join('')}
        </select>
        <label class="cb"><input type="checkbox" id="f-tp" ${state.onlyTp ? 'checked' : ''}> nur Drittanbieter</label>
        <label class="cb"><input type="checkbox" id="f-ins" ${state.onlyIns ? 'checked' : ''}> nur mit Erkenntnissen</label>
        <span class="spacer"></span>
        <span class="count">${rows.length} von ${d.tab.requests.length} Anfragen</span>
        <button id="btn-copy" title="Kopiert die komplette Auswertung als JSON in die Zwischenablage">Auswertung kopieren</button>
        ${profi ? '<button id="btn-export" title="Vollständiger Export inkl. Roh-Headern und Bodys als Datei">Als Datei speichern</button>' : ''}
      </div>
      <div class="hint" style="margin-top:8px">💡 Tipp: „Auswertung kopieren" und den Text einer KI (z. B. Claude) einfügen — mit der Frage „Was verrät dieser Mitschnitt über mich?". Ein passender Fragevorschlag ist im kopierten Text schon enthalten.</div>
    </div>`;

    html += `<div class="reqlayout ${state.selectedRid ? 'split' : ''}">
      <div class="tablewrap"><table class="req"><thead><tr>
        <th>Zeit</th><th>Empfänger</th><th>Firma</th>${profi ? '<th>Typ</th><th>Methode</th><th>Status</th>' : '<th>Was passiert</th>'}<th>Erkenntnisse</th>
      </tr></thead><tbody>`;

    for (const r of rows.slice(-400)) {
      const sel = r.rid === state.selectedRid ? 'sel' : '';
      const fp = r.tp ? '' : 'firstparty';
      const insBadges = (r.insights || []).slice(0, 3).map((i) => `<span class="badge s${i.sev}">${WW.esc(i.label)}</span>`).join('');
      html += `<tr class="row ${sel}" data-rid="${WW.esc(r.rid)}">
        <td class="num">${WW.fmtTime(r.ts)}</td>
        <td class="host ${fp}" title="${WW.esc(r.url)}">${WW.esc(r.host)}</td>
        <td class="${fp}">${r.entity ? WW.esc(r.entity.name) + ((d.agg.entities[r.entity.id] || {}).sameOwner ? ' <span class="hint">(Anbieter der Seite)</span>' : '') : (r.tp ? '<span class="hint">unbekannt</span>' : '<span class="firstparty">eigene Seite</span>')}</td>
        ${profi ? `<td>${WW.esc(r.type)}</td><td>${WW.esc(r.method)}</td><td>${r.err ? `<span class="err" title="${WW.esc(r.err)}">✕</span>` : (r.status ?? '…')}</td>` : `<td>${WW.esc(WW.typeLabel(r.type, r.method))}${r.err ? ' <span class="err" title="' + WW.esc(r.err) + '">✕</span>' : ''}</td>`}
        <td>${insBadges}${(r.insights || []).length > 3 ? `<span class="badge">+${r.insights.length - 3}</span>` : ''}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';

    html += `<div class="detail" id="detail">${state.selectedRid ? '' : ''}</div></div>`;
    el.innerHTML = html;

    // Events
    $('#f-search').addEventListener('input', (e) => { state.search = e.target.value; renderRequests(); });
    $('#f-cat').addEventListener('change', (e) => { state.cat = e.target.value; renderRequests(); });
    $('#f-tp').addEventListener('change', (e) => { state.onlyTp = e.target.checked; renderRequests(); });
    $('#f-ins').addEventListener('change', (e) => { state.onlyIns = e.target.checked; renderRequests(); });
    const exp = $('#btn-export');
    if (exp) exp.addEventListener('click', exportJson);
    const cpy = $('#btn-copy');
    if (cpy) cpy.addEventListener('click', () => copyJson(cpy));
    $$('#view-anfragen tr.row').forEach((tr) => tr.addEventListener('click', () => {
      state.selectedRid = tr.dataset.rid === state.selectedRid ? null : tr.dataset.rid;
      renderRequests();
    }));

    const wrap = el.querySelector('.tablewrap');
    if (wrap) wrap.scrollTop = prevScroll;
    if (searchFocus) {
      const inp = $('#f-search');
      inp.focus();
      try { inp.setSelectionRange(searchFocus.s, searchFocus.e); } catch (e) { /* egal */ }
    }
    if (state.selectedRid) renderDetail();
  };

  const paramRows = (params, knownFirst) => {
    const withMeta = params.map(({ k, v }) => {
      const label = WW.paramLabel(k);
      const dec = String(WW.tryDecodeValue(v));
      return { k, v: dec, label };
    });
    if (knownFirst) withMeta.sort((a, b) => (b.label ? 1 : 0) - (a.label ? 1 : 0));
    return withMeta.map((p) => `<tr class="${p.label ? 'known' : ''}">
      <td class="lbl ${p.label ? '' : 'none'}">${WW.esc(p.label || '—')}</td>
      <td class="k">${WW.esc(p.k)}</td>
      <td class="v">${WW.esc(WW.cap(p.v, 300))}</td>
    </tr>`).join('');
  };

  const renderDetail = () => {
    const box = $('#detail');
    if (!box || !state.data) return;
    const r = state.data.tab.requests.find((x) => x.rid === state.selectedRid);
    if (!r) { box.innerHTML = ''; return; }
    const profi = isProfi();
    const full = r.entity ? WW.entityById(r.entity.id) : null;
    const c = cat(r.entity ? r.entity.cat : 'unknown');

    let html = `<div class="card">
      <h2>${WW.esc(r.host)}</h2>
      <div class="url">${WW.esc(r.url)}</div>
      <div class="meta">
        <span class="chip">${profi ? WW.esc(r.method) + ' · ' + WW.esc(r.type) : WW.esc(WW.typeLabel(r.type, r.method))}</span>
        <span class="chip">${WW.fmtTime(r.ts)}</span>
        ${r.tp ? `<span class="chip">Drittanbieter</span>` : '<span class="chip">eigene Seite</span>'}
        ${r.err ? `<span class="chip err">${WW.esc(r.err)}</span>` : (r.status ? `<span class="chip">Status ${r.status}${r.fromCache ? ' (Cache)' : ''}</span>` : '')}
        ${profi && r.size != null ? `<span class="chip">${WW.fmtBytes(r.size)}</span>` : ''}
        ${profi && r.respType ? `<span class="chip">${WW.esc(r.respType)}</span>` : ''}
      </div>`;

    if (r.tp) {
      html += `<h3>Empfänger</h3>
        <div class="entinfo">
          <span class="rdot ${riskClass(c === WW.CATEGORIES.unknown ? 'unknown' : (r.entity ? r.entity.cat : 'unknown'))}"></span>
          <b>${WW.esc(r.entity ? r.entity.name : r.base)}</b>
          ${r.entity && r.entity.owner ? ` — gehört zu ${WW.esc(r.entity.owner)}` : ''}
          · Kategorie: ${WW.esc(c.titel)}
          ${full ? `<div style="margin-top:4px">${WW.esc(full.info)}</div>` : ''}
        </div>`;
    }

    if (r.insights && r.insights.length) {
      html += '<h3>Erkenntnisse</h3><div class="inslist">';
      for (const i of r.insights) {
        html += `<div class="ins"><span class="rdot ${i.sev >= 3 ? 'r3' : i.sev === 2 ? 'r2' : 'r1'}"></span>
          <div><b>${WW.esc(i.label)}</b>${i.detail ? `<div class="det">${WW.esc(i.detail)}</div>` : ''}</div></div>`;
      }
      html += '</div>';
    }

    const q = r.query || [];
    const bp = (r.body && r.body.params) || [];
    if (q.length || bp.length) {
      html += `<h3>Übertragene Daten <small class="hint">(${q.length + bp.length} Felder)</small></h3>
        <table class="params"><thead><tr><th>Bedeutung</th><th>Feld</th><th>Wert</th></tr></thead><tbody>`;
      html += paramRows(q.concat(bp), true);
      html += '</tbody></table>';
    } else if (!r.body || r.body.kind !== 'binary') {
      html += '<p class="hint" style="margin-top:8px">Keine auslesbaren Datenfelder in dieser Anfrage — übertragen wurden trotzdem automatisch: deine IP-Adresse, die Zieladresse und Browser-Kennungen.</p>';
    }

    if (r.body && r.body.kind === 'binary') {
      html += `<p class="hint" style="margin-top:8px">Der Inhalt dieser Anfrage ist binär/komprimiert (${WW.fmtBytes(r.body.bytes)}) und lässt sich nicht als Text anzeigen.</p>`;
    }

    if (profi) {
      if (r.reqHeaders && r.reqHeaders.length) {
        html += `<details><summary>Anfrage-Header (${r.reqHeaders.length})</summary>
          <pre class="raw">${WW.esc(r.reqHeaders.map((h) => h.name + ': ' + h.value).join('\n'))}</pre></details>`;
      }
      if (r.body && r.body.text) {
        html += `<details><summary>Roh-Inhalt (Body, ${r.body.kind})</summary>
          <pre class="raw">${WW.esc(r.body.text)}</pre></details>`;
      }
    }

    html += '</div>';
    box.innerHTML = html;
  };

  // Export mit deutschen Feldnamen und eingebautem Erklärtext, damit auch
  // eine KI (oder ein Mensch) ohne Vorwissen etwas damit anfangen kann.
  // compact=true lässt Roh-Header/Bodys weg — für die Zwischenablage.
  const exportData = (full) => {
    const d = state.data;
    const anfr = d.tab.requests.map((r) => {
      const o = {
        zeit: new Date(r.ts).toISOString(),
        host: r.host,
        url: WW.cap(r.url, full ? 2000 : 300),
        methode: r.method,
        typ: r.type,
        drittanbieter: !!r.tp,
      };
      if (r.entity) {
        o.firma = r.entity.name;
        if (r.entity.owner) o.konzern = r.entity.owner;
        o.kategorie = cat(r.entity.cat).titel;
        const ent = d.agg.entities[r.entity.id];
        if (ent && ent.sameOwner) o.gehoert_zum_seitenanbieter = true;
      } else if (r.tp) {
        o.firma = 'unbekannt (' + (r.base || r.host) + ')';
      }
      if (r.status) o.status = r.status;
      if (r.err) o.fehler = r.err;
      const ins = (r.insights || []).map((i) => i.label + (i.detail ? ' — ' + i.detail : ''));
      if (ins.length) o.erkenntnisse = ins;
      const params = [...(r.query || []), ...((r.body && r.body.params) || [])];
      if (params.length) {
        o.daten = params.slice(0, full ? 80 : 40).map((p) => {
          const label = WW.paramLabel(p.k);
          const row = { feld: p.k };
          if (label) row.bedeutung = label;
          row.wert = WW.cap(String(WW.tryDecodeValue(p.v)), full ? 500 : 200);
          return row;
        });
      }
      if (full) {
        if (r.reqHeaders) o.header = r.reqHeaders.map((h) => h.name + ': ' + h.value);
        if (r.body && r.body.text) o.body_roh = r.body.text;
      }
      return o;
    });
    return {
      hinweis: 'Datenspur-Mitschnitt: alle Verbindungen, die der Browser beim Besuch dieser Seite aufgebaut hat — wohin sie gingen, wem die Gegenstelle gehört und welche Daten mitgeschickt wurden. Diesen Text kann man z. B. einer KI geben und sich erklären lassen, was er bedeutet.',
      frage_vorschlag: 'Bitte erkläre mir verständlich: Was verrät dieser Mitschnitt über mich, welche Firmen bekommen dabei Daten, wozu vermutlich — und was davon ist bedenklich?',
      exportiert: new Date().toISOString(),
      seite: d.tab.pageUrl,
      bewertung: {
        ampel: d.score.level,
        zusammenfassung: d.score.satz,
        fremde_stellen: d.score.entTotal,
        dienste_des_seitenanbieters: d.score.ownTotal || 0,
      },
      anfragen: anfr,
    };
  };

  const exportJson = () => {
    if (!state.data) return;
    const blob = new Blob([JSON.stringify(exportData(true), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'datenspur-' + (state.data.tab.pageHost || 'export') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const copyJson = async (btn) => {
    if (!state.data) return;
    const text = JSON.stringify(exportData(false), null, 1);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      // Fallback ohne Clipboard-API (z. B. fehlende Berechtigung)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { /* ok bleibt false */ }
      ta.remove();
    }
    const prev = btn.textContent;
    btn.textContent = ok ? '✓ Kopiert — jetzt z. B. einer KI geben' : 'Kopieren fehlgeschlagen';
    setTimeout(() => { btn.textContent = prev; }, 3000);
  };

  // ── Netzwerk-Graph ──────────────────────────────────────────
  const renderGraph = () => {
    const el = $('#view-netzwerk');
    const d = state.data;
    if (!d) { el.innerHTML = emptyStateHtml(); wireEmptyState(el); return; }
    const ents = Object.values(d.agg.entities).sort((a, b) => b.count - a.count);
    const fpCount = d.tab.requests.filter((r) => !r.tp).length;
    const MAX_NODES = 24;
    const shown = [];
    // Eigene Seite als erster Knoten — sie gehört mit ins Bild
    if (fpCount) {
      shown.push({ key: '__fp__', fp: true, name: d.tab.pageBase || d.tab.pageHost || 'eigene Seite', count: fpCount });
    }
    for (const e of ents.slice(0, MAX_NODES)) shown.push(e);
    const rest = ents.length - Math.min(ents.length, MAX_NODES);
    if (!shown.length) {
      el.innerHTML = '<div class="card hint">Noch keine Verbindungen aufgezeichnet — nichts zu zeichnen.</div>';
      return;
    }

    const W = 960, H = 640, cx = W / 2, cy = H / 2;
    const maxCount = Math.max(...shown.map((e) => e.count));
    const RISK_FILL = { 1: 'var(--good)', 2: 'var(--warn)', 3: 'var(--crit)' };

    let nodes = '';
    let edges = '';
    shown.forEach((e, i) => {
      const angle = (i / shown.length) * 2 * Math.PI - Math.PI / 2;
      // zwei Ringe, damit Beschriftungen nicht kollidieren
      const ring = shown.length > 12 && i % 2 === 1 ? 285 : 215;
      const x = cx + ring * Math.cos(angle);
      const y = cy + ring * Math.sin(angle);
      const r = 9 + Math.sqrt(e.count / maxCount) * 14;
      const sw = 1 + Math.min(5, Math.log2(e.count + 1));
      const fill = (e.fp || e.sameOwner) ? 'var(--accent)' : RISK_FILL[cat(e.cat).risiko];
      edges += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--edge)" stroke-width="${sw.toFixed(1)}" opacity="0.55"/>`;
      const label = WW.cap(e.name, 22);
      const sub = e.fp ? `eigene Seite · ${anfragen(e.count)}`
        : e.sameOwner ? `Anbieter der Seite · ${anfragen(e.count)}` : anfragen(e.count);
      const tip = e.fp
        ? `${e.name} — Server der besuchten Seite selbst\n${anfragen(e.count)}`
        : `${e.name}${e.owner ? ' — ' + e.owner : ''}${e.sameOwner ? ' (Anbieter dieser Seite)' : ''}\n${cat(e.cat).titel} · ${anfragen(e.count)}${e.cookies ? ' · Cookies gesendet' : ''}`;
      nodes += `<g class="node" data-key="${WW.esc(e.key)}" style="cursor:pointer">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="var(--surface)" stroke-width="2"/>
        <text x="${x.toFixed(1)}" y="${(y + r + 14).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--ink)">${WW.esc(label)}</text>
        <text x="${x.toFixed(1)}" y="${(y + r + 27).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${WW.esc(sub)}</text>
        <title>${WW.esc(tip)}</title>
      </g>`;
    });

    const host = WW.cap(d.tab.pageHost || '?', 28);
    el.innerHTML = `<div class="card">
      <h2>Wohin diese Seite Verbindungen aufbaut <small>— Größe = Anzahl Anfragen, Farbe = Risiko der Kategorie. Klick auf einen Punkt zeigt die Anfragen.</small></h2>
      <div class="graphwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Netzwerk-Karte der Drittanbieter-Verbindungen">
        ${edges}
        <g><circle cx="${cx}" cy="${cy}" r="46" fill="var(--accent)"/>
          <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">${WW.esc(host)}</text>
        </g>
        ${nodes}
      </svg></div>
      <div class="legend">
        <span class="item"><span class="rdot" style="background:var(--accent)"></span> Seite &amp; ihr Anbieter</span>
        <span class="item"><span class="rdot r3"></span> hohes Risiko</span>
        <span class="item"><span class="rdot r2"></span> mittleres Risiko</span>
        <span class="item"><span class="rdot r1"></span> geringes Risiko</span>
        <span class="item">Linienstärke = Anfragen</span>
        ${rest > 0 ? `<span class="item hint">+ ${rest} weitere Stellen (siehe Übersicht)</span>` : ''}
      </div>
    </div>`;

    $$('#view-netzwerk .node').forEach((g) => g.addEventListener('click', () => {
      const e = shown.find((x) => x.key === g.dataset.key);
      if (!e) return;
      if (e.fp) {
        state.search = d.tab.pageBase || '';
        state.onlyTp = false;
      } else {
        state.search = e.name;
        state.onlyTp = true;
      }
      setView('anfragen');
    }));
  };

  // ── Lexikon ─────────────────────────────────────────────────
  const renderLexikon = () => {
    if (state.lexikonRendered) return;
    state.lexikonRendered = true;
    const el = $('#view-lexikon');
    let html = `<div class="lex">
      <div class="card"><h2>${WW.esc(WW.LEXIKON_INTRO.titel)}</h2><p>${WW.esc(WW.LEXIKON_INTRO.text)}</p></div>`;

    html += '<div class="card"><h2>Die Kategorien</h2>';
    for (const c of WW.CATEGORY_ORDER) {
      const ci = cat(c);
      html += `<div class="cathead" style="margin-top:16px">
          <span class="rdot ${riskClass(c)}"></span><h3>${WW.esc(ci.titel)}</h3>
          <span class="riskchip ${riskClass(c)}">${RISK_NAME[ci.risiko]}</span>
        </div><p>${WW.esc(ci.lang)}</p>`;
    }
    html += '</div>';

    html += '<div class="card"><h2>Glossar</h2><dl class="glos">';
    for (const g of WW.GLOSSAR) {
      html += `<dt>${WW.esc(g.begriff)}</dt><dd>${WW.esc(g.text)}</dd>`;
    }
    html += '</dl></div>';

    html += `<div class="card"><h2>Über Datenspur — und seine Grenzen</h2>
      <p>Datenspur zeigt, welche Verbindungen dein Browser beim Besuch einer Seite aufbaut und welche Daten dabei abgeschickt werden. Alles bleibt lokal in deinem Browser; Datenspur selbst baut keine eigenen Verbindungen auf und blockiert nichts — es macht nur sichtbar.</p>
      <p>Grenzen: Datenspur sieht nur ausgehende Daten, nicht was der Empfänger damit macht. Die Firmen-Datenbank ist kuratiert und unvollständig — „unbekannt" heißt nur: nicht in der Datenbank. Verschlüsselte oder komprimierte Inhalte lassen sich nicht als Text darstellen. Anfragen anderer Browser-Erweiterungen und Systemdienste erscheinen nicht. Und: Was du siehst, hängt stark von deiner Cookie-Banner-Entscheidung und installierten Blockern ab — dieselbe Seite kann bei anderen Menschen ganz anders aussehen.</p>
      <p><b>Redaktioneller Hinweis:</b> Firmen-Zuordnungen und Beschreibungen beruhen auf öffentlich zugänglichen Quellen (Registrierungsdaten, DNS, Zertifikate, Selbstbeschreibungen der Dienste, offene Datensätze); Kategorien und Risiko-Einstufungen sind redaktionelle Bewertungen. Stand: ${WW.esc(WW.DB_STAND)}. Falsche Angaben korrigieren wir nach Prüfung umgehend.</p>
      <p>
        <a href="https://github.com/kreasteve/datenspur" target="_blank" rel="noopener">Quellcode (GitHub)</a> ·
        <a href="https://github.com/kreasteve/datenspur/blob/main/KORREKTUREN.md" target="_blank" rel="noopener">Korrekturen &amp; Hinweise für betroffene Unternehmen</a> ·
        <a href="https://kreasteve.de/impressum.html" target="_blank" rel="noopener">Impressum</a>
      </p>
    </div></div>`;
    el.innerHTML = html;
  };

  // ── Ansichten & Modus ───────────────────────────────────────
  const renderView = () => {
    if (state.view === 'uebersicht') renderOverview();
    else if (state.view === 'anfragen') renderRequests();
    else if (state.view === 'netzwerk') renderGraph();
    else if (state.view === 'lexikon') renderLexikon();
  };

  const setView = (v) => {
    state.view = v;
    $$('.views button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
    renderView();
  };

  const setMode = (m) => {
    state.mode = m;
    $('#mode-laie').classList.toggle('active', m === 'laie');
    $('#mode-profi').classList.toggle('active', m === 'profi');
    B.storage.local.set({ ds_mode: m }).catch(() => {});
    renderView();
  };

  // ── Tab-Auswahl (wenn ohne ?tab= geöffnet) ──────────────────
  const showPicker = async () => {
    const picker = $('#picker');
    picker.hidden = false;
    let tabs = [];
    try {
      const resp = await B.runtime.sendMessage({ type: 'listTabs' });
      tabs = (resp && resp.tabs) || [];
    } catch (e) { /* leer lassen */ }
    tabs.sort((a, b) => b.startedAt - a.startedAt);
    picker.innerHTML = `<div class="box">
      <h2>Welchen Tab möchtest du ansehen?</h2>
      ${tabs.length ? '' : '<p class="hint">Noch keine beobachteten Tabs. Öffne eine Website und lade sie neu (F5) — dann taucht sie hier auf.</p>'}
      ${tabs.map((t) => `<div class="row" data-tab="${t.tabId}">
        <span class="host">${WW.esc(t.pageHost || t.pageUrl || 'Tab ' + t.tabId)}</span>
        <span class="cnt">${anfragen(t.requests)}</span>
      </div>`).join('')}
      ${state.tabId != null ? '<div style="margin-top:12px"><button class="std" id="picker-close">Schließen</button></div>' : ''}
    </div>`;
    $$('#picker .row').forEach((row) => row.addEventListener('click', () => {
      location.search = '?tab=' + row.dataset.tab;
    }));
    const close = $('#picker-close');
    if (close) close.addEventListener('click', () => { picker.hidden = true; });
  };

  // ── Start ───────────────────────────────────────────────────
  const init = async () => {
    const stored = await B.storage.local.get(['ds_mode', 'ds_reset_on_reload']).catch(() => ({}));
    if (stored && stored.ds_mode === 'profi') setMode('profi');

    const setReload = $('#set-reload');
    setReload.checked = !(stored && stored.ds_reset_on_reload === false);
    setReload.addEventListener('change', () => {
      B.storage.local.set({ ds_reset_on_reload: setReload.checked }).catch(() => {});
    });
    $('#btn-reset-dash').addEventListener('click', async () => {
      if (state.tabId == null) return;
      await B.runtime.sendMessage({ type: 'reset', tabId: state.tabId });
      state.selectedRid = null;
      fetchData(true);
    });

    $$('.views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#mode-laie').addEventListener('click', () => setMode('laie'));
    $('#mode-profi').addEventListener('click', () => setMode('profi'));

    const params = new URLSearchParams(location.search);
    const t = parseInt(params.get('tab'), 10);
    if (isNaN(t)) { showPicker(); return; }
    state.tabId = t;

    B.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'ww:update' && msg.tabId === state.tabId) fetchData(false);
    });
    await fetchData(true);
    setInterval(() => fetchData(false), 2500);
  };

  init();
})();
