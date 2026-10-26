(function () {
  "use strict";

  var csrf = "";
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF": csrf },
      body: body ? JSON.stringify(body) : undefined,
    })
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
            return j;
          });
      })
      .catch(function (e) {
        if (e instanceof TypeError) {
          throw new Error("Server tidak bisa dihubungi. Periksa koneksi lalu coba lagi.");
        }
        throw e;
      });
  }

  function authenticate(token) {
    csrf = token;
    document.dispatchEvent(
      new CustomEvent("kk:authenticated", { detail: { csrf: token } }),
    );
  }

  function login() {
    var button = document.querySelector("#lbtn");
    var error = document.querySelector("#lerr");
    var username = document.querySelector("#u").value.trim();
    var password = document.querySelector("#p").value;
    error.textContent = "";
    if (!username || !password) {
      error.textContent = "Username dan password wajib diisi.";
      return;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    api("POST", "/api/login", { u: username, p: password })
      .then(function (result) {
        document.querySelector("#p").value = "";
        authenticate(result.csrf);
      })
      .catch(function (e) {
        error.textContent = e.message;
      })
      .then(function () {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      });
  }

  document.querySelector("#lbtn").addEventListener("click", login);
  document.querySelector("#p").addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
  });
  document.querySelector("#out").addEventListener("click", function () {
    api("POST", "/api/logout")
      .catch(function () {})
      .then(function () {
        location.reload();
      });
  });

  window.KKAuth = { api: api };
  api("GET", "/api/me")
    .then(function (result) {
      authenticate(result.csrf);
    })
    .catch(function () {});
})();
