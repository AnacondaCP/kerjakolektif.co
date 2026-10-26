"use strict";

const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { del, get, put } = require("@vercel/blob");
const { getDatabase } = require("./_db");

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_BODY = 2_000_000;
const MAX_PROOF_BYTES = 500_000;
const SEC = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function send(res, status, payload, headers) {
  for (const [key, value] of Object.entries(SEC)) res.setHeader(key, value);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const match = cookies.map((entry) => entry.trim()).find((entry) => entry.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : "";
}

async function readBody(req) {
  if (req.body !== undefined) return req.body;
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY)
      throw fail(413, "Data terlalu besar.");
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw fail(400, "JSON tidak valid.");
  }
}

async function readObjectBody(req) {
  const body = await readBody(req);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Buffer.isBuffer(body)
  )
    throw fail(400, "Format body tidak valid.");
  return body;
}

function verify(password, encoded) {
  const [salt, key] = String(encoded).split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function peerIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 100);
}

function validState(state) {
  return (
    state &&
    typeof state === "object" &&
    !Array.isArray(state) &&
    ["deals", "kols", "inv", "exp"].every((key) => Array.isArray(state[key]))
  );
}

async function audit(sql, ip, action) {
  await sql`INSERT INTO audit (ip, act) VALUES (${ip}, ${action})`;
}

function blobPath(id) {
  return "attendance-proofs/" + id + ".jpg";
}

