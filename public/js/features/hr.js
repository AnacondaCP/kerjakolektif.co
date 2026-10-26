var HR_ATTENDANCE = ["Hadir", "Terlambat", "Izin", "Sakit", "Cuti", "Alpha"];
var hrPeriod = hrCurrentMonth();

function hrCurrentMonth() {
  var d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0")].join("-");
}

function hrInit() {
  db.team = Array.isArray(db.team) ? db.team : [];
  db.attendance = Array.isArray(db.attendance) ? db.attendance : [];
  db.payroll = Array.isArray(db.payroll) ? db.payroll : [];

  if (db.team.length || !db.mods || !Array.isArray(db.mods.emp)) return;
  var migrated = 0;
  db.mods.emp.forEach(function (legacy) {
    db.team.push({
      id: legacy.id || uid(),
      name: legacy.name || "",
      role: legacy.role || "",
      type: legacy.type === "Freelancer" ? "Freelancer" : "Karyawan",
      monthlySalary: legacy.type === "Freelancer" ? 0 : num(legacy.salary),
      dailyRate: legacy.type === "Freelancer" ? num(legacy.salary) : 0,
      status: legacy.status === "Nonaktif" ? "Nonaktif" : "Aktif",
    });
    migrated++;
  });
  if (migrated) save();
}

function hrToday() {
  var d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function hrMonthName(month) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
}

function hrStaffName(id) {
  var person = db.team.find(function (employee) {
    return employee.id === id;
  });
  return person ? person.name : "Pegawai dihapus";
}

function hrAttendanceSummary(month, employeeId) {
  var entries = db.attendance.filter(function (entry) {
    return (
      entry.date.slice(0, 7) === month &&
      (!employeeId || entry.employeeId === employeeId)
    );
  });
  return {
    present: entries.filter(function (entry) {
      return entry.status === "Hadir" || entry.status === "Terlambat";
    }).length,
    absent: entries.filter(function (entry) {
      return entry.status === "Alpha";
    }).length,
    overtime: entries.reduce(function (total, entry) {
      return total + num(entry.overtimeHours);
    }, 0),
  };
}

function hrCalculate(employee, month) {
  var attendance = hrAttendanceSummary(month, employee.id);
  var salary = num(employee.monthlySalary);
  var dailyRate = num(employee.dailyRate);
  var monthlyBase = Math.round(
    employee.type === "Freelancer" ? attendance.present * dailyRate : salary,
  );
  var absenceDeduction =
    employee.type === "Freelancer"
      ? 0
      : Math.min(salary, Math.round((salary / 22) * attendance.absent));
  var hourlyRate =
    employee.type === "Freelancer" ? dailyRate / 8 : salary / 173;
  var overtimePay = Math.round(attendance.overtime * hourlyRate * 1.5);
  var net = Math.max(
    0,
    Math.round(monthlyBase - absenceDeduction + overtimePay),
  );

  return {
    presentDays: attendance.present,
    absentDays: attendance.absent,
    overtimeHours: attendance.overtime,
    basePay: monthlyBase,
    absenceDeduction: absenceDeduction,
    overtimePay: overtimePay,
    netPay: net,
  };
}

function hr(m) {
  hrInit();
  var active = db.team.filter(function (employee) {
    return employee.status === "Aktif";
  });

  m.innerHTML =
    head(
      "Absensi & Payroll",
      "Kelola data tim, absensi harian, dan rekap gaji bulanan.",
      '<button class="btn" id="hrExport">Export Payroll</button><button class="btn p" id="hrGenerate">Buat Payroll</button>',
    ) +
    '<div class="toolbar"><label for="hrPeriod">Periode payroll</label><input id="hrPeriod" type="month" value="' +
    esc(hrPeriod) +
    '"></div>' +
    '<div id="hrContent"></div>';

  $("#hrPeriod").onchange = function () {
    if (this.value) hrPeriod = this.value;
    hrRender();
  };
  $("#hrGenerate").onclick = hrGeneratePayroll;
  $("#hrExport").onclick = hrExportPayroll;
  hrRender();
}

