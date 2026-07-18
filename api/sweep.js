// portfolio-sentinel-v2 daily sweep. Rule: no em dash characters in this codebase.
const { PROPERTIES, REDIRECTS, INDEXNOW_KEY, EM_DASH, STALE_HOURS, fetchText, sbGet, sbSet, inWindow, sha256 } = require("../lib.js");

async function checkProperty(p, now, prevHashes) {
  const issues = [];
  const stats = { urlsChecked: 0, urlsOk: 0 };
  const base = `https://${p.host}`;

  // 1. Homepage: availability, crawlability, em dash rule, freshness hash.
  const home = await fetchText(`${base}/`);
  if (!home.ok) {
    issues.push({ severity: "critical", check: "homepage", detail: `homepage status ${home.status} ${home.error || ""}`.trim() });
  } else {
    if (home.url.includes("_vercel/sso") || home.status === 401 || home.status === 403) {
      issues.push({ severity: "critical", check: "protection", detail: "homepage behind Vercel protection, not crawlable" });
    }
    const dashes = (home.text.match(new RegExp(EM_DASH, "g")) || []).length;
    if (dashes > 0) issues.push({ severity: "info", check: "emdash", detail: `${dashes} em dash(es) in homepage HTML` });

    // Freshness: hash the homepage, compare with last change timestamp.
    const h = await sha256(home.text.replace(/\s+/g, " "));
    const prev = prevHashes[p.id] || null;
    if (!prev || prev.hash !== h) {
      prevHashes[p.id] = { hash: h, changedAt: now.toISOString() };
    } else {
      const ageH = (now - new Date(prev.changedAt)) / 3600000;
      const staleApplies = p.cadence === "daily" || (p.cadence === "seasonal" && inWindow(p.window, now));
      if (staleApplies && ageH > STALE_HOURS) {
        issues.push({ severity: "critical", check: "stale",
          detail: `content unchanged for ${Math.round(ageH)}h on a ${p.cadence} property (threshold ${STALE_HOURS}h)` });
      }
    }
  }

  // 2. Sitemap URL health.
  if (p.sitemap) {
    const sm = await fetchText(`${base}/sitemap.xml`);
    if (!sm.ok) {
      issues.push({ severity: "warn", check: "sitemap", detail: `sitemap.xml status ${sm.status}` });
    } else {
      let urls = Array.from(sm.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)).map(m => m[1]);
      // Sitemap index support: pull first child sitemap set.
      if (urls.length && sm.text.includes("<sitemapindex")) {
        const child = await fetchText(urls[0]);
        urls = child.ok ? Array.from(child.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)).map(m => m[1]) : [];
      }
      const cap = p.urlCap || 60;
      if (urls.length > cap) issues.push({ severity: "info", check: "sitemap", detail: `sitemap has ${urls.length} URLs, checking first ${cap}` });
      const toCheck = urls.slice(0, cap);
      const CONC = 10;
      for (let i = 0; i < toCheck.length; i += CONC) {
        const batch = toCheck.slice(i, i + CONC);
        const results = await Promise.all(batch.map(u => fetchText(u, { head: true })));
        results.forEach((r, j) => {
          stats.urlsChecked++;
          if (r.ok) stats.urlsOk++;
          else issues.push({ severity: "critical", check: "url", detail: `${batch[j]} status ${r.status}` });
        });
      }
    }
  } else if (p.cadence !== "static") {
    issues.push({ severity: "warn", check: "sitemap", detail: "no sitemap configured for a non-static property" });
  }

  // 3. IndexNow key file present where expected.
  if (p.indexnow) {
    const kf = await fetchText(`${base}/${INDEXNOW_KEY}.txt`);
    if (!kf.ok || !kf.text.includes(INDEXNOW_KEY)) {
      issues.push({ severity: "warn", check: "indexnow", detail: `IndexNow key file missing (status ${kf.status})` });
    }
  }

  return { id: p.id, host: p.host, issues, stats };
}

async function checkRedirect(rd) {
  const r = await fetchText(rd.from, { redirect: "follow" });
  let pass = false, detail = "";
  if (!r.ok) { detail = `status ${r.status} ${r.error || ""}`.trim(); }
  else {
    try {
      const finalHost = new URL(r.url).host;
      pass = finalHost === rd.expectedHost;
      detail = pass ? `resolved to ${r.url}` : `resolved to ${finalHost}, expected ${rd.expectedHost}`;
    } catch { detail = "could not parse final URL"; }
  }
  return { from: rd.from, expectedHost: rd.expectedHost, maxHops: rd.maxHops, pass, detail };
}

module.exports = async (req, res) => {
  const isCron = req.headers["x-vercel-cron"] === "1" || (req.headers["user-agent"] || "").includes("vercel-cron");
  const forced = req.query && req.query.force === "sentinel-v2-2026";
  const last = await sbGet("sentinel:latest");
  const lastAgeH = last ? (Date.now() - new Date(last.value.ranAt)) / 3600000 : 999;
  if (!isCron && !forced && lastAgeH < 20) {
    return res.status(429).json({ error: "sweep ran recently, use cron or force" });
  }

  const now = new Date();
  const t0 = Date.now();
  const prevRow = await sbGet("sentinel:hashes");
  const prevHashes = prevRow ? prevRow.value : {};

  const properties = [];
  for (const p of PROPERTIES) properties.push(await checkProperty(p, now, prevHashes));
  const redirects = await Promise.all(REDIRECTS.map(checkRedirect));

  const allIssues = properties.flatMap(p => p.issues.map(i => `${p.id}|${i.check}|${i.detail}`));
  const failKeys = properties.flatMap(p => p.issues.filter(i => i.severity !== "info").map(i => `${p.id}|${i.check}|${i.detail}`))
    .concat(redirects.filter(r => !r.pass).map(r => `redirect|${r.from}`));
  const prevFailRow = await sbGet("sentinel:failkeys");
  const prevFails = prevFailRow ? prevFailRow.value : null;
  const deltas = {
    newFailures: prevFails ? failKeys.filter(k => !prevFails.includes(k)) : failKeys,
    recovered: prevFails ? prevFails.filter(k => !failKeys.includes(k)) : [],
    firstRun: !prevFails,
  };

  const totals = {
    criticalCount: properties.reduce((n, p) => n + p.issues.filter(i => i.severity === "critical").length, 0)
      + redirects.filter(r => !r.pass).length,
    warnCount: properties.reduce((n, p) => n + p.issues.filter(i => i.severity === "warn").length, 0),
    urlsChecked: properties.reduce((n, p) => n + p.stats.urlsChecked, 0),
    urlsOk: properties.reduce((n, p) => n + p.stats.urlsOk, 0),
  };
  const status = totals.criticalCount ? "fail" : totals.warnCount ? "warn" : "pass";

  const report = { ranAt: now.toISOString(), properties, redirects,
    vercel: properties.map(p => {
      const prot = p.issues.find(i => i.check === "protection");
      return { name: p.id, pass: !prot, detail: prot ? prot.detail : "unprotected (crawlable)" };
    }),
    durationMs: Date.now() - t0, deltas, totals, status };

  await sbSet("sentinel:hashes", prevHashes);
  await sbSet("sentinel:failkeys", failKeys);
  await sbSet("sentinel:latest", report);
  const hist = (await sbGet("sentinel:history"));
  const histArr = hist ? hist.value : [];
  histArr.unshift({ ranAt: report.ranAt, status, totals });
  await sbSet("sentinel:history", histArr.slice(0, 90));

  res.status(200).json({ ok: true, status, totals, durationMs: report.durationMs, allIssueCount: allIssues.length });
};
