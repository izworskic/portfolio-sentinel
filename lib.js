// portfolio-sentinel-v2 shared config and helpers.
// Rule: no em dash characters anywhere in this codebase, including strings.

const SUPABASE_URL = "https://juqexesnmfmozxtpqxkh.supabase.co";
const SUPABASE_KEY = "sb_publishable_tXBPOHtWcy4Nqyd7Ivu3Ew_VCUJ-OeT";
const INDEXNOW_KEY = "b1be9ee40d264668af173e98e30188bf";
const EM_DASH = "\u2014";
const STALE_HOURS = 48;

// cadence: "daily" gets the staleness check every sweep.
// "seasonal" gets it only inside its window [startMMDD, endMMDD].
// "static" is hash-tracked but never flagged stale.
// urlCap defaults to 60 in api/sweep.js. Any property whose sitemap outgrows its
// cap is silently only partly checked, and the sweep reports that as "info" rather
// than a problem. Caps below are set above the current sitemap size with headroom.
// If a sweep logs "sitemap has N URLs, checking first M", raise the cap here.
const PROPERTIES = [
  { id: "trout-main",        host: "michigantroutreport.com",          sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 160 },
  { id: "trout-daily",       host: "daily.michigantroutreport.com",    sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 140 },
  { id: "birding",           host: "michiganbirdingreport.com",        sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 140 },
  { id: "birding-daily",     host: "daily.michiganbirdingreport.com",  sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 140 },
  { id: "great-lakes-levels",host: "greatlakeslevels.org",             sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "gazette",           host: "gazette.chrisizworski.com",        sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 120 },
  { id: "personal-hub",      host: "chrisizworski.com",                sitemap: true,  cadence: "static", indexnow: true, indexnowKey: "a3c17155d621f6c918e84d1632a662f1", urlCap: 140 },
  { id: "lawn-advisor",      host: "lawn.chrisizworski.com",           sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "phenology",         host: "phenology.chrisizworski.com",      sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "lspp-ice-out",      host: "lspp-ice-out.vercel.app",          sitemap: false, cadence: "seasonal", window: ["0301","0531"], indexnow: false },
  { id: "fallcolor",         host: "fallcolor.chrisizworski.com",      sitemap: true,  cadence: "seasonal", window: ["0901","1115"], indexnow: true },
  { id: "tcwine",            host: "tcwine.chrisizworski.com",         sitemap: true,  cadence: "static", indexnow: true },
  { id: "ausable",           host: "ausable.chrisizworski.com",        sitemap: true,  cadence: "static", indexnow: true },
  { id: "pictured-rocks",    host: "picturedrocks.chrisizworski.com",  sitemap: true,  cadence: "static", indexnow: true },
  { id: "xcski",             host: "xcski.chrisizworski.com",          sitemap: true,  cadence: "seasonal", window: ["1201","0331"], indexnow: true },
  { id: "camp",              host: "camp.chrisizworski.com",           sitemap: false, cadence: "static", indexnow: false },
  { id: "fvf-wordpress",     host: "freighterviewfarms.com",           sitemap: true,  cadence: "static", indexnow: false, urlCap: 140 },
  { id: "github-pages",      host: "izworskic.github.io",              sitemap: false, cadence: "static", indexnow: false },
];

// Redirect expectations carried over from sentinel v1, verbatim.
const REDIRECTS = [
  { from: "https://www.michigantroutreport.com/",  expectedHost: "michigantroutreport.com", maxHops: 2 },
  { from: "https://www.michiganbirdingreport.com/", expectedHost: "michiganbirdingreport.com", maxHops: 2 },
  { from: "https://www.greatlakeslevels.org/",     expectedHost: "greatlakeslevels.org", maxHops: 2 },
  { from: "https://www.chrisizworski.com/",        expectedHost: "chrisizworski.com", maxHops: 2 },
  { from: "https://birding.chrisizworski.com/",    expectedHost: "michiganbirdingreport.com", maxHops: 2 },
  { from: "https://birding.chrisizworski.com/county/003", expectedHost: "michiganbirdingreport.com", maxHops: 2 },
  { from: "https://troutdaily.chrisizworski.com/", expectedHost: "daily.michigantroutreport.com", maxHops: 2 },
  { from: "http://michigantroutreport.com/",       expectedHost: "michigantroutreport.com", maxHops: 2 },
  { from: "http://gazette.chrisizworski.com/",     expectedHost: "gazette.chrisizworski.com", maxHops: 2 },

  // Michigan Ice Report moved off ice.chrisizworski.com onto the hub in Aug 2026.
  // The subdomain now exists only to serve 301s. If the michigan-ice-report Vercel
  // project or the ice CNAME is ever deleted, these go red and say why. expectedPath
  // matters here: a degraded catch-all that dumps everything on the hub homepage
  // would still land on the right HOST and would otherwise pass silently.
  { from: "https://ice.chrisizworski.com/", expectedHost: "chrisizworski.com",
    expectedPath: "/michigan-ice/", maxHops: 2,
    note: "keep the michigan-ice-report Vercel project and the ice CNAME alive" },
  { from: "https://ice.chrisizworski.com/ice-cover-history.html", expectedHost: "chrisizworski.com",
    expectedPath: "/michigan-ice/ice-cover-history.html", maxHops: 2,
    note: "per-page 301, not a catch-all to the section index" },
  { from: "https://ice.chrisizworski.com/regions/saginaw-bay.html", expectedHost: "chrisizworski.com",
    expectedPath: "/michigan-ice/regions/saginaw-bay.html", maxHops: 2,
    note: "region pages are a second URL shape and have their own rule" },
];

