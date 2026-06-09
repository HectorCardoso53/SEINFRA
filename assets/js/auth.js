"use strict";

import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { verificarAceiteTermos } from "./firestore.js";

/* =========================
   LOGIN
========================= */
window.login = async function () {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const loading = document.getElementById("login-loading");
  const btn = document.getElementById("btn-login");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  emailError.style.display = "none";
  passwordError.style.display = "none";
  emailInput.classList.remove("input-error");
  passwordInput.classList.remove("input-error");

  let hasError = false;
  if (!email) {
    emailError.style.display = "block";
    emailInput.classList.add("input-error");
    hasError = true;
  }
  if (!password) {
    passwordError.style.display = "block";
    passwordInput.classList.add("input-error");
    hasError = true;
  }
  if (hasError) return;

  loading.style.display = "block";
  btn.disabled = true;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const ref = doc(db, "users", cred.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("sem-perfil");
    const data = snap.data();
    if (!data.role) throw new Error("sem-role");

    if (data.role === "visita") window.location.replace("home.html");
    else if (data.role === "os") window.location.replace("dashboard.html");
    else if (data.role === "admin") window.location.replace("admin.html");
    else if (data.role === "master") window.location.replace("servicos.html");
    else throw new Error("role-invalido");
  } catch (error) {
    loading.style.display = "none";
    btn.disabled = false;
    let msg = "Erro ao fazer login";
    if (error.code === "auth/invalid-credential")
      msg =
        '<i class="bi bi-exclamation-triangle"></i> E-mail ou senha inválidos';
    else if (error.code === "auth/network-request-failed")
      msg = '<i class="bi bi-wifi-off"></i> Sem conexão com a internet';
    else if (error.message === "sem-perfil")
      msg = "Usuário não possui cadastro no sistema";
    else if (error.message === "sem-role")
      msg = "Usuário sem permissão definida";
    else if (error.message === "role-invalido")
      msg = "Permissão inválida no sistema";
    passwordError.innerHTML = msg;
    passwordError.style.display = "block";
    passwordInput.classList.add("input-error");
  }
};

/* =========================
   LOGOUT
========================= */
window.logout = async function () {
  await signOut(auth);
  window.location.replace("index.html");
};


/* =========================
   PROTEÇÃO DE ROTAS
========================= */

const PAGINA_POR_ROLE = {
  visita: "home.html",
  os: "dashboard.html",
  admin: "dashboard.html",
  master: "servicos.html",
};

const PAGINAS_PERMITIDAS = {
  visita: ["home.html"],
  os:     ["dashboard.html"],
  admin:  ["dashboard.html", "admin.html"],
  master: ["servicos.html", "dashboard.html", "admin.html", "home.html"],
};

onAuthStateChanged(auth, async (user) => {
  const pagina = window.location.pathname.split("/").pop() || "index.html";

  if (!user) {
    if (pagina !== "index.html" && pagina !== "") {
      window.location.replace("index.html");
    }
    return;
  }

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await signOut(auth);
    window.location.replace("index.html");
    return;
  }

  const data = snap.data();
  const role = data.role;

  // Redireciona se a página não pertence ao role
  const permitidas = PAGINAS_PERMITIDAS[role] || [];
  if (pagina !== "index.html" && pagina !== "" && !permitidas.includes(pagina)) {
    window.location.replace(PAGINA_POR_ROLE[role] || "index.html");
    return;
  }

  // Dados globais
  window.userRole = role;
  window.userNome = data.nome;
  window.userSetor = data.setor || "";
  window.userEmail = user.email || "";
  window._userId = user.uid;
  window._userName = user.displayName || user.email || "Usuário";

  if (typeof window._onAuthPronto === "function") {
    window._onAuthPronto(data.nome);
  }

  document.querySelectorAll(".master-only").forEach((el) => {
    el.style.display = "none";
  });

  if (role === "master") {
    document.querySelectorAll(".master-only").forEach((el) => {
      el.style.display = "flex";
    });
  }

  try {
    const jaAceitou = await verificarAceiteTermos(user.uid);
    if (!jaAceitou) {
      const modal = document.getElementById("modal-termos");
      if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("show");
      }
    }
  } catch (e) {
    console.error("Erro ao verificar termos:", e);
  }
});
