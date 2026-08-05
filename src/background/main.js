'use strict';
// Hintergrund-Hauptmodul: Nachrichten von Popup/Dashboard beantworten,
// Badge pflegen, Tab-Lebenszyklus aufräumen.
globalThis.WW = globalThis.WW || {};

(() => {
  const B = WW.B;
  if (!B || !B.runtime) return; // Node-Testharness

  // Eine zuvor im Dashboard nachgeladene Tracker-Liste einspielen. Kein
  // Netzzugriff — gelesen wird nur, was lokal gespeichert ist.
  if (WW.dbUpdate) {
    WW.dbUpdate.ausStorage().catch(() => {});
    if (B.storage && B.storage.onChanged) {
      B.storage.onChanged.addListener((aenderungen, bereich) => {
        if (bereich === 'local' && aenderungen[WW.dbUpdate.KEY]) WW.dbUpdate.ausStorage().catch(() => {});
      });
    }
  }

  // Nach jedem Flush: Badge (Anzahl kontaktierter Drittfirmen, Farbe nach
  // Ampel) und offene UI-Seiten benachrichtigen.
  WW.store.onFlush = (tabId, tab) => {
    const agg = WW.computeAgg(tab);
    const score = WW.scoreTab(agg);
    // Achtung: In Firefox MV2 geben die Badge-Setter undefined zurück
    // (kein Promise) — deshalb Promise.resolve-Wrapper statt direktem .catch.
    if (WW.action && WW.action.setBadgeText) {
      const n = score.entTotal;
      try {
        Promise.resolve(WW.action.setBadgeText({ tabId, text: n > 0 ? String(n) : '' })).catch(() => {});
        if (WW.action.setBadgeBackgroundColor) {
          Promise.resolve(WW.action.setBadgeBackgroundColor({ tabId, color: WW.LEVEL_INFO[score.level].farbe })).catch(() => {});
        }
      } catch (e) { /* Tab evtl. schon geschlossen */ }
    }
    B.runtime.sendMessage({ type: 'ww:update', tabId }).catch(() => {});
  };

  const handlers = {
    async getSummary({ tabId }) {
      const tab = await WW.store.getTab(tabId);
      if (!tab) return { tab: null };
      const agg = WW.computeAgg(tab);
      return {
        tab: { tabId: tab.tabId, pageUrl: tab.pageUrl, pageHost: tab.pageHost, startedAt: tab.startedAt, ver: tab.ver, requests: tab.requests.length, dropped: tab.dropped },
        agg,
        score: WW.scoreTab(agg),
      };
    },
    async getTab({ tabId }) {
      const tab = await WW.store.getTab(tabId);
      if (!tab) return { tab: null };
      const agg = WW.computeAgg(tab);
      return { tab, agg, score: WW.scoreTab(agg) };
    },
    async listTabs() {
      return { tabs: await WW.store.listTabs() };
    },
    async reset({ tabId }) {
      const tab = await WW.store.getTab(tabId);
      WW.store.resetTab(tabId, tab ? tab.pageUrl : '');
      return { ok: true };
    },
    async openDashboard({ tabId }) {
      await B.tabs.create({ url: B.runtime.getURL('dashboard/dashboard.html') + '?tab=' + tabId });
      return { ok: true };
    },
  };

  B.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const h = msg && handlers[msg.type];
    if (!h) return false;
    h(msg).then(sendResponse, (e) => sendResponse({ error: String(e && e.message || e) }));
    return true; // asynchrone Antwort
  });

  if (B.tabs && B.tabs.onRemoved) {
    B.tabs.onRemoved.addListener((tabId) => WW.store.removeTab(tabId));
  }
})();
