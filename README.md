# portfolio-sentinel

Daily health watchdog for the chrisizworski.com network. 18 properties, one sweep at
10:10 UTC via the scheduled workflow in this repo.

Checks: availability, crawlability (Vercel protection detection), sitemap URL health,
redirect chains, staleness (critical if a daily property's homepage is unchanged for
48 hours; seasonal properties only inside their season), IndexNow key files, and the
em dash rule.

State and 90-day history live in Supabase (table sentinel_state). The dashboard at
https://izworskic.github.io/portfolio-sentinel/ reads it directly.

Force a sweep any time: Actions tab, "sentinel sweep", Run workflow.

Sentinel v1 (portfolio-sentinel-cyan.vercel.app) runs independently at 10:00 UTC
until retired.
