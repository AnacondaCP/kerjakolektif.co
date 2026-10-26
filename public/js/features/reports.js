/* ---------- reports (styled .xls) ---------- */
function sheetFile(name, cols, rows) {
  var th =
      "background:#000;color:#fff;font-weight:bold;border:1px solid #000;padding:6px",
    td = "border:1px solid #bbb;padding:5px;mso-number-format:'\\@'";
  var h =
    '<html><head><meta charset="utf-8"></head><body><table><tr><td colspan="' +
    cols.length +
    '" style="font-size:16pt;font-weight:bold">' +
    esc(name) +
    "</td></tr><tr></tr><tr>" +
    cols
      .map(function (c) {
        return '<th style="' + th + '">' + esc(c) + "</th>";
      })
      .join("") +
    "</tr>" +
    rows
      .map(function (r, n) {
        return (
          "<tr>" +
          r
            .map(function (c) {
              return (
                '<td style="' +
                td +
                (n % 2 ? ";background:#f2f2f2" : "") +
                '">' +
                esc(c) +
                "</td>"
              );
            })
            .join("") +
          "</tr>"
        );
      })
      .join("") +
    "</table></body></html>";
  var a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + h], { type: "application/vnd.ms-excel" }),
  );
  a.download = name.toLowerCase().replace(/\s+/g, "-") + "-" + today() + ".xls";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function rep(m) {
  m.innerHTML =
    head("Laporan", "Unduh data dalam format sheet berdesain") +
    '<div class="grid">' +
    [
      ["Pipeline", "pipe"],
      ["Invoice", "inv"],
      ["Pengeluaran", "exp"],
      ["KOL", "kol"],
      ["Backup JSON", "bak"],
      ["Restore JSON", "res"],
    ]
      .map(function (r) {
        return (
          '<div class="card"><h2>' +
          r[0] +
          '</h2><button class="btn p" data-r="' +
          r[1] +
          '">' +
          (r[1] === "res" ? "Pilih File" : "Download") +
          "</button></div>"
        );
      })
      .join("") +
    "</div>";
  m.onclick = function (e) {
    var r = e.target.getAttribute("data-r");
    if (!r) return;
    if (r === "bak") {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(db)], { type: "application/json" }),
      );
      a.download = "backup-" + today() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (r === "res") {
      var fi = document.createElement("input");
      fi.type = "file";
      fi.accept = ".json";
      fi.onchange = function () {
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var o = JSON.parse(rd.result);
            if (
              !o ||
              !Array.isArray(o.deals) ||
              !Array.isArray(o.kols) ||
              !Array.isArray(o.inv) ||
              !Array.isArray(o.exp)
            )
              throw 0;
            db = o;
            save();
            go("rep");
            alert("Restore berhasil.");
          } catch (x) {
            alert("File backup tidak valid.");
          }
        };
        if (fi.files[0]) rd.readAsText(fi.files[0]);
      };
      fi.click();
      return;
    }
    if (r === "pipe")
      sheetFile(
        "Laporan Pipeline",
        ["Klien", "Kontak", "Layanan", "Stage", "Nilai"],
        db.deals.map(function (d) {
          return [d.client, d.contact, d.service, d.stage, d.value];
        }),
      );
    if (r === "inv")
      sheetFile(
        "Laporan Invoice",
        ["No", "Klien", "Tanggal", "Jatuh Tempo", "Status", "Total", "Sisa"],
        db.inv.map(function (i) {
          var c = calc(i);
          return [i.no, i.client, i.date, i.due, i.status, c.total, c.due];
        }),
      );
    if (r === "exp")
      sheetFile(
        "Laporan Pengeluaran",
        ["Tanggal", "Kategori", "Deskripsi", "Jumlah"],
        db.exp.map(function (x) {
          return [x.date, x.cat, x.desc, x.amount];
        }),
      );
    if (r === "kol")
      sheetFile(
        "Laporan KOL",
        ["Nama", "Platform", "Followers", "Niche", "Rate", "Status"],
        db.kols.map(function (k) {
          return [k.name, k.platform, k.followers, k.niche, k.rate, k.status];
        }),
      );
  };
}

$("#main").addEventListener("click", function (e) {
  if (e.target.id !== "tg") return;
  form(
    "Target bulanan",
    [
      {
        k: "v",
        l: "Target pendapatan (Rp)",
        t: "number",
        d: db.target || 0,
        full: 1,
      },
    ],
    { v: db.target || 0 },
    function (o) {
      db.target = num(o.v);
      save();
      go("dash");
    },
  );
});
$("#th").onclick = function () {
  var r = document.documentElement,
    d = r.getAttribute("data-theme");
  var dark = d
    ? d === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  r.setAttribute("data-theme", dark ? "light" : "dark");
};
