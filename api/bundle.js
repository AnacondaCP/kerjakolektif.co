"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "..", "public");
const FILES = [
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

module.exports = function bundle(req, res) {
  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    FILES.map((file) => fs.readFileSync(path.join(PUBLIC, file), "utf8")).join(
      "\n",
    ),
  );
};
