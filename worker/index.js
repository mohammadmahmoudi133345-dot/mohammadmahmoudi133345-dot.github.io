// Cloudflare Worker — visitor tracker that writes CSV to GitHub repo
// Deploy: wrangler deploy (or paste in Cloudflare dashboard)

// GitHub config — set these as Worker secrets
// GH_TOKEN: Personal Access Token with repo scope
// GH_REPO: "mohammadmahmoudi133345-dot/mohammadmahmoudi133345-dot.github.io"
// GH_PATH: "visitors.csv"

const GITHUB_API = "https://api.github.com";
const CSV_HEADER = "time,ip,browser,os,device,screen,lang,referrer,page\n";

function csvEscape(v) {
  if (!v) return '""';
  v = String(v).replace(/"/g, '""');
  return '"' + v + '"';
}

function toTehran(ts) {
  return new Date(ts.getTime() + 3.5 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

async function appendToCSV(row, env) {
  // get current file
  const getUrl = `${GITHUB_API}/repos/${env.GH_REPO}/contents/${env.GH_PATH}`;
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: "Bearer " + env.GH_TOKEN,
      "User-Agent": "resume-tracker",
      Accept: "application/vnd.github.v3+json",
    },
  });

  let sha = null;
  let content = CSV_HEADER;

  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    content = atob(data.content);
    // ensure header exists
    if (!content.startsWith("time,")) content = CSV_HEADER + content;
  }

  content += row + "\n";

  // commit
  const putRes = await fetch(getUrl, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + env.GH_TOKEN,
      "User-Agent": "resume-tracker",
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "track: " + new Date().toISOString().slice(0, 19),
      content: btoa(content),
      sha: sha || undefined,
    }),
  });

  return putRes.ok;
}

export default {
  async fetch(req, env) {
    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // GET → serve raw CSV
    if (req.method === "GET") {
      const getUrl = `${GITHUB_API}/repos/${env.GH_REPO}/contents/${env.GH_PATH}`;
      const res = await fetch(getUrl, {
        headers: {
          Authorization: "Bearer " + env.GH_TOKEN,
          "User-Agent": "resume-tracker",
          Accept: "application/vnd.github.v3.raw",
        },
      });
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // POST → track visit
    if (req.method === "POST") {
      try {
        const body = await req.json();
        const ip = req.headers.get("CF-Connecting-IP") || "unknown";

        let browser = "unknown";
        const ua = body.ua || "";
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

        let device = "desktop";
        if (/tablet|ipad/i.test(ua) && !/mobile/i.test(ua)) device = "tablet";
        else if (/mobile|android|iphone|ipod/i.test(ua)) device = "mobile";

        const time = toTehran(new Date());
        const row = [
          csvEscape(time),
          csvEscape(ip),
          csvEscape(browser),
          csvEscape(os),
          csvEscape(device),
          csvEscape(body.screen || ""),
          csvEscape(body.lang || ""),
          csvEscape(body.referrer || ""),
          csvEscape(body.href || ""),
        ].join(",");

        const ok = await appendToCSV(row, env);

        return new Response(JSON.stringify({ ok }), {
          status: ok ? 200 : 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    return new Response("not found", { status: 404 });
  },
};
