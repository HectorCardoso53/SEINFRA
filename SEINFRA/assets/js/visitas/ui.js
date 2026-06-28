// ============================================================
// ui.js — Toast, modais, sidebar, header, máscaras de input
// ============================================================

import { setoresPorDiretoria } from "./utils.js";

/* =========================
   TOAST
========================= */
export function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon =
    type === "success"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  toast.innerHTML = `${icon} ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* =========================
   MODAL DE CONFIRMAÇÃO
========================= */
export function openConfirmModal(name, onConfirm) {
  document.getElementById("confirm-name").textContent = name;
  document.getElementById("confirm-overlay").classList.add("open");
  document.getElementById("btn-confirm-delete").onclick = () => {
    onConfirm();
  };
}

export function closeConfirm() {
  document.getElementById("confirm-overlay").classList.remove("open");
}

/* =========================
   SIDEBAR
========================= */
export function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const main = document.querySelector(".main");
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  } else {
    sidebar.classList.toggle("collapsed");
    main.classList.toggle("expanded");
  }
}

export function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
}

/* =========================
   HEADER
========================= */
export function atualizarHeader(pageId) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  const map = {
    dashboard: { title: "Dashboard",          subtitle: "Resumo e análise das visitas registradas" },
    cadastro:  { title: "Cadastrar Visita",    subtitle: "Registro de novos atendimentos" },
    lista:     { title: "Lista de Visitas",    subtitle: "Consulta de visitas registradas" },
  };
  if (map[pageId] && title && subtitle) {
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }
}

/* =========================
   DIRETORIA / SETOR
========================= */
export function initDiretoriaSetor() {
  const diretoriaSelect = document.getElementById("f-diretoria");
  const setorSelect = document.getElementById("f-sector");
  if (!diretoriaSelect || !setorSelect) return;

  Object.keys(setoresPorDiretoria).forEach((diretoria) => {
    const option = document.createElement("option");
    option.value = diretoria;
    option.textContent = diretoria;
    diretoriaSelect.appendChild(option);
  });

  diretoriaSelect.addEventListener("change", () => {
    const setores = setoresPorDiretoria[diretoriaSelect.value] || [];
    setorSelect.innerHTML = `<option value="">Selecione o setor</option>`;
    setores.forEach((setor) => {
      const option = document.createElement("option");
      option.value = setor;
      option.textContent = setor;
      setorSelect.appendChild(option);
    });
  });
}

/* =========================
   MÁSCARAS
========================= */
export function initPhoneMask() {
  const inputs = [
    document.getElementById("f-phone"),
    document.getElementById("f-phone2"),
    document.getElementById("p-phone"),
  ];
  inputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6)      this.value = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      else if (v.length > 2) this.value = `(${v.slice(0,2)}) ${v.slice(2)}`;
      else if (v.length > 0) this.value = `(${v}`;
      else                   this.value = "";
    });
  });
}

export function initCpfMask() {
  const cpf = document.getElementById("f-cpf");
  if (!cpf) return;
  cpf.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 9)      this.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9)}`;
    else if (v.length > 6) this.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6)}`;
    else if (v.length > 3) this.value = `${v.slice(0,3)}.${v.slice(3)}`;
    else                   this.value = v;
  });
}

export function forceUppercaseInputs() {
  ["f-name", "f-address", "f-reference", "f-reason", "p-name"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", function () {
      this.value = this.value.toUpperCase();
    });
  });
}

/* =========================
   SIDEBAR COUNTER
========================= */
export function updateSidebarCounter(count) {
  const el = document.getElementById("visit-count");
  if (el) el.textContent = count;
}
