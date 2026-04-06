// ============================================================
// app.js — Orquestrador principal
// ============================================================

// 🔒 Inicializa flag global ANTES de qualquer import
window.modoEdicaoAtivo = false;

import "../auth.js";
import "../admin-users.js";

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "../firebase.js";

import {
  reconstruirDashboard,
  buscarVisitasPorNome,
  contarOrdensFirestore,
  salvarAceiteTermos,
  verificarAceiteTermos,
} from "../firestore.js";
import { inicializarFiltrosDinamicos, limparFiltros } from "../os/filtros.js";

import {
  mostrarAlerta,
  fecharAlerta,
  fecharConfirm,
  mostrarConfirmacao,
  showPage,
  toggleSidebar,
  toggleMenu,
  mostrarProgresso,
  concluirProgresso,
} from "./ui.js";
import {
  inicializarSistema,
  carregarSetores,
  adicionarMaterial,
  removerMaterial,
  visualizarOS,
  fecharModalDetalhes,
  alterarStatus,
  mostrarEncerramento,
  fecharModalEncerramento,
  excluirOS,
  editarOS,
  adicionarMaterialEncerramento,
  removerMaterialEncerramento,
  handleFormOSSubmit,
  handleFormEncerramentoSubmit,
  limparFormulario,
} from "./ordens.js";

import {
  proximaPagina,
  paginaAnterior,
  aplicarFiltros,
  carregarFiltroAno,
  carregarAnoMateriais,
  carregarSetoresFiltro,
  gerarRelatorioMateriais,
  invalidarCache,
} from "./filtros.js";

import { inicializarAutoCompleteVisitas, selecionarVisita } from "./visitas.js";

import {
  previsualizarOS,
  imprimirDetalhesOS,
  gerarPDFMateriais,
  exportarMateriaisOS,
  imprimirMateriaisMes,
  imprimirRelatorio,
} from "./impressao.js";

import { ordens } from "./state.js";

/* =========================
   TERMOS DE USO
========================= */
async function verificarTermos(userId) {
  try {
    const jaAceitou = await verificarAceiteTermos(userId);
    if (!jaAceitou) abrirModalTermos();
  } catch (e) {
    console.error("Erro ao verificar termos:", e);
  }
}

function abrirModalTermos() {
  const modal = document.getElementById("modal-termos");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("show");
  }
}

window.aceitarTermos = async function () {
  const userId = window._userId;
  if (!userId) return;
  mostrarProgresso();
  try {
    await salvarAceiteTermos(userId);
    const modal = document.getElementById("modal-termos");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("show");
    }
  } catch (e) {
    console.error("Erro ao salvar aceite:", e);
    mostrarAlerta("Erro ao registrar aceite. Tente novamente.", "Erro");
  } finally {
    concluirProgresso();
  }
};

window.recusarTermos = async function () {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Erro ao deslogar:", e);
  } finally {
    window.location.replace("index.html");
  }
};

// 👇 Agora o rodapé não reabre o modal — leva direto pro 1Doc
window.reabrirTermos = async function () {
  const modal = document.getElementById("modal-termos");
  if (!modal) return;

  const userId = window._userId;
  const jaAceitou = userId ? await verificarAceiteTermos(userId) : false;

  const btnRecusar = document.getElementById("btn-recusar-termos");
  const btnAceitar = document.getElementById("btn-aceitar-termos");
  const msgAceito  = document.getElementById("msg-termos-aceito");

  if (jaAceitou) {
    if (btnRecusar) { btnRecusar.disabled = true; btnRecusar.style.opacity = "0.5"; btnRecusar.style.cursor = "not-allowed"; }
    if (btnAceitar) { btnAceitar.disabled = true; btnAceitar.style.opacity = "0.5"; btnAceitar.style.cursor = "not-allowed"; }
    if (msgAceito)  msgAceito.style.display = "flex";
  } else {
    if (btnRecusar) { btnRecusar.disabled = false; btnRecusar.style.opacity = "1"; btnRecusar.style.cursor = "pointer"; }
    if (btnAceitar) { btnAceitar.disabled = false; btnAceitar.style.opacity = "1"; btnAceitar.style.cursor = "pointer"; }
    if (msgAceito)  msgAceito.style.display = "none";
  }

  modal.classList.remove("hidden");
  modal.classList.add("show");
};
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
  if (formEncerramento)
    formEncerramento.addEventListener("submit", handleFormEncerramentoSubmit);

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
    if (
      (el.tagName === "INPUT" && el.type === "text") ||
      el.tagName === "TEXTAREA"
    ) {
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


// Fecha modal de termos ao clicar fora ou pressionar ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharModalTermosSeAceito();
});

document.getElementById("modal-termos")?.addEventListener("click", function (e) {
  if (e.target === this) fecharModalTermosSeAceito();
});

async function fecharModalTermosSeAceito() {
  const userId = window._userId;
  const jaAceitou = userId ? await verificarAceiteTermos(userId) : false;
  if (!jaAceitou) return; // bloqueia fechar se ainda não aceitou
  const modal = document.getElementById("modal-termos");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  }
}

window.fecharModalTermos = fecharModalTermosSeAceito;

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
window.gerarRelatorioMateriais = () => gerarRelatorioMateriais();

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
