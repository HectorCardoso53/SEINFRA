"use strict";

import { api, setToken, clearToken, setUser, getToken } from "./api.js";

const PAGINA_POR_ROLE = {
  visita: "home.html",
  os:     "dashboard.html",
  admin:  "dashboard.html",
  master: "servicos.html",
};

const PAGINAS_PERMITIDAS = {
  visita: ["home.html"],
  os:     ["dashboard.html"],
  admin:  ["dashboard.html", "admin.html"],
  master: ["servicos.html", "dashboard.html", "admin.html", "home.html"],
};

/* =========================
   LOGIN
========================= */
window.login = async function () {
  const emailInput    = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError    = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const loading       = document.getElementById("login-loading");
  const btn           = document.getElementById("btn-login");

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  emailError.style.display    = "none";
  passwordError.style.display = "none";
  emailInput.classList.remove("input-error");
  passwordInput.classList.remove("input-error");

  let hasError = false;
  if (!email)    { emailError.style.display    = "block"; emailInput.classList.add("input-error");    hasError = true; }
  if (!password) { passwordError.style.display = "block"; passwordInput.classList.add("input-error"); hasError = true; }
  if (hasError) return;

  loading.style.display = "block";
  btn.disabled = true;

  try {
    const res = await api.post("/auth/login", { email, senha: password });
    setToken(res.token);
    setUser(res.user);
    window.location.replace(PAGINA_POR_ROLE[res.user.role] || "index.html");
  } catch (err) {
    loading.style.display = "none";
    btn.disabled = false;
    let msg = "Erro ao fazer login";
    if (err.status === 401) msg = '<i class="bi bi-exclamation-triangle"></i> E-mail ou senha inválidos';
    else if (err.status === 0) msg = '<i class="bi bi-wifi-off"></i> Sem conexão com o servidor';
    passwordError.innerHTML = msg;
    passwordError.style.display = "block";
    passwordInput.classList.add("input-error");
  }
};

/* =========================
   LOGOUT
========================= */
window.logout = function () {
  clearToken();
  window.location.replace("index.html");
};

/* =========================
   PROTEÇÃO DE ROTAS
========================= */
(async function verificarSessao() {
  const pagina = window.location.pathname.split("/").pop() || "index.html";
  const token  = getToken();

  if (!token) {
    if (pagina !== "index.html" && pagina !== "") window.location.replace("index.html");
    return;
  }

  try {
    const user = await api.get("/auth/me");

    const permitidas = PAGINAS_PERMITIDAS[user.role] || [];
    if (pagina !== "index.html" && pagina !== "" && !permitidas.includes(pagina)) {
      window.location.replace(PAGINA_POR_ROLE[user.role] || "index.html");
      return;
    }

    // Dados globais (mesma interface do código anterior)
    window.userRole  = user.role;
    window.userNome  = user.nome;
    window.userSetor = user.setor || "";
    window.userEmail = user.email;
    window._userId   = user.id;

    if (typeof window._onAuthPronto === "function") window._onAuthPronto(user.nome);

    // Elementos master-only
    document.querySelectorAll(".master-only").forEach((el) => (el.style.display = "none"));
    if (user.role === "master") {
      document.querySelectorAll(".master-only").forEach((el) => (el.style.display = "flex"));
    }

    // Verificar aceite de termos
    try {
      const { verificarAceiteTermos } = await import("./firestore.js");
      const jaAceitou = await verificarAceiteTermos();
      if (!jaAceitou) {
        const modal = document.getElementById("modal-termos");
        if (modal) { modal.classList.remove("hidden"); modal.classList.add("show"); }
      }
    } catch {}

  } catch (err) {
    if (err.status !== 401) {
      clearToken();
      if (pagina !== "index.html") window.location.replace("index.html");
    }
  }
})();
