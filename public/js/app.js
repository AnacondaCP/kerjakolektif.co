"use strict";

var $ = function (s, e) {
  return (e || document).querySelector(s);
};
var esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
};
var rp = function (n) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(+n || 0));
};
var num = function (v) {
  var n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : 0;
};
var uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
};
var today = function () {
  return new Date().toISOString().slice(0, 10);
};

var STAGES = ["Lead", "Brief", "Proposal", "Negosiasi", "Won", "Lost"];
var SERVICES = ["Buzzing", "Joki", "Digital Ads", "KOL Campaign"];
var PLATFORMS = ["Instagram", "TikTok", "YouTube", "X", "Facebook"];

var db;
function load() {
  db = window.__state || null;
  if (!db || !db.deals) {
    db = {
      deals: [
        {
          id: uid(),
          client: "PT Maju Jaya",
          contact: "Rina",
          wa: "08123456789",
          service: "Digital Ads",
          stage: "Proposal",
          value: 25000000,
          note: "Meta Ads 1 bulan",
        },
        {
          id: uid(),
          client: "Kopi Senja",
          contact: "Dimas",
          wa: "08111222333",
          service: "KOL Campaign",
          stage: "Brief",
          value: 15000000,
          note: "5 micro KOL",
        },
        {
          id: uid(),
          client: "Studio Nova",
          contact: "Alya",
          wa: "08555666777",
          service: "Buzzing",
          stage: "Won",
          value: 8000000,
          note: "Buzz launching",
        },
      ],
      kols: [
        {
          id: uid(),
          name: "@raniaskin",
          platform: "Instagram",
          followers: 120000,
          rate: 3500000,
          niche: "Beauty",
          status: "Aktif",
        },
        {
          id: uid(),
          name: "@bangdoni",
          platform: "TikTok",
          followers: 340000,
          rate: 6000000,
          niche: "Lifestyle",
          status: "Aktif",
        },
      ],
      inv: [],
      exp: [
        {
          id: uid(),
          date: today(),
          cat: "Ads Spend",
          desc: "Top up Meta Ads",
          amount: 5000000,
        },
        {
          id: uid(),
          date: today(),
          cat: "Fee KOL",
          desc: "DP @raniaskin",
          amount: 1750000,
        },
      ],
      seq: 0,
    };
  }
}
var st;
function api(method, url, body) {
  return window.KKAuth.api(method, url, body);
}
function save() {
  clearTimeout(st);
  st = setTimeout(function () {
    saveNow().catch(function (e) {
      alert("Gagal menyimpan: " + e.message);
      if (/Sesi/.test(e.message)) location.reload();
    });
  }, 300);
}
function saveNow() {
  clearTimeout(st);
  return api("PUT", "/api/state", db).then(function (result) {
    window.__state = db;
    return result;
  });
}
function enter() {
  api("GET", "/api/state")
    .then(function (s) {
      window.__state = s;
      boot();
      notif(true);
    })
    .catch(function (e) {
      $("#lerr").textContent = e.message;
    });
}

document.addEventListener("kk:authenticated", enter);

