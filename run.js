// Executes the sweep once, in cron mode. Used by the GitHub Actions schedule.
if (!globalThis.crypto || !globalThis.crypto.subtle) { globalThis.crypto = require("crypto").webcrypto; }
const handler = require("./api/sweep.js");
const req = { headers: { "x-vercel-cron": "1" }, query: {} };
const res = {
  code: 200,
  status(c) { this.code = c; return this; },
  json(o) {
    console.log(JSON.stringify({ httpCode: this.code, ...o }, null, 2));
    if (this.code >= 400 || o.status === "fail") process.exitCode = 0;
  },
  setHeader() {},
};
handler(req, res).catch((e) => { console.error("SWEEP ERROR:", e); process.exit(1); });
