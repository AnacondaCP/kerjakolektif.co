"use strict";

const { neon } = require("@neondatabase/serverless");
const crypto = require("node:crypto");

let ready;

function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Vercel environment variable DATABASE_URL belum diatur.");
  return neon(process.env.DATABASE_URL);
}

async function initialize(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      hash TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS audit (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip TEXT NOT NULL,
      act TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      csrf TEXT NOT NULL,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS login_failures (
      ip TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL CHECK (attempts > 0),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  const users = await sql`SELECT username FROM users LIMIT 1`;
  if (!users.length) {
    const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!/^[a-z0-9_.-]{1,100}$/.test(username))
      throw new Error("ADMIN_USERNAME hanya boleh berisi huruf, angka, titik, _ atau -.");
    if (typeof password !== "string" || password.length < 16)
      throw new Error(
        "Sebelum login pertama, atur ADMIN_PASSWORD minimal 16 karakter di environment Vercel.",
      );
    const salt = crypto.randomBytes(16);
    const hashed = crypto.scryptSync(password, salt, 64);
    await sql`INSERT INTO users (username, hash) VALUES (
      ${username},
      ${salt.toString("hex") + ":" + hashed.toString("hex")}
    ) ON CONFLICT (username) DO NOTHING`;
  }
}

async function getDatabase() {
  if (!ready) {
    const sql = database();
    ready = initialize(sql).then(() => sql).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

module.exports = { getDatabase };
