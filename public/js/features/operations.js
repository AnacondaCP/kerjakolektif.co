/* ---------- orders ---------- */
var OS = ["Antri", "Proses", "Review", "Selesai"];
function ord(m) {
  db.orders = db.orders || [];
  m.innerHTML =
    head(
      "Order",
      "Tracker pengerjaan buzzing, joki, ads, dan KOL",
      '<button class="btn p" id="no">+ Order</button>',
    ) +
    '<div class="card scroll"><table><tr><th>Klien</th><th>Layanan</th><th>Detail</th><th>Deadline</th><th>PIC</th><th>Status</th><th></th></tr>' +
    (db.orders
      .map(function (o) {
        var late = o.status !== "Selesai" && o.deadline && o.deadline < today();
        return (
          "<tr><td><b>" +
          esc(o.client) +
          "</b></td><td>" +
          esc(o.service) +
          "</td><td>" +
          esc(o.desc) +
          "</td><td>" +
          esc(o.deadline) +
          (late ? ' <span class="tag f">Telat</span>' : "") +
          "</td><td>" +
          esc(o.pic) +
          '</td><td><span class="tag' +
          (o.status === "Selesai" ? " f" : "") +
          '">' +
          esc(o.status) +
          '</span></td><td><button class="btn s" data-a="n" data-id="' +
          o.id +
          '">Next</button> <button class="btn s" data-a="e" data-id="' +
          o.id +
          '">Edit</button> <button class="btn s" data-a="d" data-id="' +
          o.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="7" class="mut">Belum ada order.</td></tr>') +
    "</table></div>";
  function oform(o) {
    form(
      o ? "Edit order" : "Order baru",
      [
        { k: "client", l: "Klien", req: 1 },
        { k: "service", l: "Layanan", o: SERVICES },
        { k: "desc", l: "Detail", full: 1 },
        { k: "deadline", l: "Deadline", t: "date", d: today() },
        { k: "pic", l: "PIC" },
        { k: "status", l: "Status", o: OS },
      ],
      o,
      function (v) {
        if (o) Object.assign(o, v);
        else {
          v.id = uid();
          db.orders.push(v);
        }
        save();
        go("ord");
      },
    );
  }
  $("#no").onclick = function () {
    oform();
  };
  m.querySelector("table").onclick = function (e) {
    var a = e.target.getAttribute("data-a"),
      id = e.target.getAttribute("data-id");
    if (!a) return;
    var o = db.orders.filter(function (x) {
      return x.id === id;
    })[0];
    if (a === "n") {
      var n = OS.indexOf(o.status);
      if (n < OS.length - 1) o.status = OS[n + 1];
      save();
      go("ord");
    }
    if (a === "e") oform(o);
    if (a === "d" && confirm("Hapus order?")) {
      db.orders = db.orders.filter(function (x) {
        return x.id !== id;
      });
      save();
      go("ord");
    }
  };
}

/* ---------- documents ---------- */
function doc(m) {
  m.innerHTML =
    head(
      "Dokumen",
      "Generate surat penawaran, SPK, dan kwitansi dari data deal",
    ) +
    '<div class="card scroll"><table><tr><th>Klien</th><th>Layanan</th><th>Nilai</th><th>Buat dokumen</th></tr>' +
    (db.deals
      .map(function (d) {
        return (
          "<tr><td><b>" +
          esc(d.client) +
          "</b></td><td>" +
          esc(d.service) +
          "</td><td>" +
          rp(d.value) +
          "</td><td>" +
          ["Penawaran", "SPK", "Kwitansi"]
            .map(function (t) {
              return (
                '<button class="btn s" data-id="' +
                d.id +
                '" data-t="' +
                t +
                '">' +
                t +
                "</button>"
              );
            })
            .join(" ") +
          "</td></tr>"
        );
      })
      .join("") ||
      '<tr><td colspan="4" class="mut">Belum ada deal.</td></tr>') +
    "</table></div>";
  m.querySelector("table").onclick = function (e) {
    var id = e.target.getAttribute("data-id"),
      t = e.target.getAttribute("data-t");
    if (!id || !t) return;
    var d = db.deals.filter(function (x) {
      return x.id === id;
    })[0];
    if (!d) return;
    var body = {
      Penawaran:
        "Dengan hormat, bersama ini kami mengajukan penawaran layanan " +
        d.service +
        " untuk " +
        d.client +
        " dengan nilai investasi " +
        rp(d.value) +
        ". Penawaran berlaku 14 hari sejak tanggal surat.",
      SPK:
        "Pihak Pertama (" +
        d.client +
        ") menunjuk Pihak Kedua (KerjaKolektif) untuk melaksanakan layanan " +
        d.service +
        " senilai " +
        rp(d.value) +
        ". Pembayaran DP 50% di awal dan pelunasan setelah pekerjaan selesai.",
      Kwitansi:
        "Telah diterima dari " +
        d.client +
        " uang sejumlah " +
        rp(d.value) +
        " untuk pembayaran layanan " +
        d.service +
        ".",
    }[t];
    modal(
      '<div class="paper"><div class="hd"><div><div class="big">' +
        t.toUpperCase() +
        "</div><div>No: DOC/" +
        new Date().getFullYear() +
        "/" +
        id.slice(-4).toUpperCase() +
        '</div></div><div style="text-align:right"><b>KERJAKOLEKTIF</b><br>' +
        today() +
        "</div></div><p>Kepada Yth. <b>" +
        esc(d.client) +
        "</b><br>UP: " +
        esc(d.contact) +
        "</p><p style='line-height:1.8'>" +
        esc(body) +
        "</p><p>" +
        esc(d.note) +
        '</p><div class="ft"><div></div><div style="text-align:center">Hormat kami,<br><br><br><br>(__________________)</div></div></div><div class="acts" style="margin-top:14px"><button class="btn p" id="pr">Cetak / PDF</button><button class="btn" id="fc">Tutup</button></div>',
      true,
    );
    $("#fc").onclick = close;
    $("#pr").onclick = function () {
      window.print();
    };
  };
}

/* ---------- tasks ---------- */
function task(m) {
  db.tasks = db.tasks || [];
  var ts = db.tasks.slice().sort(function (a, b) {
    return a.done - b.done || (a.due < b.due ? -1 : 1);
  });
  m.innerHTML =
    head(
      "Tugas",
      "Follow-up klien dan deadline",
      '<button class="btn p" id="nt">+ Tugas</button>',
    ) +
    '<div class="card scroll"><table><tr><th style="width:40px"></th><th>Tugas</th><th>Tenggat</th><th>Prioritas</th><th></th></tr>' +
    (ts
      .map(function (t) {
        return (
          '<tr><td><input type="checkbox" style="width:auto" data-t="' +
          t.id +
          '"' +
          (t.done ? " checked" : "") +
          '></td><td style="' +
          (t.done ? "text-decoration:line-through;color:var(--mut)" : "") +
          '">' +
          esc(t.title) +
          "</td><td>" +
          esc(t.due) +
          (!t.done && t.due < today()
            ? ' <span class="tag f">Telat</span>'
            : "") +
          '</td><td><span class="tag">' +
          esc(t.pri) +
          '</span></td><td><button class="btn s" data-x="' +
          t.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="5" class="mut">Belum ada tugas.</td></tr>') +
    "</table></div>";
  $("#nt").onclick = function () {
    form(
      "Tugas baru",
      [
        { k: "title", l: "Tugas", req: 1, full: 1 },
        { k: "due", l: "Tenggat", t: "date", d: today() },
        { k: "pri", l: "Prioritas", o: ["Tinggi", "Sedang", "Rendah"] },
      ],
      null,
      function (o) {
        o.id = uid();
        o.done = 0;
        db.tasks.push(o);
        save();
        go("task");
      },
    );
  };
  m.querySelector("table").onclick = function (e) {
    var c = e.target.getAttribute("data-t"),
      x = e.target.getAttribute("data-x");
    if (c) {
      db.tasks.forEach(function (t) {
        if (t.id === c) t.done = t.done ? 0 : 1;
      });
      save();
      go("task");
    }
    if (x) {
      db.tasks = db.tasks.filter(function (t) {
        return t.id !== x;
      });
      save();
      go("task");
    }
  };
}
