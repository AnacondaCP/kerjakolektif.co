"use strict";
// KerjaKolektif server: zero dependencies, needs Node 22.13+ (built-in sqlite)
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = +process.env.PORT || 3000;
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const PROOFS = path.join(DATA, "attendance-proofs");
const PROXY = process.env.TRUST_PROXY === "1";
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(PROOFS, { recursive: true });
const db = new DatabaseSync(path.join(DATA, "app.db"));
db.exec(
  "CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, hash TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, ip TEXT, act TEXT);",
);

const hash = (pw) => {
  const s = crypto.randomBytes(16);
  return s.toString("hex") + ":" + crypto.scryptSync(pw, s, 64).toString("hex");
};
const verify = (pw, h) => {
  const [s, k] = h.split(":"),
    a = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64),
    b = Buffer.from(k, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const adminUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
if (!db.prepare("SELECT 1 FROM users WHERE username=?").get(adminUsername)) {
  if (!/^[a-z0-9_.-]{1,100}$/.test(adminUsername))
    throw new Error("ADMIN_USERNAME hanya boleh berisi huruf, angka, titik, _ atau -.");
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)
    throw new Error(
      "Atur ADMIN_PASSWORD minimal 16 karakter sebelum membuat database baru.",
    );
  db.prepare("INSERT INTO users VALUES(?,?)").run(
    adminUsername,
    hash(process.env.ADMIN_PASSWORD),
  );
}
const log = (ip, act) =>
  db
    .prepare("INSERT INTO audit(ts,ip,act) VALUES(?,?,?)")
    .run(new Date().toISOString(), ip, act);

const sessions = new Map(),
  hits = new Map(),
  fails = new Map();
const TTL = 8 * 3600e3;
const bump = (map, key, win) => {
  const n = Date.now(),
    r = map.get(key);
  if (!r || r.t < n) {
    map.set(key, { c: 1, t: n + win });
    return 1;
  }
  return ++r.c;
};
setInterval(() => {
  const n = Date.now();
  for (const [k, s] of sessions) if (s.exp < n) sessions.delete(k);
  for (const m of [hits, fails])
    for (const [k, r] of m) if (r.t < n) m.delete(k);
}, 60e3).unref();

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const send = (res, code, data, type, extra) => {
  const binary = Buffer.isBuffer(data);
  const json = typeof data !== "string" && !binary;
  res.writeHead(
    code,
    Object.assign(
      {
        "Content-Type":
          type ||
          (json
            ? "application/json; charset=utf-8"
            : "text/html; charset=utf-8"),
        "Cache-Control": "no-store",
      },
      SEC,
      extra,
    ),
  );
  res.end(binary ? data : json ? JSON.stringify(data) : data);
};
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const readBody = (req) =>
  new Promise((ok, no) => {
    let n = 0;
    const c = [];
    req.on("data", (d) => {
      n += d.length;
      if (n > 2e6) {
        no(fail(413, "Data terlalu besar."));
        req.destroy();
      } else c.push(d);
    });
    req.on("end", () => {
      try {
        ok(JSON.parse(Buffer.concat(c).toString() || "{}"));
      } catch (e) {
        no(fail(400, "JSON tidak valid."));
      }
    });
  });
const safeEq = (a, b) => {
  a = Buffer.from(String(a));
  b = Buffer.from(String(b));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const okState = (s) =>
  s &&
  typeof s === "object" &&
  !Array.isArray(s) &&
  ["deals", "kols", "inv", "exp"].every((k) => Array.isArray(s[k]));

const PUB = path.join(__dirname, "public");
const BUNDLE = [
  "js/app.js",
  "js/features/dashboard.js",
  "js/features/crm.js",
  "js/features/billing.js",
  "js/features/operations.js",
  "js/features/finance.js",
  "js/features/reports.js",
  "js/features/hr.js",
  "js/auth.js",
];
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/css/app.css": ["css/app.css", "text/css; charset=utf-8"],
};

