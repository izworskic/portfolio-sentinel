// Outbound feed registry for portfolio-sentinel.
// Rule: no em dash characters anywhere in this codebase, including strings.
//
// Why this exists: on 2026-08-02 NOAA SWPC deleted its entire /products/solar-wind/
// directory. The northern lights tool kept returning HTTP 200 and kept looking fine,
// but two of its data cards had silently gone dead. Page-level checks cannot see that.
// Only probing the upstream feeds themselves can.
//
// Fields:
//   id        stable key, used in delta tracking. Do not rename casually.
//   url       the exact endpoint the network depends on.
//   owners    which properties break if this dies. For triage, not for logic.
//   kind      "json" parses strictly, "text" and "binary" only size check.
//   minBytes  floor. Catches a 404 or error page served with a 200.
//   must      optional substring or JSON key that has to be present.
//   maxAgeH   optional. Warn if the newest past timestamp in the payload is older
//             than this. Omit it when a feed has no timestamps or is reference data.
//             Never set this below the feed's real publish cadence.
const FEEDS = [
  // Space weather. Northern lights tool.
  { id: "swpc-kp-current",   url: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    owners: ["personal-hub"], kind: "json", minBytes: 500, maxAgeH: 12 },
  { id: "swpc-kp-forecast",  url: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    owners: ["personal-hub"], kind: "json", minBytes: 500, maxAgeH: 48 },
  { id: "swpc-mag-field",    url: "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json",
    owners: ["personal-hub"], kind: "json", minBytes: 30, must: "bz_gsm", maxAgeH: 6 },
  { id: "swpc-wind-speed",   url: "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",
    owners: ["personal-hub"], kind: "json", minBytes: 30, must: "proton_speed", maxAgeH: 6 },
  { id: "swpc-aurora-image", url: "https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg",
    owners: ["personal-hub"], kind: "binary", minBytes: 20000 },

  // Marine and buoys.
  { id: "ndbc-latest-obs",   url: "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt",
    owners: ["personal-hub", "saginawbay"], kind: "text", minBytes: 20000 },
  { id: "ndbc-45175",        url: "https://www.ndbc.noaa.gov/data/realtime2/45175.txt",
    owners: ["saginawbay"], kind: "text", minBytes: 5000 },
  { id: "ndbc-macm4",        url: "https://www.ndbc.noaa.gov/data/realtime2/MACM4.txt",
    owners: ["personal-hub"], kind: "text", minBytes: 5000 },
  { id: "coops-water-level", url: "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=9075014&product=water_level&datum=IGLD&units=english&time_zone=lst_ldt&format=json",
    owners: ["great-lakes-levels"], kind: "json", minBytes: 60, must: "data", maxAgeH: 12 },
  { id: "glerl-ice",         url: "https://www.glerl.noaa.gov/data/ice/",
    owners: ["ice"], kind: "text", minBytes: 5000 },

  // Weather.
  { id: "nws-alerts-mi",     url: "https://api.weather.gov/alerts/active?area=MI",
    owners: ["personal-hub", "weekend"], kind: "json", minBytes: 200, must: "features" },
  { id: "nws-gridpoint-apx", url: "https://api.weather.gov/gridpoints/APX/55,70/forecast",
    owners: ["personal-hub"], kind: "json", minBytes: 1000, must: "periods" },
  { id: "nws-radar-apx",     url: "https://radar.weather.gov/ridge/standard/KAPX_loop.gif",
    owners: ["personal-hub"], kind: "binary", minBytes: 20000 },
  { id: "open-meteo",        url: "https://api.open-meteo.com/v1/forecast?latitude=43.59&longitude=-83.89&current=temperature_2m",
    owners: ["ausable", "weekend", "lawn-advisor"], kind: "json", minBytes: 100, must: "current" },

  // Rivers.
  { id: "usgs-iv-ausable",   url: "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=04136500,04136000,04137005&parameterCd=00010&siteStatus=all",
    owners: ["ausable", "trout-main"], kind: "json", minBytes: 1000, must: "timeSeries", maxAgeH: 12 },

  // Roads, bridge, border.
  { id: "mackinac-conditions", url: "https://www.mackinacbridge.org/wp-json/wp/v2/pages/1439",
    owners: ["personal-hub"], kind: "json", minBytes: 500 },
  { id: "mackinac-cam",      url: "https://www.mackinacbridge.org/wp-content/camimages/MacBridge_image2_large.jpg",
    owners: ["personal-hub"], kind: "binary", minBytes: 50000 },
  { id: "mdot-incidents",    url: "https://mdotjboss.state.mi.us/MiDrive/incidents/AllForMap",
    owners: ["personal-hub"], kind: "json", minBytes: 100 },
  { id: "mdot-construction", url: "https://mdotjboss.state.mi.us/MiDrive/construction/AllForMap",
    owners: ["personal-hub"], kind: "json", minBytes: 10000 },
  { id: "cbp-border-wait",   url: "https://bwt.cbp.gov/api/bwtnew",
    owners: ["personal-hub"], kind: "json", minBytes: 10000 },
  { id: "cbsa-border-wait",  url: "https://www.cbsa-asfc.gc.ca/bwt-taf/bwt-eng.csv",
    owners: ["personal-hub"], kind: "text", minBytes: 500 },
  { id: "on511-events",      url: "https://511on.ca/api/v2/get/event",
    owners: ["personal-hub"], kind: "json", minBytes: 1000 },

  // Beaches, satellite.
  { id: "mienviro-beaches",  url: "https://mienviro.michigan.gov/nsite/api/settings/getWslSettings",
    owners: ["personal-hub"], kind: "json", minBytes: 1000 },
  { id: "nasa-gibs-modis",   url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
    owners: ["fallcolor"], kind: "text", minBytes: 100000, must: "MODIS" },

  // The network's own API routes. These proxy upstreams that need keys or that we
  // cannot probe directly, so a healthy route is the only visible proof they work.
  { id: "hub-api-buoys",     url: "https://chrisizworski.com/api/buoys",
    owners: ["personal-hub"], kind: "json", minBytes: 5000, maxAgeH: 12 },
  { id: "hub-api-mackinac",  url: "https://chrisizworski.com/api/mackinac",
    owners: ["personal-hub"], kind: "json", minBytes: 2000 },
  { id: "hub-api-beaches",   url: "https://chrisizworski.com/api/beaches",
    owners: ["personal-hub"], kind: "json", minBytes: 20000 },
  { id: "hub-api-border",    url: "https://chrisizworski.com/api/border-crossings",
    owners: ["personal-hub"], kind: "json", minBytes: 5000 },
  { id: "ice-api",           url: "https://chrisizworski.com/api/ice",
    owners: ["ice"], kind: "json", minBytes: 200, maxAgeH: 36 },
  { id: "whitetail-api-harvest", url: "https://whitetail.chrisizworski.com/api/harvest",
    owners: ["whitetail"], kind: "json", minBytes: 60, maxAgeH: 36 },
];

module.exports = { FEEDS };
