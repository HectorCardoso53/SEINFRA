// ============================================================
// script.js — Orquestrador principal (coração do sistema)
// Importa todos os módulos, registra listeners e inicia o app
// ============================================================

import { auth } from "../firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { loadVisits, loadPersons, deleteVisit } from "./db.js";
import { visits, setCurrentPage } from "./state.js";

import {
  showToast, toggleSidebar, closeSidebar, atualizarHeader,
  initDiretoriaSetor, initPhoneMask, initCpfMask,
  forceUppercaseInputs, updateSidebarCounter, openConfirmModal, closeConfirm,
} from "./ui.js";

import {
  handleFormSubmit, cancelEdit, clearForm,
  editVisit, handleSavePerson, initPersonAutocomplete,
} from "./form.js";

import { renderTable, renderTodayVisits, renderHistory, initFilters, changePage } from "./tabela.js";
import { renderDashboard } from "./dashboard.js";

/* =========================
   NAVEGAÇÃO
========================= */
function navigate(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  document.getElementById(`page-${page}`)?.classList.add("active");
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((n) => n.classList.add("active"));
  atualizarHeader(page);
  if (page === "lista") renderTable();
  if (page === "dashboard") renderDashboard();
}

/* =========================
   LOGOUT
========================= */
window.logout = async function () {
  await signOut(auth);
  window.location.replace("/index.html");
};

/* =========================
   DELEGAÇÃO DE EVENTOS — tabela (substitui onclick inline)
========================= */
function initTabelaDelegation() {
  document.getElementById("visits-tbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "edit") {
      editVisit(id, visits);
      navigate("cadastro");
    }

    if (action === "delete") {
      const v = visits.find((v) => v.id === id);
      if (!v) return;
      openConfirmModal(v.name, async () => {
        try {
          await deleteVisit(id);
          closeConfirm();
          await loadVisits();
          renderTable();
          renderDashboard();
          updateSidebarCounter(visits.length);
          showToast("Visita excluída.", "success");
        } catch (err) {
          console.error(err);
          showToast("Erro ao excluir visita.", "error");
        }
      });
    }
  });

  // paginação via delegação
  document.getElementById("page-btns")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn || btn.disabled) return;
    changePage(Number(btn.dataset.page));
  });
}

/* =========================
   DOMCONTENTLOADED
========================= */
document.addEventListener("DOMContentLoaded", async () => {

  // ── Carregar dados
  await loadVisits();
  await loadPersons();

  // ── UI inicial
  initDiretoriaSetor();
  forceUppercaseInputs();
  initPhoneMask();
  initCpfMask();
  initPersonAutocomplete();
  initFilters();
  initTabelaDelegation();

  // ── Formulário de visita
  document.getElementById("visit-form")
    ?.addEventListener("submit", handleFormSubmit);
  document.getElementById("btn-cancel-edit")
    ?.addEventListener("click", cancelEdit);
  document.getElementById("btn-clear")
    ?.addEventListener("click", clearForm);

  // ── Formulário de pessoa
  document.getElementById("person-form")
    ?.addEventListener("submit", handleSavePerson);

  // ── Data automática
  const dateInput = document.getElementById("f-date");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

  // ── Histórico
  document.getElementById("btn-search-history")?.addEventListener("click", () => {
    const name = document.getElementById("history-search").value;
    renderHistory(name);
  });

  // ── Navegação pelo menu
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  // ── Badge de data
  const todayBadge = document.getElementById("today-badge");
  if (todayBadge) {
    todayBadge.textContent = new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long",
    });
  }

  // ── Sidebar
  document.getElementById("hamburger")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebar-overlay")?.addEventListener("click", closeSidebar);

  // ── Modal de exclusão
  document.getElementById("btn-cancel-delete")?.addEventListener("click", closeConfirm);

  // ── Fechar autocomplete clicando fora
  document.addEventListener("click", (e) => {
    const box = document.querySelector(".autocomplete-box");
    const list = document.getElementById("person-suggestions");
    if (box && !box.contains(e.target)) list.innerHTML = "";
  });

  // ── Sidebar toggle (window — chamado pelo topbar)
  window.toggleSidebar = toggleSidebar;

  // ── Renderizações iniciais
  navigate("dashboard");
  renderTable();
  renderTodayVisits();
  updateSidebarCounter(visits.length);
});