function hrRender() {
  var content = $("#hrContent");
  if (!content) return;

  var month = hrPeriod;
  var employees = db.team.slice().sort(function (a, b) {
    return a.name.localeCompare(b.name, "id");
  });
  var active = employees.filter(function (employee) {
    return employee.status === "Aktif";
  });
  var entries = db.attendance
    .filter(function (entry) {
      return entry.date.slice(0, 7) === month;
    })
    .sort(function (a, b) {
      return (
        b.date.localeCompare(a.date) ||
        hrStaffName(a.employeeId).localeCompare(hrStaffName(b.employeeId), "id")
      );
    });
  var payroll = db.payroll.filter(function (row) {
    return row.month === month;
  });
  var paidTotal = payroll.reduce(function (total, row) {
    return total + num(row.netPay);
  }, 0);
  var summary = hrAttendanceSummary(month);

  content.innerHTML =
    '<div class="grid">' +
    [
      ["Pegawai aktif", active.length],
      ["Hari hadir", summary.present],
      ["Hari alpha", summary.absent],
      ["Total payroll", rp(paidTotal)],
    ]
      .map(function (item) {
        return (
          '<div class="card"><div class="k">' +
          item[0] +
          '</div><div class="v">' +
          item[1] +
          "</div></div>"
        );
      })
      .join("") +
    "</div>" +
    '<div class="card" style="margin-bottom:16px"><div class="top"><div><h2>Data tim</h2><div class="mut">Gaji karyawan dihitung bulanan; freelancer dibayar berdasarkan hari hadir.</div></div><button class="btn p" id="hrAddEmployee">+ Pegawai</button></div>' +
    '<div class="scroll"><table><tr><th>Nama</th><th>Posisi</th><th>Tipe</th><th>Tarif</th><th>Status</th><th></th></tr>' +
    (employees
      .map(function (employee) {
        var rate =
          employee.type === "Freelancer"
            ? rp(employee.dailyRate) + " / hari"
            : rp(employee.monthlySalary) + " / bulan";
        return (
          "<tr><td><b>" +
          esc(employee.name) +
          "</b></td><td>" +
          esc(employee.role || "-") +
          "</td><td>" +
          esc(employee.type) +
          "</td><td>" +
          rate +
          '</td><td><span class="tag' +
          (employee.status === "Aktif" ? " f" : "") +
          '">' +
          esc(employee.status) +
          '</span></td><td><button class="btn s" data-hr-edit="' +
          esc(employee.id) +
          '">Edit</button> <button class="btn s" data-hr-toggle="' +
          esc(employee.id) +
          '">' +
          (employee.status === "Aktif" ? "Nonaktifkan" : "Aktifkan") +
          "</button></td></tr>"
        );
      })
      .join("") ||
      '<tr><td colspan="6" class="mut">Belum ada data pegawai. Tambahkan tim untuk mulai mencatat absensi.</td></tr>') +
    "</table></div></div>" +
    '<div class="card" style="margin-bottom:16px"><div class="top"><div><h2>Absensi ' +
    esc(hrMonthName(month)) +
    '</h2><div class="mut">Catat maksimal satu status absensi per pegawai per tanggal.</div></div><button class="btn p" id="hrAddAttendance"' +
    (active.length ? "" : " disabled") +
    '>+ Catat Absensi</button></div><div class="scroll"><table><tr><th>Tanggal</th><th>Pegawai</th><th>Status</th><th>Lembur</th><th>Catatan</th><th></th></tr>' +
    (entries
      .map(function (entry) {
        return (
          "<tr><td>" +
          esc(entry.date) +
          "</td><td>" +
          esc(hrStaffName(entry.employeeId)) +
          '</td><td><span class="tag">' +
          esc(entry.status) +
          "</span></td><td>" +
          num(entry.overtimeHours) +
          " jam</td><td>" +
          esc(entry.note || "-") +
          (entry.proofId
            ? ' <a class="attendance-proof-link" href="/api/attendance-proof/' +
              encodeURIComponent(entry.proofId) +
              '" target="_blank" rel="noopener">Lihat foto</a>'
            : "") +
          '</td><td><button class="btn s" data-hr-attendance-edit="' +
          esc(entry.id) +
          '">Edit</button> <button class="btn s" data-hr-attendance-delete="' +
          esc(entry.id) +
          '">Hapus</button></td></tr>'
        );
      })
      .join("") ||
      '<tr><td colspan="6" class="mut">Belum ada absensi pada periode ini.</td></tr>') +
    "</table></div></div>" +
    '<div class="card"><div class="top"><div><h2>Payroll ' +
    esc(hrMonthName(month)) +
    '</h2><div class="mut">Draft mengambil snapshot gaji dan absensi saat dibuat. Tandai dibayar setelah transfer selesai.</div></div></div><div class="scroll"><table><tr><th>Pegawai</th><th>Hadir</th><th>Alpha</th><th>Gaji pokok</th><th>Potongan</th><th>Lembur</th><th>Take home pay</th><th>Status</th><th></th></tr>' +
    (payroll
      .map(function (row) {
        return (
          "<tr><td><b>" +
          esc(row.employeeName) +
          "</b></td><td>" +
          num(row.presentDays) +
          " hari</td><td>" +
          num(row.absentDays) +
          " hari</td><td>" +
          rp(row.basePay) +
          "</td><td>" +
          rp(row.absenceDeduction) +
          "</td><td>" +
          rp(row.overtimePay) +
          "</td><td><b>" +
          rp(row.netPay) +
          '</b></td><td><span class="tag' +
          (row.status === "Dibayar" ? " f" : "") +
          '">' +
          esc(row.status) +
          "</span></td><td>" +
          (row.status === "Draft"
            ? '<button class="btn s" data-hr-paid="' +
              esc(row.id) +
              '">Tandai dibayar</button> <button class="btn s" data-hr-payroll-delete="' +
              esc(row.id) +
              '">Hapus</button>'
            : esc(row.paidAt || "")) +
          "</td></tr>"
        );
      })
      .join("") ||
      '<tr><td colspan="9" class="mut">Payroll belum dibuat untuk periode ini.</td></tr>') +
    "</table></div></div>";

  $("#hrAddEmployee").onclick = function () {
    hrEmployeeForm();
  };
  $("#hrAddAttendance").onclick = function () {
    hrAttendanceForm();
  };
  content.onclick = function (event) {
    var target = event.target;
    var employeeId = target.getAttribute("data-hr-edit");
    var toggleId = target.getAttribute("data-hr-toggle");
    var attendanceId = target.getAttribute("data-hr-attendance-edit");
    var attendanceDeleteId = target.getAttribute("data-hr-attendance-delete");
    var paidId = target.getAttribute("data-hr-paid");
    var payrollDeleteId = target.getAttribute("data-hr-payroll-delete");

    if (employeeId) {
      hrEmployeeForm(
        db.team.find(function (employee) {
          return employee.id === employeeId;
        }),
      );
    } else if (toggleId) {
      var employee = db.team.find(function (person) {
        return person.id === toggleId;
      });
      if (employee) {
        employee.status = employee.status === "Aktif" ? "Nonaktif" : "Aktif";
        save();
        hrRender();
      }
    } else if (attendanceId) {
      hrAttendanceForm(
        db.attendance.find(function (entry) {
          return entry.id === attendanceId;
        }),
      );
    } else if (attendanceDeleteId) {
      if (confirm("Hapus catatan absensi ini?")) {
        var deletedEntry = db.attendance.find(function (entry) {
          return entry.id === attendanceDeleteId;
        });
        db.attendance = db.attendance.filter(function (entry) {
          return entry.id !== attendanceDeleteId;
        });
        saveNow()
          .then(function () {
            hrRender();
            if (deletedEntry && deletedEntry.proofId)
              return hrDeleteProof(deletedEntry.proofId).catch(
                function (error) {
                  alert(
                    "Absensi sudah dihapus, tetapi foto bukti gagal dihapus: " +
                      error.message,
                  );
                },
              );
          })
          .catch(function (error) {
            if (deletedEntry) db.attendance.push(deletedEntry);
            hrRender();
            alert("Gagal menghapus absensi: " + error.message);
          });
      }
    } else if (paidId) {
      var row = db.payroll.find(function (item) {
        return item.id === paidId;
      });
      if (
        row &&
        confirm("Tandai payroll " + row.employeeName + " sudah dibayar?")
      ) {
        row.status = "Dibayar";
        row.paidAt = hrToday();
        db.exp.push({
          id: uid(),
          date: row.paidAt,
          cat: "Gaji",
          desc: "Payroll " + row.employeeName + " - " + row.month,
          amount: row.netPay,
          payrollId: row.id,
        });
        save();
        hrRender();
      }
    } else if (payrollDeleteId) {
      var draft = db.payroll.find(function (item) {
        return item.id === payrollDeleteId;
      });
      if (
        draft &&
        draft.status === "Draft" &&
        confirm(
          "Hapus draft payroll ini? Payroll yang sudah dibayar tidak bisa dihapus.",
        )
      ) {
        db.payroll = db.payroll.filter(function (item) {
          return item.id !== payrollDeleteId;
        });
        save();
        hrRender();
      }
    }
  };
}

