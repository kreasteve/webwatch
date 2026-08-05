'use strict';
// Erfassung: webRequest-Listener, die jede Anfrage einer Seite mitschreiben,
// dekodieren und analysieren. Es wird NICHTS blockiert oder verändert.
globalThis.WW = globalThis.WW || {};

(() => {
  const B = WW.B;
  if (!B || !B.webRequest) return; // z. B. im Node-Testharness

  const FILTER = { urls: ['<all_urls>'] };
  const MAX_HEADERS = 48;
  const pending = new Map(); // requestId → rec

  const prunePending = () => {
    if (pending.size <= 3000) return;
    let i = 0;
    for (const k of pending.keys()) {
      pending.delete(k);
      if (++i >= 1500) break;
    }
  };

  const skip = (d) => d.tabId < 0 || !/^(https?|wss?):/i.test(d.url);

  const slimEntity = (ent) => ent ? { id: ent.id, name: ent.name, owner: ent.owner, cat: ent.cat } : null;

  const mkRec = (d, tab) => {
    const host = WW.domain.getHost(d.url);
    let path = '';
    try { path = new URL(d.url).pathname; } catch (e) { /* egal */ }
    const rec = {
      rid: d.requestId,
      ts: d.timeStamp || Date.now(),
      url: WW.cap(d.url, 2000),
      host,
      base: WW.domain.getBaseDomain(host),
      method: d.method || 'GET',
      type: d.type,
      tp: d.type === 'main_frame' ? false : WW.domain.isThirdParty(host, tab.pageBase),
      entity: slimEntity(WW.classifyHost(host, path)),
      query: WW.parseQuery(d.url),
      body: WW.decodeRequestBody(d.requestBody),
      reqHeaders: null,
      referer: null,
      cookieCount: 0,
      cookieNames: [],
      status: null,
      err: null,
      fromCache: false,
      respType: null,
      size: null,
      insights: [],
    };
    rec.insights = WW.analyzeRequest(rec, { url: tab.pageUrl, base: tab.pageBase });
    return rec;
  };

  B.webRequest.onBeforeRequest.addListener((d) => {
    if (skip(d)) return;
    if (d.type === 'main_frame') {
      // Von der Seite selbst ausgelöste Navigationen (Chrome: initiator,
      // Firefox: originUrl/documentUrl) sind kein Neuladen durch den Nutzer —
      // etwa der Reload, den ein Cookie-Banner nach dem Zustimmen auslöst.
      const vonSeite = !!(d.initiator || d.originUrl || d.documentUrl);
      WW.store.onMainFrame(d.tabId, d.url, vonSeite);
    }
    const tab = WW.store.getOrCreateTab(d.tabId, d.type === 'main_frame' ? d.url : undefined);
    const rec = mkRec(d, tab);
    WW.store.addRequest(d.tabId, rec);
    pending.set(d.requestId, rec);
    prunePending();
  }, FILTER, ['requestBody']);

  // extraHeaders (nur Chrome): ohne diese Option sind Cookie/Referer
  // in den Header-Listen nicht enthalten.
  const withExtra = (base, enumObj) => {
    try {
      if (enumObj && Object.values(enumObj).includes('extraHeaders')) return base.concat('extraHeaders');
    } catch (e) { /* Firefox */ }
    return base;
  };

  B.webRequest.onBeforeSendHeaders.addListener((d) => {
    if (skip(d)) return;
    const rec = pending.get(d.requestId);
    if (!rec) return; // z. B. nach Service-Worker-Neustart
    const tab = WW.store.getOrCreateTab(d.tabId);
    if (d.requestHeaders) {
      rec.reqHeaders = d.requestHeaders.slice(0, MAX_HEADERS).map((h) => ({
        name: WW.cap(h.name, 80),
        value: WW.cap(h.value || '', 400),
      }));
      for (const h of d.requestHeaders) {
        const n = String(h.name).toLowerCase();
        if (n === 'cookie' && h.value) {
          const parts = h.value.split(';').map((s) => s.trim()).filter(Boolean);
          rec.cookieCount = parts.length;
          rec.cookieNames = parts.slice(0, 12).map((p) => p.split('=')[0]);
        } else if (n === 'referer' && h.value) {
          rec.referer = WW.cap(h.value, 500);
        }
      }
    }
    rec.insights = WW.analyzeRequest(rec, { url: tab.pageUrl, base: tab.pageBase });
    WW.store.touch(d.tabId);
  }, FILTER, withExtra(['requestHeaders'], B.webRequest.OnBeforeSendHeadersOptions));

  B.webRequest.onCompleted.addListener((d) => {
    if (skip(d)) return;
    const rec = pending.get(d.requestId);
    pending.delete(d.requestId);
    if (!rec) return;
    rec.status = d.statusCode;
    rec.fromCache = !!d.fromCache;
    if (d.responseHeaders) {
      for (const h of d.responseHeaders) {
        const n = String(h.name).toLowerCase();
        if (n === 'content-type') rec.respType = WW.cap((h.value || '').split(';')[0], 60);
        if (n === 'content-length') { const v = parseInt(h.value, 10); if (!isNaN(v)) rec.size = v; }
      }
      const setCookieIns = WW.analyzeResponse(rec, d.responseHeaders);
      if (setCookieIns && !rec.insights.some((i) => i.kind === 'set-cookie')) {
        rec.insights.push(setCookieIns);
        rec.insights.sort((a, b) => b.sev - a.sev);
      }
    }
    WW.store.touch(d.tabId);
  }, FILTER, withExtra(['responseHeaders'], B.webRequest.OnCompletedOptions));

  B.webRequest.onErrorOccurred.addListener((d) => {
    if (skip(d)) return;
    const rec = pending.get(d.requestId);
    pending.delete(d.requestId);
    if (!rec) return;
    rec.err = WW.cap(d.error || 'Fehler', 120);
    if (/BLOCKED|NS_ERROR_ABORT/i.test(rec.err)) {
      rec.insights.push({
        kind: 'blocked', sev: 1,
        label: 'Verbindung kam nicht zustande (blockiert oder abgebrochen)',
        detail: rec.err,
      });
    }
    WW.store.touch(d.tabId);
  }, FILTER);
})();
