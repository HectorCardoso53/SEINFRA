// ============================================================
// app.js — Orquestrador principal
// ============================================================

// 🔒 Inicializa flag global ANTES de qualquer import
window.modoEdicaoAtivo = false;

import "../auth.js";
import "../admin-users.js";

import { reconstruirDashboard, buscarVisitasPorNome, contarOrdensFirestore } from "../firestore.js";
import { inicializarFiltrosDinamicos,limparFiltros } from "../os/filtros.js";
import { mostrarAlerta, fecharAlerta, fecharConfirm, mostrarConfirmacao, showPage, toggleSidebar, toggleMenu } from "./ui.js";
import { inicializarSistema, setDataAtual, carregarSetores,
  adicionarMaterial, removerMaterial,
  visualizarOS, fecharModalDetalhes, alterarStatus,
  mostrarEncerramento, fecharModalEncerramento,
  excluirOS, editarOS,
  adicionarMaterialEncerramento, removerMaterialEncerramento,
  handleFormOSSubmit, handleFormEncerramentoSubmit,
  limparFormulario,
} from "./ordens.js";

import {
  carregarPagina, proximaPagina, paginaAnterior,
  aplicarFiltros, carregarFiltroAno, carregarAnoMateriais,
  carregarSetoresFiltro, gerarRelatorioMateriais,invalidarCache
} from "./filtros.js";

import { inicializarAutoCompleteVisitas, selecionarVisita } from "./visitas.js";

import {
  previsualizarOS, imprimirDetalhesOS, gerarPDFMateriais,
  exportarMateriaisOS, imprimirMateriaisMes, imprimirRelatorio,
} from "./impressao.js";

import { ordens } from "./state.js";

/* =========================
   DOMCONTENTLOADED
========================= */
document.addEventListener("DOMContentLoaded", async function () {
  const filtroDiretoria = document.getElementById("filtro-diretoria");
  if (filtroDiretoria) {
    filtroDiretoria.addEventListener("change", function () {
      carregarSetoresFiltro(this.value);
    });
  }

  const tipoOS = document.getElementById("tipo-os");
  const campoSetor = document.getElementById("campo-setor-solicitante");
  const inputSetor = document.getElementById("setor-solicitante");
  if (tipoOS) {
    tipoOS.addEventListener("change", () => {
      campoSetor.style.visibility = "visible";
      campoSetor.style.height = "auto";
      campoSetor.style.margin = "";
      inputSetor.required = true;
    });
  }

  const selectDiretoria = document.getElementById("setor-responsavel");
  const selectSetor = document.getElementById("setor-solicitante");
  if (selectDiretoria && selectSetor) {
    selectDiretoria.addEventListener("change", () => {
      carregarSetores(selectDiretoria.value);
    });
  }

  const overlay = document.querySelector(".overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  const formOS = document.getElementById("form-os");
  if (formOS) formOS.addEventListener("submit", handleFormOSSubmit);

  const formEncerramento = document.getElementById("form-encerramento");
  if (formEncerramento) formEncerramento.addEventListener("submit", handleFormEncerramentoSubmit);

  const cpfInput = document.getElementById("cpf-solicitante");
  cpfInput?.addEventListener("input", function (e) {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    e.target.value = v;
  });

  const telefoneInput = document.getElementById("telefone-solicitante");
  telefoneInput?.addEventListener("input", function (e) {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    e.target.value = v;
  });

  document.addEventListener("input", function (e) {
    const el = e.target;
    if ((el.tagName === "INPUT" && el.type === "text") || el.tagName === "TEXTAREA") {
      const pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      el.setSelectionRange(pos, pos);
    }
  });

  inicializarAutoCompleteVisitas();
  inicializarSistema();
  carregarAnoMateriais();
  inicializarFiltrosDinamicos(); 
  carregarFiltroAno();
});

/* =========================
   EXPOSIÇÃO GLOBAL (window.*)
========================= */
window.mostrarAlerta = mostrarAlerta;
window.fecharAlerta = fecharAlerta;
window.fecharConfirm = fecharConfirm;
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.toggleMenu = toggleMenu;

window.adicionarMaterial = adicionarMaterial;
window.removerMaterial = removerMaterial;
window.visualizarOS = visualizarOS;
window.fecharModalDetalhes = fecharModalDetalhes;
window.alterarStatus = alterarStatus;
window.mostrarEncerramento = mostrarEncerramento;
window.fecharModalEncerramento = fecharModalEncerramento;

// 🔑 editarOS e excluirOS agora recebem apenas o id
// Buscam do Firestore diretamente — funcionam com filtros ativos
window.excluirOS = (id) => excluirOS(id);
window.editarOS = (id) => editarOS(id);

window.mostrarConfirmacao = mostrarConfirmacao;
window.adicionarMaterialEncerramento = adicionarMaterialEncerramento;
window.removerMaterialEncerramento = removerMaterialEncerramento;
window.limparFormulario = limparFormulario;

window.proximaPagina = proximaPagina;
window.paginaAnterior = paginaAnterior;
window.aplicarFiltros = aplicarFiltros;
window.gerarRelatorioMateriais = () => gerarRelatorioMateriais(ordens);

window.previsualizarOS = previsualizarOS;
window.imprimirDetalhesOS = imprimirDetalhesOS;
window.gerarPDFMateriais = gerarPDFMateriais;
window.exportarMateriaisOS = exportarMateriaisOS;
window.imprimirMateriaisMes = imprimirMateriaisMes;
window.imprimirRelatorio = imprimirRelatorio;

window.selecionarVisita = selecionarVisita;
window.limparFiltros = limparFiltros;
// No bloco de exposições globais do app.js
window.invalidarCache = invalidarCache;

window.reconstruirDashboard = reconstruirDashboard;
window.buscarVisitasPorNome = buscarVisitasPorNome;
window.contarOrdens = async function () {
  const total = await contarOrdensFirestore();
  console.log("Total de ordens:", total);
};