const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "visitors.db");

// init db
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    ua TEXT,
    browser TEXT,
    os TEXT,
    device TEXT,
    screen TEXT,
    lang TEXT,
    referrer TEXT,
    href TEXT,
    time TEXT,
    date TEXT
  )
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// rate limit: max 1 req per 5 sec per IP
const limiter = rateLimit({
  windowMs: 5000,
  max: 1,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  handler: (_, res) => res.status(429).json({ ok: false, msg: "too fast" }),
});

// track endpoint
app.post("/api/track", limiter, (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const ua = req.body.ua || "";
  const screen = req.body.screen || "";
  const lang = req.body.lang || "";
  const referrer = req.body.referrer || "";
  const href = req.body.href || "";
  const now = new Date();
  const time = now.toLocaleTimeString("fa-IR", { timeZone: "Asia/Tehran" });
  const date = now.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });

  // parse UA
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua) && !/mobile/i.test(ua);
  let device = "desktop";
  if (isTablet) device = "tablet";
  else if (isMobile) device = "mobile";

  let browser = "unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  try {
    db.prepare(
      "INSERT INTO visitors (ip, ua, browser, os, device, screen, lang, referrer, href, time, date) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).run(ip, ua, browser, os, device, screen, lang, referrer, href, time, date);
    res.json({ ok: true });
  } catch (e) {
    console.error("db error:", e);
    res.status(500).json({ ok: false });
  }
});

// dashboard
app.get("/admin", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM visitors ORDER BY id DESC LIMIT 500")
    .all();
  const total = db.prepare("SELECT COUNT(*) as c FROM visitors").get().c;
  const uniqueIPs = db
    .prepare("SELECT COUNT(DISTINCT ip) as c FROM visitors")
    .get().c;
  const today = new Date().toLocaleDateString("fa-IR", {
    timeZone: "Asia/Tehran",
  });
  const todayCount = db
    .prepare("SELECT COUNT(*) as c FROM visitors WHERE date = ?")
    .get(today).c;
  const browsers = db
    .prepare("SELECT browser, COUNT(*) as c FROM visitors GROUP BY browser ORDER BY c DESC")
    .all();
  const devices = db
    .prepare("SELECT device, COUNT(*) as c FROM visitors GROUP BY device ORDER BY c DESC")
    .all();
  const recent = rows.slice(0, 50);

  res.send(`<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>پیشخوان بازدیدکنندگان</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Vazirmatn',sans-serif;background:#050512;color:#f0f2f8;padding:2rem}
h1{font-size:1.5rem;margin-bottom:2rem;background:linear-gradient(135deg,#00d4aa,#a29bfe);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2.5rem}
.stat{background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.03);border-radius:14px;padding:1.2rem;text-align:center}
.stat-num{font-size:1.8rem;font-weight:800;color:#00d4aa;line-height:1}
.stat-lbl{font-size:0.7rem;color:#6b6b98;margin-top:0.3rem}
h2{font-size:1rem;color:#9898c8;margin-bottom:1rem;margin-top:2rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem}
.g-card{background:rgba(255,255,255,0.012);border:1px solid rgba(255,255,255,0.025);border-radius:12px;padding:1rem}
.g-card h3{font-size:0.8rem;color:#6b6b98;margin-bottom:0.5rem}
.g-card .bar-wrap{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem}
.g-card .bar{flex:1;height:6px;border-radius:10px;background:rgba(255,255,255,0.02);overflow:hidden}
.g-card .bar-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#00d4aa,#a29bfe)}
.g-card .bar-lbl{font-size:0.65rem;color:#6b6b98;min-width:4rem;text-align:left}
table{width:100%;border-collapse:collapse;font-size:0.72rem;margin-top:1rem}
th{text-align:right;color:#6b6b98;font-weight:600;padding:0.5rem 0.3rem;border-bottom:1px solid rgba(255,255,255,0.03)}
td{padding:0.4rem 0.3rem;border-bottom:1px solid rgba(255,255,255,0.015);color:#9898c8}
tr:hover td{background:rgba(255,255,255,0.008)}
.badge{display:inline-block;padding:0.1rem 0.45rem;border-radius:4px;font-size:0.6rem;font-weight:600}
.badge-ok{background:rgba(0,212,170,0.04);color:#00d4aa}
@media(max-width:600px){table{font-size:0.6rem}body{padding:1rem}}
</style></head>
<body>
<h1>📊 پیشخوان بازدیدکنندگان</h1>
<div class="stats">
  <div class="stat"><div class="stat-num">${total.toLocaleString("fa-IR")}</div><div class="stat-lbl">بازدید کل</div></div>
  <div class="stat"><div class="stat-num">${uniqueIPs.toLocaleString("fa-IR")}</div><div class="stat-lbl">آی‌پی منحصربه‌فرد</div></div>
  <div class="stat"><div class="stat-num">${todayCount.toLocaleString("fa-IR")}</div><div class="stat-lbl">امروز</div></div>
  <div class="stat"><div class="stat-num">${rows.length.toLocaleString("fa-IR")}</div><div class="stat-lbl">آخرین ۵۰۰</div></div>
</div>

<h2>🌐 مرورگرها</h2>
<div class="grid">${browsers
  .map(
    (b) => `
  <div class="g-card">
    <h3>${b.browser}</h3>
    <div class="bar-wrap">
      <div class="bar"><div class="bar-fill" style="width:${((b.c / total) * 100).toFixed(1)}%"></div></div>
      <span class="bar-lbl">${b.c.toLocaleString("fa-IR")}</span>
    </div>
  </div>`
  )
  .join("")}</div>

<h2>📱 دستگاه‌ها</h2>
<div class="grid">${devices
  .map(
    (d) => `
  <div class="g-card">
    <h3>${d.device}</h3>
    <div class="bar-wrap">
      <div class="bar"><div class="bar-fill" style="width:${((d.c / total) * 100).toFixed(1)}%"></div></div>
      <span class="bar-lbl">${d.c.toLocaleString("fa-IR")}</span>
    </div>
  </div>`
  )
  .join("")}</div>

<h2>🕐 آخرین بازدیدها</h2>
<table>
<thead><tr><th>زمان</th><th>IP</th><th>مرورگر</th><th>سیستم</th><th>دستگاه</th><th>صفحه</th></tr></thead>
<tbody>${recent
  .map(
    (v) =>
      `<tr><td>${v.date} ${v.time}</td><td>${v.ip}</td><td><span class="badge badge-ok">${v.browser}</span></td><td>${v.os}</td><td>${v.device}</td><td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.href}</td></tr>`
  )
  .join("")}
</tbody></table>
<p style="margin-top:2rem;font-size:0.65rem;color:#6b6b98">resume tracker · ${new Date().toLocaleString("fa-IR")}</p>
</body>
</html>`);
});

app.get("/api/visitors", (req, res) => {
  const rows = db.prepare("SELECT * FROM visitors ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

app.listen(PORT, () => console.log("tracker running on port", PORT));
