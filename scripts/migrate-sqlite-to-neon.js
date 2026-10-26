"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { put } = require("@vercel/blob");
const { getDatabase } = require("../api/_db");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Atur DATABASE_URL dari Neon di environment lokal.");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("Atur BLOB_READ_WRITE_TOKEN dari private Blob store.");
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16)
    throw new Error("Atur ADMIN_PASSWORD minimal 16 karakter.");

  const localPath = path.join(
    process.env.DATA_DIR || path.join(__dirname, "..", "data"),
    "app.db",
  );
  if (!fs.existsSync(localPath))
    throw new Error("Database lokal tidak ditemukan di " + localPath);

  const local = new DatabaseSync(localPath, { readOnly: true });
  const stateRow = local.prepare("SELECT v FROM kv WHERE k='state'").get();
  const state = stateRow ? JSON.parse(stateRow.v) : null;
  if (
    stateRow &&
    (!state ||
      typeof state !== "object" ||
      Array.isArray(state) ||
      !["deals", "kols", "inv", "exp"].every((key) =>
        Array.isArray(state[key]),
      ))
  )
    throw new Error("Struktur payload SQLite tidak valid; data cloud tidak diubah.");
  const remote = await getDatabase();
  const [existingState] = await remote`
    SELECT payload FROM app_state WHERE id = 1
  `;
  const force = process.argv.includes("--force");

  if (
    state &&
    existingState &&
    JSON.stringify(stable(existingState.payload)) !==
      JSON.stringify(stable(state)) &&
    !force
  ) {
    throw new Error(
      "Neon sudah berisi data yang berbeda. Backup dulu; gunakan --force hanya jika ingin mengganti data cloud dengan data lokal.",
    );
  }

  const proofDir = path.join(path.dirname(localPath), "attendance-proofs");
  let uploaded = 0;
  if (fs.existsSync(proofDir)) {
    const files = fs.readdirSync(proofDir);
    for (const file of files) {
      const match = file.match(/^([0-9a-f-]{36})\.jpg$/i);
      if (!match) continue;
      const image = fs.readFileSync(path.join(proofDir, file));
      if (
        image.length === 0 ||
        image.length > 500_000 ||
        image[0] !== 0xff ||
        image[1] !== 0xd8 ||
        image[image.length - 2] !== 0xff ||
        image[image.length - 1] !== 0xd9
      )
        throw new Error("Bukti absensi tidak valid: " + file);
      await put("attendance-proofs/" + match[1] + ".jpg", image, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      uploaded += 1;
    }
  }

  if (state) {
    await remote`
      INSERT INTO app_state (id, payload)
      VALUES (1, ${JSON.stringify(state)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
  }

  local.close();
  console.log(
    "Migrasi selesai. Payload aplikasi: " +
      (state ? "dipindahkan" : "tidak ada") +
      "; bukti foto privat diunggah: " +
      uploaded +
      ". Pengguna dan audit log lokal tidak dipindahkan.",
  );
}

main().catch((error) => {
  console.error("Migrasi gagal: " + error.message);
  process.exitCode = 1;
});
