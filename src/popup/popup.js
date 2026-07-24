'use strict';
// Popup: Kurzüberblick für den aktiven Tab.
(() => {
  const B = WW.B;
  let tabId = null;
  let timer = null;

  const $ = (sel) => document.querySelector(sel);

  const riskClass = (cat) => {
    const c = WW.CATEGORIES[cat] || WW.CATEGORIES.unknown;
    return 'r' + c.risiko;
  };

  const render = (data) => {
    const main = $('#main');
    if (!data || !data.tab) {
      main.innerHTML = '<div class="empty">Noch keine Daten für diesen Tab.<br>Lade die Seite neu (F5), um die Aufzeichnung zu starten.</div>';
      return;
    }
    const { tab, agg, score } = data;
    $('#host').textContent = tab.pageHost || '';

    const info = WW.LEVEL_INFO[score.level];
    const ents = Object.values(agg.entities)
      .sort((a, b) => (!!a.sameOwner - !!b.sameOwner) || (b.maxSev - a.maxSev) || (b.count - a.count));
    const catTitle = (c) => (WW.CATEGORIES[c] || WW.CATEGORIES.unknown).titel;

    let html = `
      <div class="ampel">
        <div class="dot" style="background:${info.farbe}"></div>
        <div><h2>${WW.esc(info.titel)}</h2><p>${WW.esc(score.satz)}</p></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${tab.requests}</b><span>Anfragen</span></div>
        <div class="stat"><b>${agg.tpForeign}</b><span>an fremde Server</span></div>
        <div class="stat"><b>${score.entTotal}</b><span>fremde Stellen</span></div>
      </div>`;

    if (ents.length) {
      html += '<div class="entlist"><h3>Wer wurde kontaktiert</h3>';
      for (const e of ents.slice(0, 6)) {
        html += `<div class="ent">
          <span class="rdot ${e.sameOwner ? 'r1' : riskClass(e.cat)}"></span>
          <span class="name" title="${WW.esc(e.name)}${e.owner ? ' — ' + WW.esc(e.owner) : ''}">${WW.esc(e.name)}</span>
          <span class="cat">${e.sameOwner ? 'Anbieter der Seite' : WW.esc(catTitle(e.cat))}</span>
          <span class="cnt">${e.count}×</span>
        </div>`;
      }
      if (ents.length > 6) html += `<div class="more">… und ${ents.length - 6} weitere — Details im Dashboard</div>`;
      html += '</div>';
    }
    main.innerHTML = html;
  };

  const refresh = async () => {
    if (tabId == null) return;
    try {
      const data = await B.runtime.sendMessage({ type: 'getSummary', tabId });
      render(data);
    } catch (e) { /* Hintergrund noch nicht bereit */ }
  };

  const init = async () => {
    const tabs = await B.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) return;
    tabId = tabs[0].id;

    $('#btn-dash').addEventListener('click', () => {
      B.runtime.sendMessage({ type: 'openDashboard', tabId });
      window.close();
    });
    $('#btn-reset').addEventListener('click', async () => {
      await B.runtime.sendMessage({ type: 'reset', tabId });
      refresh();
    });

    B.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'ww:update' && msg.tabId === tabId) refresh();
    });

    await refresh();
    timer = setInterval(refresh, 1500);
    window.addEventListener('unload', () => clearInterval(timer));
  };

  init();
})();