function hrEmployeeForm(employee) {
  form(
    employee ? "Edit pegawai" : "Tambah pegawai",
    [
      { k: "name", l: "Nama lengkap", req: 1 },
      { k: "role", l: "Posisi / jabatan" },
      { k: "type", l: "Tipe pegawai", o: ["Karyawan", "Freelancer"] },
      { k: "monthlySalary", l: "Gaji bulanan (Rp)", t: "number", d: 0 },
      { k: "dailyRate", l: "Tarif per hari (Rp)", t: "number", d: 0 },
      { k: "status", l: "Status", o: ["Aktif", "Nonaktif"] },
    ],
    employee || {
      type: "Karyawan",
      monthlySalary: 0,
      dailyRate: 0,
      status: "Aktif",
    },
    function (value) {
      value.monthlySalary = num(value.monthlySalary);
      value.dailyRate = num(value.dailyRate);
      if (value.type === "Karyawan") value.dailyRate = 0;
      else value.monthlySalary = 0;

      if (employee) Object.assign(employee, value);
      else {
        value.id = uid();
        db.team.push(value);
      }
      save();
      hrRender();
    },
  );
}

function hrAttendanceForm(entry, selectedEmployeeId) {
  var employees = db.team.filter(function (employee) {
    return (
      employee.status === "Aktif" || (entry && employee.id === entry.employeeId)
    );
  });
  if (!employees.length) {
    alert("Tambahkan pegawai aktif terlebih dahulu.");
    return;
  }

  var fields = [
    {
      k: "employeeId",
      l: "Pegawai",
      o: employees.map(function (employee) {
        return employee.id + " — " + employee.name;
      }),
      req: 1,
    },
    { k: "date", l: "Tanggal", t: "date", d: hrToday(), req: 1 },
    { k: "status", l: "Status", o: HR_ATTENDANCE },
    { k: "time", l: "Waktu masuk", t: "time", req: 1 },
    { k: "overtimeHours", l: "Jam lembur", t: "number", d: 0 },
    { k: "note", l: "Catatan", full: 1 },
  ];
  var currentTime = new Date();
  var defaultTime =
    String(currentTime.getHours()).padStart(2, "0") +
    ":" +
    String(currentTime.getMinutes()).padStart(2, "0");
  var initial = entry
    ? Object.assign({}, entry, {
        employeeId: entry.employeeId + " — " + hrStaffName(entry.employeeId),
      })
    : {
        employeeId: selectedEmployeeId
          ? selectedEmployeeId + " — " + hrStaffName(selectedEmployeeId)
          : undefined,
        date: hrToday(),
        status: "Hadir",
        time: defaultTime,
        overtimeHours: 0,
      };

  form(
    entry ? "Edit absensi" : "Catat absensi",
    fields,
    initial,
    function (value) {
      var selected = employees.find(function (employee) {
        return value.employeeId.indexOf(employee.id + " — ") === 0;
      });
      if (!selected) {
        alert("Pegawai yang dipilih tidak valid.");
        return;
      }
      if (value.date > hrToday()) {
        alert("Tanggal absensi tidak boleh di masa depan.");
        return;
      }
      value.employeeId = selected.id;
      value.overtimeHours = Math.min(24, num(value.overtimeHours));

      var duplicate = db.attendance.find(function (saved) {
        return (
          saved.id !== (entry && entry.id) &&
          saved.employeeId === value.employeeId &&
          saved.date === value.date
        );
      });
      if (duplicate) {
        alert(
          "Absensi pegawai ini pada tanggal tersebut sudah tercatat. Edit catatan yang ada.",
        );
        return;
      }

      if (entry) Object.assign(entry, value);
      else {
        value.id = uid();
        db.attendance.push(value);
      }
      hrPeriod = value.date.slice(0, 7);
      $("#hrPeriod").value = hrPeriod;
      save();
      close();
      hrRender();
    },
  );
  var proofImage = "";
  var oldProofId = entry && entry.proofId;
  var uploadedProofId = "";
  var preview = oldProofId
    ? '<a href="/api/attendance-proof/' +
      encodeURIComponent(oldProofId) +
      '" target="_blank" rel="noopener"><img class="attendance-preview" src="/api/attendance-proof/' +
      encodeURIComponent(oldProofId) +
      '" alt="Foto bukti absensi saat ini"></a>'
    : "";
  $("#mod .two").insertAdjacentHTML(
    "afterend",
    '<div class="hr-proof-field"><label for="hrProof">Foto bukti absensi *</label><input id="hrProof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><div class="mut">Ambil foto langsung atau pilih dari galeri. Foto dikompres dan disimpan privat (maks. 500 KB).</div><div id="hrProofPreview">' +
      preview +
      '</div><div class="err" id="hrProofError"></div></div>',
  );
  $("#hrProof").onchange = function () {
    var file = this.files && this.files[0];
    proofImage = "";
    if (!file) {
      $("#hrProofError").textContent = "";
      $("#hrProofPreview").innerHTML = preview;
      return;
    }
    hrPrepareProof(file)
      .then(function (dataUrl) {
        proofImage = dataUrl;
        $("#hrProofPreview").innerHTML =
          '<img class="attendance-preview" src="' +
          dataUrl +
          '" alt="Pratinjau foto bukti absensi">';
        $("#hrProofError").textContent = "";
      })
      .catch(function (error) {
        $("#hrProofError").textContent = error.message;
        $("#hrProofPreview").innerHTML = preview;
      });
  };
  $("#fs").onclick = function () {
    var button = this;
    var error = $("#hrProofError");
    var fields = {};
    document.querySelectorAll("#mod [data-k]").forEach(function (field) {
      fields[field.getAttribute("data-k")] = field.value.trim();
    });
    if (!fields.employeeId || !fields.date || !fields.time) {
      error.textContent = "Pegawai, tanggal, dan waktu wajib diisi.";
      return;
    }
    if (fields.date > hrToday()) {
      error.textContent = "Tanggal absensi tidak boleh di masa depan.";
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(fields.time)) {
      error.textContent = "Format waktu masuk tidak valid.";
      return;
    }
    var selected = employees.find(function (employee) {
      return fields.employeeId.indexOf(employee.id + " — ") === 0;
    });
    if (!selected) {
      error.textContent = "Pegawai yang dipilih tidak valid.";
      return;
    }
    var duplicate = db.attendance.find(function (saved) {
      return (
        saved.id !== (entry && entry.id) &&
        saved.employeeId === selected.id &&
        saved.date === fields.date
      );
    });
    if (duplicate) {
      error.textContent =
        "Absensi pegawai ini pada tanggal tersebut sudah tercatat. Edit catatan yang ada.";
      return;
    }
    if (!proofImage && !oldProofId) {
      error.textContent = "Foto bukti wajib dilampirkan.";
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";
    error.textContent = "";
    var prior = entry && Object.assign({}, entry);
    var upload = proofImage
      ? api("POST", "/api/attendance-proof", { image: proofImage }).then(
          function (result) {
            uploadedProofId = result.id;
            return result.id;
          },
        )
      : Promise.resolve(oldProofId);

    upload
      .then(function (proofId) {
        var value = {
          employeeId: selected.id,
          date: fields.date,
          time: fields.time,
          status: fields.status,
          overtimeHours: Math.min(24, num(fields.overtimeHours)),
          note: fields.note,
          proofId: proofId,
        };
        if (entry) Object.assign(entry, value);
        else {
          value.id = uid();
          db.attendance.push(value);
        }
        return saveNow().then(function () {
          return proofId;
        });
      })
      .then(function (proofId) {
        if (oldProofId && proofId !== oldProofId)
          return hrDeleteProof(oldProofId).catch(function (deleteError) {
            alert(
              "Absensi tersimpan, tetapi foto bukti lama gagal dihapus: " +
                deleteError.message,
            );
          });
      })
      .then(function () {
        hrPeriod = fields.date.slice(0, 7);
        close();
        if (view === "dash") dash($("#main"));
        else hr($("#main"));
      })
      .catch(function (saveError) {
        if (entry && prior) Object.assign(entry, prior);
        else
          db.attendance = db.attendance.filter(function (saved) {
            return (
              saved.employeeId !== selected.id || saved.date !== fields.date
            );
          });
        if (uploadedProofId)
          hrDeleteProof(uploadedProofId).catch(function (cleanupError) {
            alert(
              "Gagal membersihkan foto yang tidak tersimpan: " +
                cleanupError.message,
            );
          });
        button.disabled = false;
        button.textContent = "Simpan";
        error.textContent = "Gagal menyimpan absensi: " + saveError.message;
      });
  };
}

function hrDeleteProof(id) {
  if (!id) return Promise.resolve();
  return api("DELETE", "/api/attendance-proof/" + encodeURIComponent(id));
}

function hrPrepareProof(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    return Promise.reject(
      new Error("Pilih foto berformat JPG, PNG, atau WebP."),
    );
  if (file.size > 12e6)
    return Promise.reject(new Error("Ukuran foto asli maksimal 12 MB."));

  return new Promise(function (resolve, reject) {
    var image = new Image();
    var url = URL.createObjectURL(file);
    image.onload = function () {
      URL.revokeObjectURL(url);
      var canvas = document.createElement("canvas");
      var attempts = [
        [1280, 0.78],
        [1080, 0.7],
        [900, 0.62],
        [720, 0.55],
      ];
      function compress(index) {
        if (index >= attempts.length) {
          reject(new Error("Foto tidak bisa dikompres di bawah 500 KB."));
          return;
        }
        var scale = Math.min(
          1,
          attempts[index][0] / Math.max(image.width, image.height),
        );
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        var context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Browser tidak mendukung pemrosesan foto."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error("Foto gagal diproses."));
              return;
            }
            if (blob.size > 500e3) {
              compress(index + 1);
              return;
            }
            var reader = new FileReader();
            reader.onload = function () {
              resolve(reader.result);
            };
            reader.onerror = function () {
              reject(new Error("Foto gagal dibaca."));
            };
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          attempts[index][1],
        );
      }
      compress(0);
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("File foto tidak bisa dibuka."));
    };
    image.src = url;
  });
}