http
  .createServer(async (req, res) => {
    const ip =
      ((PROXY && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() ||
      req.socket.remoteAddress;
    try {
      const url = req.url.split("?")[0];
      if (bump(hits, ip, 60e3) > 300)
        throw fail(429, "Terlalu banyak request.");
      if (req.method === "GET" && (url === "/js/app.js" || url === "/app.js")) {
        const bundle = BUNDLE.map((file) =>
          fs.readFileSync(path.join(PUB, file), "utf8"),
        ).join("\n");
        return send(res, 200, bundle, "text/javascript; charset=utf-8");
      }
      if (req.method === "GET" && STATIC[url])
        return send(
          res,
          200,
          fs.readFileSync(path.join(PUB, STATIC[url][0]), "utf8"),
          STATIC[url][1],
        );
      if (!url.startsWith("/api/")) throw fail(404, "Not found");
      if (req.method !== "GET") {
        const o = req.headers.origin;
        if (o) {
          let h = "";
          try {
            h = new URL(o).host;
          } catch (e) {}
          if (h !== req.headers.host) throw fail(403, "Origin ditolak.");
        }
      }
      if (url === "/api/login" && req.method === "POST") {
        const f = fails.get(ip);
        if (f && f.t > Date.now() && f.c >= 5)
          throw fail(429, "Terlalu banyak percobaan. Coba lagi 15 menit.");
        const b = await readBody(req),
          u = String(b.u || "")
            .toLowerCase()
            .slice(0, 100),
          p = String(b.p || "").slice(0, 200);
        const row = db
          .prepare("SELECT hash FROM users WHERE username=?")
          .get(u);
        const good = row
          ? verify(p, row.hash)
          : (verify(p, "00:" + "00".repeat(64)), false);
        if (!good) {
          bump(fails, ip, 900e3);
          log(ip, "Login gagal: " + u.replace(/[^\w.-]/g, "?"));
          throw fail(401, "Username atau password salah.");
        }
        fails.delete(ip);
        const id = crypto.randomBytes(32).toString("hex"),
          csrf = crypto.randomBytes(24).toString("hex");
        sessions.set(id, { csrf, exp: Date.now() + TTL, u });
        log(ip, "Login berhasil: " + u);
        const secure =
          PROXY && req.headers["x-forwarded-proto"] === "https"
            ? "; Secure"
            : "";
        return send(res, 200, { ok: 1, csrf }, null, {
          "Set-Cookie":
            "sid=" +
            id +
            "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
            TTL / 1000 +
            secure,
        });
      }
      const sid = (
        (req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("sid=")) || ""
      ).slice(4);
      const s = sessions.get(sid);
      if (!s || s.exp < Date.now())
        throw fail(401, "Sesi berakhir, silakan login lagi.");
      if (url === "/api/me" && req.method === "GET")
        return send(res, 200, { ok: 1, csrf: s.csrf });
      if (req.method !== "GET" && !safeEq(req.headers["x-csrf"] || "", s.csrf))
        throw fail(403, "Token CSRF salah.");
      const proofId = url.match(/^\/api\/attendance-proof\/([0-9a-f-]{36})$/);
      if (proofId && req.method === "GET") {
        const proofPath = path.join(PROOFS, proofId[1] + ".jpg");
        if (!fs.existsSync(proofPath))
          throw fail(404, "Bukti absensi tidak ditemukan.");
        return send(res, 200, fs.readFileSync(proofPath), "image/jpeg", {
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline",
        });
      }
      if (url === "/api/attendance-proof" && req.method === "POST") {
        const b = await readBody(req);
        if (typeof b.image !== "string")
          throw fail(400, "Foto bukti wajib diunggah.");
        const match = b.image.match(
          /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/,
        );
        if (!match) throw fail(400, "Format foto tidak valid. Gunakan JPG.");
        const image = Buffer.from(match[1], "base64");
        if (
          image.length === 0 ||
          image.length > 500e3 ||
          image.toString("base64") !== match[1] ||
          image[0] !== 0xff ||
          image[1] !== 0xd8 ||
          image[image.length - 2] !== 0xff ||
          image[image.length - 1] !== 0xd9
        ) {
          throw fail(400, "Foto tidak valid atau melebihi batas 500 KB.");
        }
        const id = crypto.randomUUID();
        fs.writeFileSync(path.join(PROOFS, id + ".jpg"), image, { flag: "wx" });
        return send(res, 201, { ok: 1, id });
      }
      if (proofId && req.method === "DELETE") {
        const proofPath = path.join(PROOFS, proofId[1] + ".jpg");
        if (fs.existsSync(proofPath)) fs.unlinkSync(proofPath);
        return send(res, 200, { ok: 1 });
      }
      if (url === "/api/logout" && req.method === "POST") {
        sessions.delete(sid);
        log(ip, "Logout");
        return send(res, 200, { ok: 1 }, null, {
          "Set-Cookie": "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        });
      }
      if (url === "/api/state" && req.method === "GET") {
        const r = db.prepare("SELECT v FROM kv WHERE k='state'").get();
        return send(res, 200, r ? JSON.parse(r.v) : {});
      }
      if (url === "/api/state" && req.method === "PUT") {
        const b = await readBody(req);
        if (!okState(b)) throw fail(400, "Struktur data tidak valid.");
        db.prepare(
          "INSERT INTO kv(k,v) VALUES('state',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
        ).run(JSON.stringify(b));
        return send(res, 200, { ok: 1 });
      }
      if (url === "/api/audit" && req.method === "GET")
        return send(
          res,
          200,
          db
            .prepare("SELECT ts,ip,act FROM audit ORDER BY id DESC LIMIT 100")
            .all(),
        );
      if (url === "/api/password" && req.method === "POST") {
        const b = await readBody(req),
          row = db.prepare("SELECT hash FROM users WHERE username=?").get(s.u);
        if (typeof b.new !== "string" || b.new.length < 8 || b.new.length > 200)
          throw fail(400, "Password baru minimal 8 karakter.");
        if (!verify(String(b.old || ""), row.hash))
          throw fail(403, "Password lama salah.");
        db.prepare("UPDATE users SET hash=? WHERE username=?").run(
          hash(b.new),
          s.u,
        );
        for (const [k] of sessions) if (k !== sid) sessions.delete(k);
        log(ip, "Password diganti");
        return send(res, 200, { ok: 1 });
      }
      throw fail(404, "Not found");
    } catch (e) {
      if (!e.code) console.error(e);
      send(res, e.code || 500, { error: e.code ? e.message : "Server error" });
    }
  })
  .listen(PORT, () =>
    console.log("KerjaKolektif jalan di http://localhost:" + PORT),
  );