/* ---------- helpers ---------- */
var view = "dash";
function boot() {
  if (!window.__nb) {
    buildNav();
    window.__nb = 1;
  }
  $("#login").classList.add("hide");
  $("#app").classList.remove("hide");
  load();
  if (!window.__state || !window.__state.deals) save();
  go(view);
}
var MODS = {
  camp: {
    t: "Kampanye Ads",
    s: "Budget dan status kampanye iklan",
    f: [
      { k: "name", l: "Kampanye", req: 1 },
      { k: "client", l: "Klien" },
      {
        k: "platform",
        l: "Platform",
        o: ["Meta Ads", "TikTok Ads", "Google Ads", "Lainnya"],
      },
      { k: "budget", l: "Budget", t: "number", d: 0 },
      { k: "spent", l: "Terpakai", t: "number", d: 0 },
      { k: "status", l: "Status", o: ["Draft", "Aktif", "Selesai"] },
    ],
  },
  cont: {
    t: "Konten",
    s: "Kalender dan approval konten",
    f: [
      { k: "title", l: "Judul", req: 1 },
      { k: "client", l: "Klien" },
      { k: "platform", l: "Platform", o: PLATFORMS },
      { k: "date", l: "Tayang", t: "date", d: today() },
      {
        k: "status",
        l: "Status",
        o: ["Draft", "Review", "Approved", "Tayang"],
      },
    ],
  },
  buzz: {
    t: "Buzzing Member",
    s: "Database dan verifikasi member buzzing",
    f: [
      { k: "name", l: "Nama", req: 1 },
      { k: "contact", l: "Kontak" },
      { k: "platform", l: "Platform", o: PLATFORMS },
      { k: "saldo", l: "Saldo fee", t: "number", d: 0 },
      { k: "status", l: "Status", o: ["Pending", "Terverifikasi", "Ditolak"] },
    ],
  },
  vend: {
    t: "Vendor",
    s: "Daftar vendor dan supplier",
    f: [
      { k: "name", l: "Vendor", req: 1 },
      { k: "contact", l: "Kontak" },
      { k: "cat", l: "Kategori" },
      { k: "status", l: "Status", o: ["Aktif", "Nonaktif"] },
    ],
  },
  emp: {
    t: "Tim & Freelancer",
    s: "Data karyawan dan freelancer",
    f: [
      { k: "name", l: "Nama", req: 1 },
      { k: "role", l: "Posisi" },
      { k: "type", l: "Tipe", o: ["Karyawan", "Freelancer"] },
      { k: "salary", l: "Gaji / Fee", t: "number", d: 0 },
      { k: "status", l: "Status", o: ["Aktif", "Nonaktif"] },
    ],
  },
};
function mod(m, key) {
  var M = MODS[key] || genMod(key),
    money = { amount: 1, budget: 1, spent: 1, saldo: 1, salary: 1 };
  db.mods = db.mods || {};
  db.mods[key] = db.mods[key] || [];
  var rows = db.mods[key];
  m.innerHTML =
    head(
      M.t,
      M.s,
      '<button class="btn" id="mx">Export</button><button class="btn p" id="mn">+ Tambah</button>',
    ) +
    (M.ext
      ? '<div class="card" style="margin-bottom:16px"><b>Mode pencatatan.</b> <span class="mut">Otomasi atau integrasi nyata untuk fitur ini butuh API key dan pengembangan lanjutan.</span></div>'
      : "") +
    '<div class="card scroll"><table><tr>' +
    M.f
      .map(function (f) {
        return "<th>" + f.l + "</th>";
      })
      .join("") +
    "<th></th></tr>" +
    (rows
      .map(function (r) {
        return (
          "<tr>" +
          M.f
            .map(function (f) {
              var v = r[f.k];
              return (
                "<td>" +
                (money[f.k]
                  ? rp(v)
                  : f.k === "status"
                    ? '<span class="tag">' + esc(v) + "</span>"
                    : esc(v)) +
                "</td>"
              );
            })
            .join("") +
          '<td><button class="btn s" data-a="e" data-id="' +
          r.id +
          '">Edit</button> <button class="btn s" data-a="d" data-id="' +
          r.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="' +
        (M.f.length + 1) +
        '" class="mut">Belum ada data.</td></tr>') +
    "</table></div>";
  function mf(r) {
    form(r ? "Edit" : "Tambah", M.f, r, function (v) {
      M.f.forEach(function (f) {
        if (f.t === "number") v[f.k] = num(v[f.k]);
      });
      if (r) Object.assign(r, v);
      else {
        v.id = uid();
        rows.push(v);
      }
      save();
      go("m_" + key);
    });
  }
  $("#mn").onclick = function () {
    mf();
  };
  $("#mx").onclick = function () {
    sheetFile(
      M.t,
      M.f.map(function (f) {
        return f.l;
      }),
      rows.map(function (r) {
        return M.f.map(function (f) {
          return r[f.k] == null ? "" : r[f.k];
        });
      }),
    );
  };
  m.querySelector("table").onclick = function (e) {
    var a = e.target.getAttribute("data-a"),
      id = e.target.getAttribute("data-id");
    if (!a) return;
    var r = rows.filter(function (x) {
      return x.id === id;
    })[0];
    if (a === "e") mf(r);
    if (a === "d" && confirm("Hapus data ini?")) {
      db.mods[key] = rows.filter(function (x) {
        return x.id !== id;
      });
      save();
      go("m_" + key);
    }
  };
}
function nav2(e) {
  var el = e.target.closest("[data-go]");
  if (el) {
    close();
    go(el.getAttribute("data-go"));
  }
}
function search() {
  modal(
    '<h2>Cari</h2><input id="sq" placeholder="Klien, KOL, invoice, order, tugas..." autocomplete="off"><div id="sr" style="margin-top:12px"></div>',
  );
  $("#mod").onclick = nav2;
  $("#sq").focus();
  $("#sq").oninput = function () {
    var q = this.value.trim().toLowerCase(),
      out = [];
    if (q.length < 2) {
      $("#sr").innerHTML = "";
      return;
    }
    function add(arr, view, label, f) {
      (arr || []).forEach(function (x) {
        var t = f(x);
        if (t.toLowerCase().indexOf(q) > -1) out.push([view, label, t]);
      });
    }
    add(db.deals, "pipe", "Deal", function (x) {
      return x.client + " " + x.service;
    });
    add(db.kols, "kol", "KOL", function (x) {
      return x.name + " " + x.niche;
    });
    add(db.inv, "inv", "Invoice", function (x) {
      return x.no + " " + x.client;
    });
    add(db.orders, "ord", "Order", function (x) {
      return x.client + " " + x.desc;
    });
    add(db.tasks, "task", "Tugas", function (x) {
      return x.title;
    });
    $("#sr").innerHTML =
      out
        .slice(0, 20)
        .map(function (r) {
          return (
            '<div class="deal" data-go="' +
            r[0] +
            '" style="cursor:pointer"><small>' +
            r[1] +
            "</small><b>" +
            esc(r[2]) +
            "</b></div>"
          );
        })
        .join("") || '<div class="mut">Tidak ditemukan.</div>';
  };
}
function notif() {
  var n = [],
    t = today();
  db.inv.forEach(function (i) {
    if (i.status === "Jatuh Tempo" || (i.status === "Terkirim" && i.due < t))
      n.push(["inv", "Invoice " + i.no + " jatuh tempo (" + i.client + ")"]);
  });
  (db.tasks || []).forEach(function (x) {
    if (!x.done && x.due < t) n.push(["task", "Tugas telat: " + x.title]);
  });
  (db.orders || []).forEach(function (o) {
    if (o.status !== "Selesai" && o.deadline && o.deadline < t)
      n.push(["ord", "Order telat: " + o.client]);
  });
  db.inv.forEach(function (i) {
    if (i.status === "Draft")
      n.push(["inv", "Invoice " + i.no + " masih Draft, belum dikirim"]);
  });
  db.deals.forEach(function (d) {
    if (d.stage === "Negosiasi")
      n.push(["pipe", "Deal " + d.client + " di tahap Negosiasi, follow-up"]);
  });
  if (!num(db.target)) n.push(["dash", "Target bulanan belum diatur"]);
  modal(
    "<h2>Alert KerjaKolektif (" +
      n.length +
      ")</h2>" +
      (n
        .map(function (r) {
          return (
            '<div class="deal" data-go="' +
            r[0] +
            '" style="cursor:pointer">' +
            esc(r[1]) +
            "</div>"
          );
        })
        .join("") ||
        '<div class="mut">Semua aman, tidak ada yang telat.</div>') +
      '<div class="acts" style="margin-top:12px"><button class="btn" id="fc">Tutup</button></div>',
  );
  $("#mod").onclick = nav2;
  $("#fc").onclick = close;
}
$("#sb").onclick = search;
$("#nb").onclick = notif;
function audit(m) {
  m.innerHTML =
    head(
      "Audit Log",
      "Riwayat login dan keamanan",
      '<button class="btn" id="cp">Ganti Password</button>',
    ) +
    '<div class="card scroll"><table id="at"><tr><th>Waktu</th><th>IP</th><th>Aksi</th></tr></table></div>';
  $("#cp").onclick = function () {
    form(
      "Ganti password",
      [
        { k: "o", l: "Password lama", t: "password", full: 1 },
        { k: "n", l: "Password baru (min 8)", t: "password", full: 1 },
      ],
      null,
      function (v) {
        api("POST", "/api/password", { old: v.o, new: v.n })
          .then(function () {
            alert("Password diganti.");
          })
          .catch(function (e) {
            alert(e.message);
          });
      },
    );
  };
  api("GET", "/api/audit")
    .then(function (r) {
      $("#at").insertAdjacentHTML(
        "beforeend",
        r
          .map(function (x) {
            return (
              "<tr><td>" +
              esc(x.ts) +
              "</td><td>" +
              esc(x.ip) +
              "</td><td>" +
              esc(x.act) +
              "</td></tr>"
            );
          })
          .join(""),
      );
    })
    .catch(function () {});
}
var GROUPS = [
  ["CRM & Penjualan", "Pipeline>pipe|KOL Management>kol|Dokumen>doc"],
  [
    "Operasional",
    "Order>ord|Tugas>task|HR & Tim>hr|Kampanye Ads>m_camp|Konten>m_cont|Buzzing Member>m_buzz|Vendor>m_vend",
  ],
  ["Keuangan", "Invoice>inv|Finance>fin"],
  ["Laporan & Keamanan", "Laporan>rep|Audit Log>audit"],
];
var FEATS = {};
var GF = [
  { k: "name", l: "Nama / Judul", req: 1 },
  { k: "ref", l: "Klien / Proyek" },
  { k: "date", l: "Tanggal", t: "date", d: today() },
  { k: "amount", l: "Nominal", t: "number", d: 0 },
  { k: "status", l: "Status", o: ["Baru", "Proses", "Selesai", "Ditunda"] },
  { k: "note", l: "Catatan", full: 1 },
];
function genMod(key) {
  var F = FEATS[key] || { t: "Fitur" };
  return { t: F.t, s: "Kelola data " + F.t, ext: F.ext, f: GF };
}
function buildNav() {
  var h = "";
  GROUPS.forEach(function (g) {
    h +=
      "<details><summary>" +
      esc(g[0]) +
      "</summary>" +
      g[1]
        .split("|")
        .map(function (it) {
          var p = it.split(">");
          return '<a data-v="' + p[1] + '">' + esc(p[0]) + "</a>";
        })
        .join("") +
      "</details>";
  });
  $("#nav .sp").insertAdjacentHTML("beforebegin", h);
}
function menu(o) {
  $("#nav").classList.toggle("open", o);
  $("#scrim").classList.toggle("on", o);
}
$("#mb").onclick = function () {
  menu(!$("#nav").classList.contains("open"));
};
$("#scrim").onclick = function () {
  menu(false);
};
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") menu(false);
});
$("#nav").onclick = function (e) {
  var v = e.target.getAttribute("data-v");
  if (v) {
    go(v);
    menu(false);
    window.scrollTo(0, 0);
  }
};
function go(v) {
  view = v;
  document.querySelectorAll("#nav a[data-v]").forEach(function (a) {
    var active = a.getAttribute("data-v") === v;
    a.classList.toggle("on", active);
    if (active && a.closest("details")) a.closest("details").open = true;
  });
  var m = $("#main");
  if (v.slice(0, 2) === "m_") return mod(m, v.slice(2));
  ({
    dash: dash,
    pipe: pipe,
    kol: kol,
    inv: inv,
    task: task,
    ord: ord,
    doc: doc,
    fin: fin,
    hr: hr,
    rep: rep,
    audit: audit,
  })[v](m);
}
function head(t, sub, btns) {
  return (
    '<div class="top"><div><h1>' +
    t +
    '</h1><div class="mut">' +
    sub +
    '</div></div><div class="acts">' +
    (btns || "") +
    "</div></div>"
  );
}
function close() {
  $("#mod").innerHTML = "";
}
function modal(html, wide) {
  $("#mod").oninput = null;
  $("#mod").onclick = null;
  $("#mod").innerHTML =
    '<div class="modal" id="ov"><div class="sheet' +
    (wide ? " wide" : "") +
    '">' +
    html +
    "</div></div>";
  $("#ov").onmousedown = function (e) {
    if (e.target.id === "ov") close();
  };
}
function opts(arr, sel) {
  return arr
    .map(function (o) {
      return (
        "<option" + (o === sel ? " selected" : "") + ">" + esc(o) + "</option>"
      );
    })
    .join("");
}

function form(title, fields, vals, onSave) {
  vals = vals || {};
  var h =
    "<h2>" +
    title +
    '</h2><div class="two">' +
    fields
      .map(function (f) {
        var v = vals[f.k] != null ? vals[f.k] : f.d || "";
        var inp = f.o
          ? '<select data-k="' + f.k + '">' + opts(f.o, v) + "</select>"
          : '<input data-k="' +
            f.k +
            '" type="' +
            (f.t || "text") +
            '" value="' +
            esc(v) +
            '"' +
            (f.t === "number" ? ' min="0"' : "") +
            ">";
        return (
          '<div style="' +
          (f.full ? "grid-column:1/-1" : "") +
          '"><label>' +
          f.l +
          "</label>" +
          inp +
          "</div>"
        );
      })
      .join("") +
    '</div><div class="err" id="ferr"></div><div class="acts" style="margin-top:14px"><button class="btn p" id="fs">Simpan</button><button class="btn" id="fc">Batal</button></div>';
  modal(h);
  $("#fc").onclick = close;
  $("#fs").onclick = function () {
    var out = {};
    document.querySelectorAll("#mod [data-k]").forEach(function (el) {
      out[el.getAttribute("data-k")] = el.value.trim();
    });
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].req && !out[fields[i].k]) {
        $("#ferr").textContent = fields[i].l + " wajib diisi.";
        return;
      }
    }
    onSave(out);
    close();
  };
}
