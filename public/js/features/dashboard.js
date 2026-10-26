/* ---------- dashboard ---------- */
function totals() {
  var paid = 0,
    unpaid = 0;
  db.inv.forEach(function (i) {
    var t = calc(i).total;
    if (i.status === "Lunas") paid += t;
    else if (i.status !== "Draft") unpaid += t;
  });
  var exp = db.exp.reduce(function (a, e) {
    return a + num(e.amount);
  }, 0);
  return { paid: paid, unpaid: unpaid, exp: exp, profit: paid - exp };
}
var pf = { q: "", s: "" };
function extra() {
  var W = { Lead: 0.1, Brief: 0.25, Proposal: 0.5, Negosiasi: 0.75 },
    f = 0,
    svc = {};
  db.deals.forEach(function (d) {
    if (W[d.stage]) f += num(d.value) * W[d.stage];
    if (d.stage === "Won")
      svc[d.service] = (svc[d.service] || 0) + num(d.value);
  });
  var top = Object.keys(svc).sort(function (a, b) {
    return svc[b] - svc[a];
  })[0];
  var od = db.inv.filter(function (i) {
    return (
      i.status === "Jatuh Tempo" || (i.status === "Terkirim" && i.due < today())
    );
  }).length;
  var now = new Date(),
    rows = "";
  for (var n = 5; n >= 0; n--) {
    var x = new Date(now.getFullYear(), now.getMonth() - n, 1);
    var mk = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
    var inc = db.inv
      .filter(function (i) {
        return i.status === "Lunas" && String(i.date).slice(0, 7) === mk;
      })
      .reduce(function (a, i) {
        return a + calc(i).total;
      }, 0);
    var out = db.exp
      .filter(function (e) {
        return String(e.date).slice(0, 7) === mk;
      })
      .reduce(function (a, e) {
        return a + num(e.amount);
      }, 0);
    rows +=
      "<tr><td>" +
      mk +
      "</td><td>" +
      rp(inc) +
      "</td><td>" +
      rp(out) +
      "</td><td><b>" +
      rp(inc - out) +
      "</b></td></tr>";
  }
  var tg = num(db.target),
    cm = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var cur = db.inv
    .filter(function (i) {
      return i.status === "Lunas" && String(i.date).slice(0, 7) === cm;
    })
    .reduce(function (a, i) {
      return a + calc(i).total;
    }, 0);
  var pct = tg ? Math.min(100, (cur / tg) * 100) : 0;
  var tcard =
    '<div class="card" style="margin-bottom:16px"><div class="top" style="margin:0 0 12px"><h2 style="margin:0">Target bulan ini</h2><button class="btn s" id="tg">Atur target</button></div><div style="height:10px;border:1px solid var(--fg);border-radius:6px;overflow:hidden"><div style="height:100%;width:' +
    pct +
    '%;background:var(--inv)"></div></div><div class="mut" style="margin-top:8px">' +
    rp(cur) +
    " dari " +
    (tg ? rp(tg) : "belum diatur") +
    " (" +
    Math.round(pct) +
    "%)</div></div>";
  return (
    tcard +
    (od
      ? '<div class="card" style="margin-bottom:16px;border-color:var(--fg)"><b>' +
        od +
        ' invoice jatuh tempo</b> <span class="mut">perlu follow-up segera.</span></div>'
      : "") +
    '<div class="grid"><div class="card"><div class="k">Forecast pipeline (tertimbang)</div><div class="v">' +
    rp(f) +
    '</div></div><div class="card"><div class="k">Layanan terlaris (Won)</div><div class="v">' +
    esc(top || "-") +
    "</div></div></div>" +
    '<div class="card scroll" style="margin-bottom:16px"><h2>Arus kas 6 bulan</h2><table><tr><th>Bulan</th><th>Masuk</th><th>Keluar</th><th>Net</th></tr>' +
    rows +
    "</table></div>"
  );
}
function dash(m) {
  hrInit();
  var t = totals();
  var open = db.deals.filter(function (d) {
    return d.stage !== "Won" && d.stage !== "Lost";
  });
  var pv = open.reduce(function (a, d) {
    return a + num(d.value);
  }, 0);
  var mx = Math.max.apply(
    null,
    STAGES.map(function (s) {
      return db.deals.filter(function (d) {
        return d.stage === s;
      }).length;
    }).concat(1),
  );
  m.innerHTML =
    head("Dashboard", "Ringkasan bisnis hari ini") +
    '<div class="grid">' +
    [
      ["Pipeline aktif", rp(pv)],
      ["Pendapatan lunas", rp(t.paid)],
      ["Piutang", rp(t.unpaid)],
      ["Profit bersih", rp(t.profit)],
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
    hrDashboardAttendance() +
    extra() +
    '<div class="card"><h2>Deal per stage</h2><div class="bar" style="margin-bottom:24px">' +
    STAGES.map(function (s) {
      var n = db.deals.filter(function (d) {
        return d.stage === s;
      }).length;
      return (
        '<div style="height:' +
        Math.max(3, (n / mx) * 100) +
        '%"><span>' +
        s +
        " (" +
        n +
        ")</span></div>"
      );
    }).join("") +
    "</div></div>";
  $("#dashAttendance").onclick = function () {
    hrAttendanceForm();
  };
  m.onclick = function (event) {
    var employeeButton = event.target.closest("[data-dash-employee]");
    var attendanceButton = event.target.closest("[data-dash-attendance]");
    if (employeeButton) {
      hrAttendanceForm(null, employeeButton.getAttribute("data-dash-employee"));
    } else if (attendanceButton) {
      hrAttendanceForm(
        db.attendance.find(function (entry) {
          return (
            entry.id === attendanceButton.getAttribute("data-dash-attendance")
          );
        }),
      );
    }
  };
}

function hrDashboardAttendance() {
  var date = hrToday();
  var active = db.team.filter(function (employee) {
    return employee.status === "Aktif";
  });
  var records = db.attendance.filter(function (entry) {
    return entry.date === date;
  });
  var attended = active.filter(function (employee) {
    return records.some(function (entry) {
      return entry.employeeId === employee.id;
    });
  }).length;
  var rows = active.map(function (employee) {
    var entry = records.find(function (record) {
      return record.employeeId === employee.id;
    });
    var evidence =
      entry && entry.proofId
        ? '<a href="/api/attendance-proof/' +
          encodeURIComponent(entry.proofId) +
          '" target="_blank" rel="noopener" aria-label="Lihat bukti absensi ' +
          esc(employee.name) +
          '"><img class="attendance-thumb" src="/api/attendance-proof/' +
          encodeURIComponent(entry.proofId) +
          '" alt="Bukti absensi ' +
          esc(employee.name) +
          '"></a>'
        : '<span class="mut">Belum ada foto</span>';
    return (
      "<tr><td><b>" +
      esc(employee.name) +
      '</b><small class="attendance-role">' +
      esc(employee.role || employee.type) +
      "</small></td><td>" +
      (entry
        ? '<span class="tag' +
          (entry.status === "Hadir" || entry.status === "Terlambat"
            ? " f"
            : "") +
          '">' +
          esc(entry.status) +
          "</span>"
        : '<span class="mut">Belum absen</span>') +
      "</td><td>" +
      (entry ? esc(entry.time || "-") : "-") +
      "</td><td>" +
      evidence +
      "</td><td>" +
      (entry
        ? '<button class="btn s" data-dash-attendance="' +
          esc(entry.id) +
          '">Edit</button>'
        : '<button class="btn s" data-dash-employee="' +
          esc(employee.id) +
          '">Absen</button>') +
      "</td></tr>"
    );
  });

  return (
    '<section class="card dashboard-attendance"><div class="top"><div><h2>Absensi Tim Hari Ini</h2><div class="mut">' +
    esc(date) +
    " · " +
    attended +
    " dari " +
    active.length +
    ' pegawai tercatat</div></div><button class="btn p" id="dashAttendance" ' +
    (active.length ? "" : "disabled") +
    '>+ Absen Tim</button></div><div class="scroll"><table><tr><th>Tim</th><th>Status</th><th>Waktu</th><th>Bukti foto</th><th></th></tr>' +
    (rows.join("") ||
      '<tr><td colspan="5" class="mut">Belum ada data tim aktif. Tambahkan tim melalui menu HR & Tim.</td></tr>') +
    "</table></div></section>"
  );
}
