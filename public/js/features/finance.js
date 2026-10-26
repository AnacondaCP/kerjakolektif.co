/* ---------- finance ---------- */
function aging() {
  var b = [0, 0, 0, 0],
    t0 = new Date(today()).getTime();
  db.inv.forEach(function (i) {
    if (i.status === "Draft" || i.status === "Lunas") return;
    var dd = Math.floor((t0 - new Date(i.due).getTime()) / 864e5),
      k = dd <= 0 ? 0 : dd <= 30 ? 1 : dd <= 60 ? 2 : 3;
    b[k] += calc(i).due;
  });
  var L = [
    "belum jatuh tempo",
    "telat 1-30 hari",
    "telat 31-60 hari",
    "telat >60 hari",
  ];
  return (
    '<div class="grid">' +
    b
      .map(function (v, n) {
        return (
          '<div class="card"><div class="k">Piutang ' +
          L[n] +
          '</div><div class="v">' +
          rp(v) +
          "</div></div>"
        );
      })
      .join("") +
    "</div>"
  );
}
var CATS = [
  "Ads Spend",
  "Fee KOL",
  "Fee Joki",
  "Gaji",
  "Operasional",
  "Lainnya",
];
function fin(m) {
  var t = totals();
  m.innerHTML =
    head(
      "Finance",
      "Arus kas, pengeluaran, dan profit",
      '<button class="btn p" id="ne">+ Pengeluaran</button>',
    ) +
    '<div class="grid">' +
    [
      ["Pemasukan", rp(t.paid)],
      ["Pengeluaran", rp(t.exp)],
      ["Profit", rp(t.profit)],
      ["Piutang", rp(t.unpaid)],
    ]
      .map(function (c) {
        return (
          '<div class="card"><div class="k">' +
          c[0] +
          '</div><div class="v">' +
          c[1] +
          "</div></div>"
        );
      })
      .join("") +
    "</div>" +
    aging() +
    '<div class="card scroll"><table><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Jumlah</th><th></th></tr>' +
    (db.exp
      .map(function (e) {
        return (
          "<tr><td>" +
          esc(e.date) +
          "</td><td>" +
          esc(e.cat) +
          "</td><td>" +
          esc(e.desc) +
          "</td><td>" +
          rp(e.amount) +
          '</td><td><button class="btn s" data-id="' +
          e.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="5" class="mut">Belum ada pengeluaran.</td></tr>') +
    "</table></div>";
  $("#ne").onclick = function () {
    form(
      "Pengeluaran baru",
      [
        { k: "date", l: "Tanggal", t: "date", d: today() },
        { k: "cat", l: "Kategori", o: CATS },
        { k: "desc", l: "Deskripsi", req: 1, full: 1 },
        { k: "amount", l: "Jumlah (Rp)", t: "number", d: 0 },
      ],
      null,
      function (o) {
        o.amount = num(o.amount);
        o.id = uid();
        db.exp.push(o);
        save();
        go("fin");
      },
    );
  };
  m.querySelector("table").onclick = function (e) {
    var id = e.target.getAttribute("data-id");
    if (id && confirm("Hapus pengeluaran?")) {
      db.exp = db.exp.filter(function (x) {
        return x.id !== id;
      });
      save();
      go("fin");
    }
  };
}
