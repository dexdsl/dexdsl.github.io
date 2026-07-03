(function () {
  "use strict";

  // Dex → Google Ads offline-conversion bridge (COOKIELESS).
  //
  // Purpose: give the Ad Grants account a real, server-verified "account
  // sign-up" conversion without reintroducing GA4 or any tracking cookie.
  //
  // Flow (see notes/google-ads-conversion-pipeline for the full picture):
  //   1. Ad click lands on the site with ?gclid=... (Google auto-tagging).
  //      We stash that click id in first-party localStorage — NOT a cookie —
  //      for the 90-day conversion window. It survives the Auth0 round trip
  //      because localStorage is per-origin and Auth0 is a separate origin.
  //   2. When the user completes auth and returns, we POST the click id to the
  //      dex-api worker (authenticated with the token the SPA already holds).
  //   3. The worker decides whether it's a genuine NEW signup (authoritative,
  //      deduped by sub) and later uploads it to Google Ads. No client tag.
  //
  // This file only READS the public DEX_AUTH API + localStorage, so it cannot
  // affect the auth runtime.

  if (window.__DEX_ADS_ACTIVE__) return;
  window.__DEX_ADS_ACTIVE__ = true;

  var STORAGE_KEY = "dx.ads.click";          // { id, kind, ts }
  var REPORTED_PREFIX = "dx.ads.reported.";  // + sub -> "1"
  var CLICK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // Google click window
  var API_BASE = "https://dex-api.spring-fog-8edd.workers.dev";
  var ENDPOINT = "/me/ads-conversion";
  var inflight = Object.create(null);

  function lget(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function nowIso() { return new Date().toISOString(); }

  // 1. Capture the Google click id from the landing URL (gclid, or the
  //    privacy-preserving gbraid/wbraid variants) into first-party storage.
  function captureClickId() {
    var qs;
    try { qs = new URLSearchParams(window.location.search); } catch (e) { return; }
    var gclid = qs.get("gclid");
    var gbraid = qs.get("gbraid");
    var wbraid = qs.get("wbraid");
    var id = gclid || gbraid || wbraid;
    if (!id) return;
    var kind = gclid ? "gclid" : (gbraid ? "gbraid" : "wbraid");
    lset(STORAGE_KEY, JSON.stringify({ id: id, kind: kind, ts: nowIso() }));
  }

  function storedClick() {
    var raw = lget(STORAGE_KEY);
    if (!raw) return null;
    var rec;
    try { rec = JSON.parse(raw); } catch (e) { return null; }
    if (!rec || !rec.id) return null;
    var age = Date.now() - Date.parse(rec.ts || "");
    if (isFinite(age) && age > CLICK_TTL_MS) return null;
    return rec;
  }

  // 2. On authenticated state, report the click id once per user. The worker
  //    is the source of truth for "is this actually a new signup", so we can
  //    safely send for any authed user that arrived via an ad; it just no-ops
  //    server-side for returning accounts.
  function report(state) {
    if (!state || !state.isAuthenticated) return;
    var user = state.user || {};
    var sub = user.sub || user.user_id || user.email;
    if (!sub) return;
    if (lget(REPORTED_PREFIX + sub) === "1") return; // already sent from this browser
    if (inflight[sub]) return;                        // in-flight this page load

    var click = storedClick();
    if (!click) return; // no ad click to attribute → nothing to report

    var auth = window.DEX_AUTH || window.dexAuth;
    if (!auth || typeof auth.getAccessToken !== "function") return;

    inflight[sub] = true;
    Promise.resolve(auth.getAccessToken())
      .then(function (token) {
        if (!token) { delete inflight[sub]; return; }
        return fetch(API_BASE + ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + token
          },
          keepalive: true, // survive the callback's location.replace()
          body: JSON.stringify({
            clickId: click.id,
            clickIdType: click.kind,
            clickTs: click.ts,
            conversionTs: nowIso(),
            page: window.location.pathname
          })
        }).then(function (res) {
          // 2xx = recorded; 409 = worker already has this sub → done either way.
          if (res && (res.ok || res.status === 409)) {
            lset(REPORTED_PREFIX + sub, "1");
          } else {
            delete inflight[sub]; // transient failure — let a later event retry
          }
        });
      })
      .catch(function () { delete inflight[sub]; });
  }

  captureClickId();

  var auth = window.DEX_AUTH || window.dexAuth;
  if (auth && auth.ready && typeof auth.ready.then === "function") {
    auth.ready.then(report).catch(function () {});
  }
  // Also catch auth resolving/changing after this script runs (soft-nav, delayed session).
  window.addEventListener("dex-auth:ready", function (e) { report(e && e.detail); });
  window.addEventListener("dex-auth:state", function (e) { report(e && e.detail); });
})();
