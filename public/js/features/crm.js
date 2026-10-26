/* ---------- pipeline ---------- */
function dealForm(d) {
  form(
    d ? "Edit deal" : "Deal baru",
    [
      { k: "client", l: "Klien", req: 1 },
      { k: "contact", l: "Kontak" },
      { k: "wa", l: "WhatsApp" },
      { k: "service", l: "Layanan", o: SERVICES },
      { k: "stage", l: "Stage", o: STAGES },
      { k: "value", l: "Nilai (Rp)", t: "number", d: 0 },
      { k: "note", l: "Catatan", full: 1 },
    ],
    d,
    function (o) {
      o.value = num(o.value);
      if (d) Object.assign(d, o);
      else {
        o.id = uid();
        db.deals.push(o);
      }
      save();
      go("pipe");
    },
  );
}
function pipe(m) {
  m.innerHTML =
    head(
      "Pipeline",
      "Kelola prospek dari lead sampai closing",
      '<button class="btn p" id="nd">+ Deal</button>',
    ) +
    '<div class="toolbar"><input id="pq" placeholder="Cari klien..." value="' +
    esc(pf.q) +
    '"><select id="ps"><option value="">Semua layanan</option>' +
    opts(SERVICES, pf.s) +
    "</select></div>" +
    '<div class="board">' +
    STAGES.map(function (s) {
      var ds = db.deals.filter(function (d) {
        return (
          d.stage === s &&
          (!pf.s || d.service === pf.s) &&
          (!pf.q || d.client.toLowerCase().indexOf(pf.q.toLowerCase()) > -1)
        );
      });
      return (
        '<div class="col"><h3><span>' +
        s +
        "</span><span>" +
        ds.length +
        "</span></h3>" +
        ds
          .map(function (d) {
            var i = STAGES.indexOf(d.stage);
            return (
              '<div class="deal"><b>' +
              esc(d.client) +
              "</b><small>" +
              esc(d.service) +
              " · " +
              rp(d.value) +
              "</small><small style='display:block'>" +
              esc(d.note) +
              '</small><div class="r">' +
              (i > 0
                ? '<button class="btn s" data-a="prev" data-id="' +
                  d.id +
                  '">←</button>'
                : "") +
              (i < STAGES.length - 1
                ? '<button class="btn s" data-a="next" data-id="' +
                  d.id +
                  '">→</button>'
                : "") +
              '<button class="btn s" data-a="edit" data-id="' +
              d.id +
              '">Edit</button>' +
              '<button class="btn s" data-a="del" data-id="' +
              d.id +
              '">Hapus</button></div></div>'
            );
          })
          .join("") +
        "</div>"
      );
    }).join("") +
    "</div>";
  $("#nd").onclick = function () {
    dealForm();
  };
  $("#pq").oninput = function () {
    pf.q = this.value;
    pipe(m);
    var q = $("#pq");
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  };
  $("#ps").onchange = function () {
    pf.s = this.value;
    pipe(m);
  };
  m.querySelector(".board").onclick = function (e) {
    var a = e.target.getAttribute("data-a"),
      id = e.target.getAttribute("data-id");
    if (!a) return;
    var d = db.deals.filter(function (x) {
      return x.id === id;
    })[0];
    if (!d) return;
    var i = STAGES.indexOf(d.stage);
    if (a === "prev") d.stage = STAGES[i - 1];
    if (a === "next") d.stage = STAGES[i + 1];
    if (a === "edit") return dealForm(d);
    if (a === "del") {
      if (!confirm("Hapus deal ini?")) return;
      db.deals = db.deals.filter(function (x) {
        return x.id !== id;
      });
    }
    save();
    go("pipe");
  };
}

/* ---------- KOL ---------- */
function kol(m) {
  m.innerHTML =
    head(
      "KOL Management",
      "Database influencer &amp; rate card",
      '<button class="btn p" id="nk">+ KOL</button>',
    ) +
    '<div class="card scroll"><table><tr><th>Nama</th><th>Platform</th><th>Followers</th><th>Niche</th><th>Rate</th><th>Status</th><th></th></tr>' +
    (db.kols
      .map(function (k) {
        return (
          "<tr><td><b>" +
          esc(k.name) +
          "</b></td><td>" +
          esc(k.platform) +
          "</td><td>" +
          new Intl.NumberFormat("id-ID").format(k.followers) +
          "</td><td>" +
          esc(k.niche) +
          "</td><td>" +
          rp(k.rate) +
          '</td><td><span class="tag' +
          (k.status === "Aktif" ? " f" : "") +
          '">' +
          esc(k.status) +
          '</span></td><td><button class="btn s" data-a="e" data-id="' +
          k.id +
          '">Edit</button> <button class="btn s" data-a="d" data-id="' +
          k.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") || '<tr><td colspan="7" class="mut">Belum ada KOL.</td></tr>') +
    "</table></div>";
  function kf(k) {
    form(
      k ? "Edit KOL" : "KOL baru",
      [
        { k: "name", l: "Username", req: 1 },
        { k: "platform", l: "Platform", o: PLATFORMS },
        { k: "followers", l: "Followers", t: "number", d: 0 },
        { k: "rate", l: "Rate (Rp)", t: "number", d: 0 },
        { k: "niche", l: "Niche" },
        { k: "status", l: "Status", o: ["Aktif", "Nonaktif"] },
      ],
      k,
      function (o) {
        o.followers = num(o.followers);
        o.rate = num(o.rate);
        if (k) Object.assign(k, o);
        else {
          o.id = uid();
          db.kols.push(o);
        }
        save();
        go("kol");
      },
    );
  }
  $("#nk").onclick = function () {
    kf();
  };
  m.querySelector("table").onclick = function (e) {
    var a = e.target.getAttribute("data-a"),
      id = e.target.getAttribute("data-id");
    if (!a) return;
    var k = db.kols.filter(function (x) {
      return x.id === id;
    })[0];
    if (a === "e") kf(k);
    if (a === "d" && confirm("Hapus KOL?")) {
      db.kols = db.kols.filter(function (x) {
        return x.id !== id;
      });
      save();
      go("kol");
    }
  };
}