function hrGeneratePayroll() {
  hrInit();
  if (hrPeriod > hrCurrentMonth()) {
    alert("Payroll belum bisa dibuat untuk periode yang akan datang.");
    return;
  }
  var employees = db.team.filter(function (employee) {
    return employee.status === "Aktif";
  });
  if (!employees.length) {
    alert("Tambahkan pegawai aktif sebelum membuat payroll.");
    return;
  }
  if (
    db.payroll.some(function (row) {
      return row.month === hrPeriod;
    })
  ) {
    alert(
      "Payroll periode ini sudah dibuat. Hapus draft jika perlu membuat ulang.",
    );
    return;
  }
  if (
    !confirm(
      "Buat payroll " +
        hrMonthName(hrPeriod) +
        " untuk " +
        employees.length +
        " pegawai aktif? Hasilnya disimpan sebagai draft.",
    )
  )
    return;

  employees.forEach(function (employee) {
    var values = hrCalculate(employee, hrPeriod);
    db.payroll.push(
      Object.assign(values, {
        id: uid(),
        employeeId: employee.id,
        employeeName: employee.name,
        month: hrPeriod,
        status: "Draft",
        createdAt: hrToday(),
        paidAt: "",
      }),
    );
  });
  save();
  hrRender();
}

function hrExportPayroll() {
  var rows = db.payroll.filter(function (row) {
    return row.month === hrPeriod;
  });
  if (!rows.length) {
    alert("Belum ada payroll untuk periode ini.");
    return;
  }
  sheetFile(
    "Payroll " + hrMonthName(hrPeriod),
    [
      "Pegawai",
      "Hadir",
      "Alpha",
      "Gaji Pokok",
      "Potongan Alpha",
      "Lembur",
      "Take Home Pay",
      "Status",
      "Tanggal Dibayar",
    ],
    rows.map(function (row) {
      return [
        row.employeeName,
        row.presentDays,
        row.absentDays,
        row.basePay,
        row.absenceDeduction,
        row.overtimePay,
        row.netPay,
        row.status,
        row.paidAt,
      ];
    }),
  );
}