module.exports = async function handler(req, res) {
  try {
    const sql = await getDatabase();
    const route = String(req.query.path || "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const method = req.method || "GET";
    const ip = peerIp(req);

    if (method !== "GET") {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin) {
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {}
        if (originHost !== host) throw fail(403, "Origin ditolak.");
      }
    }

    if (route === "login" && method === "POST") {
      const [locked] = await sql`
        SELECT attempts FROM login_failures
        WHERE ip = ${ip} AND expires_at > NOW()
      `;
      if (locked && locked.attempts >= 5)
        throw fail(429, "Terlalu banyak percobaan. Coba lagi 15 menit.");

      const body = await readObjectBody(req);
      const username = String(body.u || "").toLowerCase().slice(0, 100);
      const password = String(body.p || "").slice(0, 200);
      const [user] = await sql`SELECT hash FROM users WHERE username = ${username}`;
      const valid = user
        ? verify(password, user.hash)
        : (verify(password, "00:" + "00".repeat(64)), false);
      if (!valid) {
        await sql`
          INSERT INTO login_failures (ip, attempts, expires_at)
          VALUES (${ip}, 1, NOW() + INTERVAL '15 minutes')
          ON CONFLICT (ip) DO UPDATE SET
            attempts = CASE
              WHEN login_failures.expires_at <= NOW() THEN 1
              ELSE login_failures.attempts + 1
            END,
            expires_at = CASE
              WHEN login_failures.expires_at <= NOW()
                THEN NOW() + INTERVAL '15 minutes'
              ELSE login_failures.expires_at
            END
        `;
        await audit(sql, ip, "Login gagal: " + username.replace(/[^\w.-]/g, "?"));
        throw fail(401, "Username atau password salah.");
      }

      await sql`DELETE FROM login_failures WHERE ip = ${ip}`;
      const id = crypto.randomBytes(32).toString("hex");
      const csrf = crypto.randomBytes(24).toString("hex");
      await sql`
        INSERT INTO sessions (id, csrf, username, expires_at)
        VALUES (${id}, ${csrf}, ${username}, NOW() + INTERVAL '8 hours')
      `;
      await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
      await audit(sql, ip, "Login berhasil: " + username);
      const secure = process.env.VERCEL ? "; Secure" : "";
      res.setHeader(
        "Set-Cookie",
        "sid=" +
          id +
          "; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800" +
          secure,
      );
      return send(res, 200, { ok: 1, csrf });
    }

    const sessionId = cookieValue(req, "sid");
    const [session] = sessionId
      ? await sql`
          SELECT id, csrf, username FROM sessions
          WHERE id = ${sessionId} AND expires_at > NOW()
        `
      : [];
    if (!session) throw fail(401, "Sesi berakhir, silakan login lagi.");

    if (route === "me" && method === "GET")
      return send(res, 200, { ok: 1, csrf: session.csrf });

    if (method !== "GET" && req.headers["x-csrf"] !== session.csrf)
      throw fail(403, "Token CSRF salah.");

    if (route === "logout" && method === "POST") {
      await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
      await audit(sql, ip, "Logout");
      res.setHeader(
        "Set-Cookie",
        "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" +
          (process.env.VERCEL ? "; Secure" : ""),
      );
      return send(res, 200, { ok: 1 });
    }

    if (route === "state" && method === "GET") {
      const [row] = await sql`SELECT payload FROM app_state WHERE id = 1`;
      return send(res, 200, row ? row.payload : {});
    }

    if (route === "state" && method === "PUT") {
      const state = await readObjectBody(req);
      if (!validState(state)) throw fail(400, "Struktur data tidak valid.");
      await sql`
        INSERT INTO app_state (id, payload) VALUES (1, ${JSON.stringify(state)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `;
      return send(res, 200, { ok: 1 });
    }

    if (route === "audit" && method === "GET") {
      const rows = await sql`
        SELECT ts, ip, act FROM audit ORDER BY id DESC LIMIT 100
      `;
      return send(res, 200, rows);
    }

    if (route === "password" && method === "POST") {
      const body = await readObjectBody(req);
      const [user] = await sql`SELECT hash FROM users WHERE username = ${session.username}`;
      if (typeof body.new !== "string" || body.new.length < 8 || body.new.length > 200)
        throw fail(400, "Password baru minimal 8 karakter.");
      if (!verify(String(body.old || ""), user.hash))
        throw fail(403, "Password lama salah.");
      const salt = crypto.randomBytes(16);
      const hash = salt.toString("hex") + ":" + crypto.scryptSync(body.new, salt, 64).toString("hex");
      await sql`UPDATE users SET hash = ${hash} WHERE username = ${session.username}`;
      await sql`DELETE FROM sessions WHERE id <> ${sessionId}`;
      await audit(sql, ip, "Password diganti");
      return send(res, 200, { ok: 1 });
    }

    const proof = route.match(/^attendance-proof\/([0-9a-f-]{36})$/);
    if (proof && method === "GET") {
      const result = await get(blobPath(proof[1]), { access: "private" });
      if (!result || result.statusCode !== 200)
        throw fail(404, "Bukti absensi tidak ditemukan.");
      for (const [key, value] of Object.entries(SEC))
        res.setHeader(key, value);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Disposition", "inline");
      Readable.fromWeb(result.stream).pipe(res);
      return;
    }

    if (route === "attendance-proof" && method === "POST") {
      const body = await readObjectBody(req);
      if (typeof body.image !== "string")
        throw fail(400, "Foto bukti wajib diunggah.");
      const match = body.image.match(
        /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/,
      );
      if (!match) throw fail(400, "Format foto tidak valid. Gunakan JPG.");
      const image = Buffer.from(match[1], "base64");
      if (
        image.length === 0 ||
        image.length > MAX_PROOF_BYTES ||
        image.toString("base64") !== match[1] ||
        image[0] !== 0xff ||
        image[1] !== 0xd8 ||
        image[image.length - 2] !== 0xff ||
        image[image.length - 1] !== 0xd9
      )
        throw fail(400, "Foto tidak valid atau melebihi batas 500 KB.");
      const id = crypto.randomUUID();
      await put(blobPath(id), image, {
        access: "private",
        addRandomSuffix: false,
        contentType: "image/jpeg",
      });
      return send(res, 201, { ok: 1, id });
    }

    if (proof && method === "DELETE") {
      await del(blobPath(proof[1]), { access: "private" });
      return send(res, 200, { ok: 1 });
    }

    throw fail(404, "Not found");
  } catch (error) {
    if (!error.status) console.error(error);
    return send(res, error.status || 500, {
      error: error.status ? error.message : "Server error",
    });
  }
};
