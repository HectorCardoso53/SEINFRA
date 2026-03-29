// ============================================================
// app.js — Orquestrador principal
// Importa todos os módulos e registra listeners e window.*
// ============================================================

import "../auth.js";
import "../admin-users.js";

import { reconstruirDashboard, buscarVisitasPorNome, contarOrdensFirestore } from "../firestore.js";

import { mostrarAlerta, fecharAlerta, fecharConfirm, mostrarConfirmacao, showPage, toggleSidebar, toggleMenu } from "./ui.js";
import { inicializarSistema, setDataAtual, carregarSetores,
  adicionarMaterial, removerMaterial,
  visualizarOS, fecharModalDetalhes, alterarStatus,
  mostrarEncerramento, fecharModalEncerramento,
  excluirOS, editarOS,
  adicionarMaterialEncerramento, removerMaterialEncerramento,
  handleFormOSSubmit, handleFormEncerramentoSubmit,
} from "./ordens.js";

import {
  carregarPagina, proximaPagina, paginaAnterior,
  aplicarFiltros, carregarFiltroAno, carregarAnoMateriais,
  carregarSetoresFiltro, gerarRelatorioMateriais,
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
  // Filtro de diretoria
  const filtroDiretoria = document.getElementById("filtro-diretoria");
  if (filtroDiretoria) {
    filtroDiretoria.addEventListener("change", function () {
      carregarSetoresFiltro(this.value);
    });
  }

  // Tipo OS
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

  // Diretoria → setores
  const selectDiretoria = document.getElementById("setor-responsavel");
  const selectSetor = document.getElementById("setor-solicitante");
  if (selectDiretoria && selectSetor) {
    selectDiretoria.addEventListener("change", () => {
      carregarSetores(selectDiretoria.value);
    });
  }

  // Overlay sidebar
  const overlay = document.querySelector(".overlay");
  if (overlay) {
    overlay.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // Formulário de OS
  const formOS = document.getElementById("form-os");
  if (formOS) formOS.addEventListener("submit", handleFormOSSubmit);

  // Formulário de encerramento
  const formEncerramento = document.getElementById("form-encerramento");
  if (formEncerramento) formEncerramento.addEventListener("submit", handleFormEncerramentoSubmit);

  // Máscara CPF
  const cpfInput = document.getElementById("cpf-solicitante");
  cpfInput?.addEventListener("input", function (e) {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    e.target.value = v;
  });

  // Máscara telefone
  const telefoneInput = document.getElementById("telefone-solicitante");
  telefoneInput?.addEventListener("input", function (e) {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    e.target.value = v;
  });

  // Auto-uppercase em inputs de texto
  document.addEventListener("input", function (e) {
    const el = e.target;
    if ((el.tagName === "INPUT" && el.type === "text") || el.tagName === "TEXTAREA") {
      const pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      el.setSelectionRange(pos, pos);
    }
  });

  // Autocomplete de visitas
  inicializarAutoCompleteVisitas();

  // Inicializa o sistema
  inicializarSistema();
  carregarAnoMateriais();
  carregarFiltroAno();
});

/* =========================
   EXPOSIÇÃO GLOBAL (window.*)
   Necessário para onclick inline no HTML
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
window.excluirOS = (id) => excluirOS(id, ordens);
window.editarOS = (id) => editarOS(id, ordens);
window.mostrarConfirmacao = mostrarConfirmacao;
window.adicionarMaterialEncerramento = adicionarMaterialEncerramento;
window.removerMaterialEncerramento = removerMaterialEncerramento;

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

window.reconstruirDashboard = reconstruirDashboard;
window.buscarVisitasPorNome = buscarVisitasPorNome;
window.contarOrdens = async function () {
  const total = await contarOrdensFirestore();
  console.log("Total de ordens:", total);
};