async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  try {
    const r = await fetch(url, { redirect: opts.redirect || "follow", signal: ctrl.signal,
      headers: { "user-agent": "portfolio-sentinel-v2 (chrisizworski.com network watchdog)" } });
    const text = opts.head ? "" : await r.text();
    return { ok: r.ok, status: r.status, text, url: r.url, headers: r.headers };
  } catch (e) {
    return { ok: false, status: 0, text: "", url, error: String(e && e.message || e) };
  } finally { clearTimeout(t); }
}

// Newest timestamp in a payload that is not in the future. Feeds routinely carry
// forecast rows dated ahead of now, and treating those as "fresh" would hide a
// dead feed. Returns null when nothing parseable is found, which is not a failure.
function newestPastTimestamp(text, now) {
  const matches = text.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?/g) || [];
  let newest = null;
  for (const raw of matches.slice(0, 4000)) {
    const hasZone = /[Zz]$|[+-]\d\d:?\d\d$/.test(raw);
    const d = new Date(raw.replace(" ", "T") + (hasZone ? "" : "Z"));
    if (isNaN(d) || d > now) continue;
    if (!newest || d > newest) newest = d;
  }
  return newest;
}

// Probe one outbound feed. Severity policy is deliberately conservative, because a
// watchdog that cries wolf gets ignored: hard failures are critical, data going
// stale is only a warn, and a feed with no timestamps is never penalised.
async function checkFeed(f, now) {
  const issues = [];
  let r = await fetchText(f.url, { timeout: 25000 });
  // Rate limits and 5xx are usually transient. Retry once before calling it a failure,
  // so a momentary blip does not page anyone.
  if (!r.ok && (r.status === 429 || r.status >= 500 || r.status === 0)) {
    await new Promise(res => setTimeout(res, 4000));
    r = await fetchText(f.url, { timeout: 25000 });
  }
  const bytes = r.ok ? Buffer.byteLength(r.text, "utf8") : 0;
  const result = { id: f.id, owners: f.owners || [], status: r.status, bytes, ok: true };

  if (!r.ok) {
    // A 429 that survives a retry is throttling, not a dead endpoint. Warn, do not alarm.
    const transient = r.status === 429;
    issues.push({ severity: transient ? "warn" : "critical", check: "feed",
      detail: `${f.id} returned status ${r.status}${r.error ? " " + r.error : ""} (owners: ${(f.owners || []).join(", ") || "unknown"})${transient ? ", rate limited after retry" : ""}` });
    result.ok = false;
    return { result, issues };
  }
  const floor = f.minBytes || 1;
  if (bytes < floor) {
    issues.push({ severity: "critical", check: "feed",
      detail: `${f.id} returned only ${bytes} bytes, floor is ${floor}, likely an error page served as 200` });
    result.ok = false;
  }
  if (f.kind === "json") {
    try { JSON.parse(r.text); }
    catch (e) {
      issues.push({ severity: "critical", check: "feed", detail: `${f.id} did not parse as JSON` });
      result.ok = false;
    }
  }
  if (f.must && !r.text.includes(f.must)) {
    issues.push({ severity: "critical", check: "feed",
      detail: `${f.id} response is missing expected field "${f.must}", the shape may have changed` });
    result.ok = false;
  }
  if (f.maxAgeH) {
    const newest = newestPastTimestamp(r.text, now);
    if (newest) {
      const ageH = (now - newest) / 3600000;
      result.dataAgeH = Math.round(ageH * 10) / 10;
      if (ageH > f.maxAgeH) {
        issues.push({ severity: "warn", check: "feed",
          detail: `${f.id} newest data is ${Math.round(ageH)}h old, expected under ${f.maxAgeH}h` });
      }
    }
  }
  return { result, issues };
}

async function sbGet(key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sentinel_state?key=eq.${encodeURIComponent(key)}&select=value,updated_at`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows.length ? rows[0] : null;
}

async function sbSet(key, value) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sentinel_state`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json", prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });
  return r.ok;
}

function inWindow(win, now) {
  if (!win) return true;
  const mmdd = String(now.getUTCMonth() + 1).padStart(2, "0") + String(now.getUTCDate()).padStart(2, "0");
  const [a, b] = win;
  return a <= b ? (mmdd >= a && mmdd <= b) : (mmdd >= a || mmdd <= b);
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const { FEEDS } = require("./feeds.js");

module.exports = { PROPERTIES, REDIRECTS, FEEDS, checkFeed, INDEXNOW_KEY, EM_DASH, STALE_HOURS, fetchText, sbGet, sbSet, inWindow, sha256 };
