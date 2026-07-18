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
const PROPERTIES = [
  { id: "trout-main",        host: "michigantroutreport.com",          sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "trout-daily",       host: "daily.michigantroutreport.com",    sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "birding",           host: "michiganbirdingreport.com",        sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "birding-daily",     host: "daily.michiganbirdingreport.com",  sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "great-lakes-levels",host: "greatlakeslevels.org",             sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "gazette",           host: "gazette.chrisizworski.com",        sitemap: true,  cadence: "daily",  indexnow: true, urlCap: 80 },
  { id: "personal-hub",      host: "chrisizworski.com",                sitemap: true,  cadence: "static", indexnow: true },
  { id: "lawn-advisor",      host: "lawn.chrisizworski.com",           sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "phenology",         host: "phenology.chrisizworski.com",      sitemap: true,  cadence: "daily",  indexnow: true },
  { id: "lspp-ice-out",      host: "lspp-ice-out.vercel.app",          sitemap: false, cadence: "seasonal", window: ["0301","0531"], indexnow: false },
  { id: "fallcolor",         host: "fallcolor.chrisizworski.com",      sitemap: true,  cadence: "seasonal", window: ["0901","1115"], indexnow: true },
  { id: "tcwine",            host: "tcwine.chrisizworski.com",         sitemap: true,  cadence: "static", indexnow: true },
  { id: "ausable",           host: "ausable.chrisizworski.com",        sitemap: true,  cadence: "static", indexnow: true },
  { id: "pictured-rocks",    host: "picturedrocks.chrisizworski.com",  sitemap: true,  cadence: "static", indexnow: true },
  { id: "xcski",             host: "xcski.chrisizworski.com",          sitemap: true,  cadence: "seasonal", window: ["1201","0331"], indexnow: true },
  { id: "camp",              host: "camp.chrisizworski.com",           sitemap: false, cadence: "static", indexnow: false },
  { id: "fvf-wordpress",     host: "freighterviewfarms.com",           sitemap: true,  cadence: "static", indexnow: false },
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

module.exports = { PROPERTIES, REDIRECTS, INDEXNOW_KEY, EM_DASH, STALE_HOURS, fetchText, sbGet, sbSet, inWindow, sha256 };
