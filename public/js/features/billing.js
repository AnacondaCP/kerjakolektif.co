/* ---------- invoice ---------- */
function calc(i) {
  var sub = (i.items || []).reduce(function (a, it) {
    return a + num(it.qty) * num(it.price);
  }, 0);
  var disc = Math.min(sub, num(i.discount));
  var base = sub - disc,
    tax = base * (num(i.tax) / 100);
  return {
    sub: sub,
    disc: disc,
    tax: tax,
    total: base + tax,
    due: base + tax - num(i.dp),
  };
}
function inv(m) {
  db.inv.forEach(function (i) {
    if (i.status === "Terkirim" && i.due < today()) i.status = "Jatuh Tempo";
  });
  save();
  m.innerHTML =
    head(
      "Invoice",
      "Buat, kirim, dan lacak pembayaran",
      '<button class="btn p" id="ni">+ Invoice</button>',
    ) +
    '<div class="card scroll"><table><tr><th>No</th><th>Klien</th><th>Jatuh tempo</th><th>Total</th><th>Status</th><th></th></tr>' +
    (db.inv
      .map(function (i) {
        return (
          "<tr><td><b>" +
          esc(i.no) +
          "</b></td><td>" +
          esc(i.client) +
          "</td><td>" +
          esc(i.due) +
          "</td><td>" +
          rp(calc(i).total) +
          '</td><td><span class="tag' +
          (i.status === "Lunas" ? " f" : "") +
          '">' +
          esc(i.status) +
          '</span></td><td><button class="btn s" data-a="v" data-id="' +
          i.id +
          '">Lihat</button> <button class="btn s" data-a="p" data-id="' +
          i.id +
          '">Lunas</button> <button class="btn s" data-a="c" data-id="' +
          i.id +
          '">Duplikat</button> <button class="btn s" data-a="w" data-id="' +
          i.id +
          '">WA Tagih</button> <button class="btn s" data-a="e" data-id="' +
          i.id +
          '">Edit</button> <button class="btn s" data-a="d" data-id="' +
          i.id +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="6" class="mut">Belum ada invoice.</td></tr>') +
    "</table></div>";
  $("#ni").onclick = function () {
    invForm();
  };
  m.querySelector("table").onclick = function (e) {
    var a = e.target.getAttribute("data-a"),
      id = e.target.getAttribute("data-id");
    if (!a) return;
    var i = db.inv.filter(function (x) {
      return x.id === id;
    })[0];
    if (a === "v") invView(i);
    if (a === "p") {
      i.status = "Lunas";
      save();
      go("inv");
    }
    if (a === "w") {
      var dl = db.deals.filter(function (x) {
        return x.client === i.client && x.wa;
      })[0];
      if (!dl) {
        alert("Nomor WA klien belum ada di data deal.");
        return;
      }
      var wn = dl.wa.replace(/\D/g, "").replace(/^0/, "62");
      window.open(
        "https://wa.me/" +
          wn +
          "?text=" +
          encodeURIComponent(
            "Halo " +
              i.client +
              ", mengingatkan invoice " +
              i.no +
              " sebesar " +
              rp(calc(i).due) +
              " jatuh tempo " +
              i.due +
              ". Terima kasih.",
          ),
        "_blank",
        "noopener",
      );
    }
    if (a === "c") {
      var cp = JSON.parse(JSON.stringify(i));
      db.seq++;
      cp.id = uid();
      cp.no =
        "INV/" +
        new Date().getFullYear() +
        "/" +
        String(db.seq).padStart(4, "0");
      cp.status = "Draft";
      cp.date = today();
      db.inv.push(cp);
      save();
      go("inv");
    }
    if (a === "e") invForm(i);
    if (a === "d" && confirm("Hapus invoice?")) {
      db.inv = db.inv.filter(function (x) {
        return x.id !== id;
      });
      save();
      go("inv");
    }
  };
}
function invForm(i) {
  var d = i || {
    client: "",
    email: "",
    address: "",
    date: today(),
    due: today(),
    items: [{ desc: "", qty: 1, price: 0 }],
    discount: 0,
    tax: 11,
    dp: 0,
    status: "Draft",
    note: "Pembayaran via transfer. Mohon sertakan nomor invoice.",
    bank: "BCA 1234567890 a.n. KerjaKolektif",
  };
  function rows() {
    return d.items
      .map(function (it, n) {
        return (
          '<div class="item"><input data-i="' +
          n +
          '" data-f="desc" placeholder="Deskripsi layanan" value="' +
          esc(it.desc) +
          '"><input data-i="' +
          n +
          '" data-f="qty" type="number" min="0" value="' +
          esc(it.qty) +
          '"><input data-i="' +
          n +
          '" data-f="price" type="number" min="0" value="' +
          esc(it.price) +
          '"><button class="btn s" data-rm="' +
          n +
          '">×</button></div>'
        );
      })
      .join("");
  }
  function sum() {
    var c = calc(d);
    $("#isum").innerHTML =
      "Subtotal " +
      rp(c.sub) +
      " · Pajak " +
      rp(c.tax) +
      " · <b>Total " +
      rp(c.total) +
      "</b> · Sisa " +
      rp(c.due);
  }
  modal(
    "<h2>" +
      (i ? "Edit" : "Invoice baru") +
      '</h2><div class="two">' +
      '<div><label>Klien</label><input id="ic" list="cl" value="' +
      esc(d.client) +
      '"><datalist id="cl">' +
      db.deals
        .map(function (x) {
          return "<option>" + esc(x.client) + "</option>";
        })
        .join("") +
      "</datalist></div>" +
      '<div><label>Email klien</label><input id="ie" value="' +
      esc(d.email) +
      '"></div>' +
      '<div style="grid-column:1/-1"><label>Alamat</label><input id="ia" value="' +
      esc(d.address) +
      '"></div>' +
      '<div><label>Tanggal</label><input id="id" type="date" value="' +
      esc(d.date) +
      '"></div><div><label>Jatuh tempo</label><input id="iu" type="date" value="' +
      esc(d.due) +
      '"></div></div>' +
      '<label>Item (deskripsi · qty · harga)</label><div id="rows">' +
      rows() +
      '</div><button class="btn s" id="add">+ Item</button>' +
      '<div class="two"><div><label>Diskon (Rp)</label><input id="idc" type="number" min="0" value="' +
      esc(d.discount) +
      '"></div><div><label>PPN (%)</label><input id="it" type="number" min="0" max="100" value="' +
      esc(d.tax) +
      '"></div>' +
      '<div><label>DP dibayar (Rp)</label><input id="idp" type="number" min="0" value="' +
      esc(d.dp) +
      '"></div><div><label>Status</label><select id="is">' +
      opts(["Draft", "Terkirim", "Lunas", "Jatuh Tempo"], d.status) +
      "</select></div></div>" +
      '<label>Rekening</label><input id="ib" value="' +
      esc(d.bank) +
      '"><label>Catatan</label><textarea id="in" rows="2">' +
      esc(d.note) +
      "</textarea>" +
      '<p id="isum" class="mut" style="margin-top:12px"></p><div class="err" id="ferr"></div><div class="acts"><button class="btn p" id="fs">Simpan</button><button class="btn" id="fc">Batal</button></div>',
    true,
  );
  sum();
  var sheet = $("#mod");
  sheet.oninput = function (e) {
    var n = e.target.getAttribute("data-i"),
      f = e.target.getAttribute("data-f");
    if (n != null) d.items[n][f] = e.target.value;
    d.discount = $("#idc").value;
    d.tax = $("#it").value;
    d.dp = $("#idp").value;
    sum();
  };
  sheet.onclick = function (e) {
    var rm = e.target.getAttribute("data-rm");
    if (rm != null && d.items.length > 1) {
      d.items.splice(rm, 1);
      $("#rows").innerHTML = rows();
      sum();
    }
    if (e.target.id === "add") {
      d.items.push({ desc: "", qty: 1, price: 0 });
      $("#rows").innerHTML = rows();
    }
  };
  $("#fc").onclick = close;
  $("#fs").onclick = function () {
    if (!$("#ic").value.trim()) {
      $("#ferr").textContent = "Klien wajib diisi.";
      return;
    }
    if (
      !d.items.some(function (x) {
        return x.desc.trim() && num(x.qty) > 0;
      })
    ) {
      $("#ferr").textContent = "Minimal satu item valid.";
      return;
    }
    if ($("#iu").value < $("#id").value) {
      $("#ferr").textContent =
        "Jatuh tempo tidak boleh sebelum tanggal invoice.";
      return;
    }
    var o = {
      client: $("#ic").value.trim(),
      email: $("#ie").value.trim(),
      address: $("#ia").value.trim(),
      date: $("#id").value,
      due: $("#iu").value,
      items: d.items.filter(function (x) {
        return x.desc.trim();
      }),
      discount: num($("#idc").value),
      tax: Math.min(100, num($("#it").value)),
      dp: num($("#idp").value),
      status: $("#is").value,
      bank: $("#ib").value.trim(),
      note: $("#in").value.trim(),
    };
    if (i) Object.assign(i, o);
    else {
      db.seq++;
      o.id = uid();
      o.no =
        "INV/" +
        new Date().getFullYear() +
        "/" +
        String(db.seq).padStart(4, "0");
      db.inv.push(o);
    }
    save();
    close();
    go("inv");
  };
}
function invView(i) {
  var c = calc(i);
  modal(
    '<div class="paper"><div class="hd"><div><div class="big">INVOICE</div><div>' +
      esc(i.no) +
      '</div></div><div style="text-align:right"><b>KERJAKOLEKTIF</b><br>Buzzing · Joki · Ads · KOL<br>hello@kerjakolektif.id</div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:18px"><div><b>Ditagihkan kepada</b><br>' +
      esc(i.client) +
      "<br>" +
      esc(i.email) +
      "<br>" +
      esc(i.address) +
      '</div><div style="text-align:right">Tanggal: ' +
      esc(i.date) +
      "<br>Jatuh tempo: " +
      esc(i.due) +
      '<br><span class="st">' +
      esc(i.status.toUpperCase()) +
      "</span></div></div>" +
      "<table><tr><th>Deskripsi</th><th>Qty</th><th>Harga</th><th style='text-align:right'>Jumlah</th></tr>" +
      i.items
        .map(function (x) {
          return (
            "<tr><td>" +
            esc(x.desc) +
            "</td><td>" +
            esc(x.qty) +
            "</td><td>" +
            rp(x.price) +
            "</td><td style='text-align:right'>" +
            rp(num(x.qty) * num(x.price)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</table>" +
      '<div class="tot"><div><span>Subtotal</span><span>' +
      rp(c.sub) +
      "</span></div><div><span>Diskon</span><span>- " +
      rp(c.disc) +
      "</span></div><div><span>PPN " +
      esc(i.tax) +
      "%</span><span>" +
      rp(c.tax) +
      "</span></div><div><span>DP</span><span>- " +
      rp(i.dp) +
      '</span></div><div class="gt"><span>SISA TAGIHAN</span><span>' +
      rp(c.due) +
      "</span></div></div>" +
      '<div class="ft"><div><b>Pembayaran</b><br>' +
      esc(i.bank) +
      "</div><div><b>Catatan</b><br>" +
      esc(i.note) +
      "</div></div></div>" +
      '<div class="acts" style="margin-top:14px"><button class="btn p" id="pr">Cetak / PDF</button><button class="btn" id="fc">Tutup</button></div>',
    true,
  );
  $("#fc").onclick = close;
  $("#pr").onclick = function () {
    window.print();
  };
}
