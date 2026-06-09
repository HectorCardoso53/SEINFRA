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
import { inicializarFiltrosDinamicos, limparFiltros, filtrarTabelaMateriais } from "../os/filtros.js";

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
  abrirModalAssinatura,
  fecharModalAssinatura,
  limparCanvas,
  confirmarAssinatura,
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
  getOrdensCached,
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
   PENDÊNCIAS (master/admin)
========================= */
import { formatarData } from "./utils.js";

let _pendentesLista = [];
let _pendentesPagina = 1;
const _PEND_POR_PAGINA = 20;

async function carregarPendencias() {
  const todasOrdens = await getOrdensCached();

  const abertas    = todasOrdens.filter(o => (o.status||"").toLowerCase() === "aberta");
  const andamento  = todasOrdens.filter(o => (o.status||"").toLowerCase() === "em andamento");
  const encerradas = todasOrdens.filter(o => (o.status||"").toLowerCase() === "encerrada");
  _pendentesLista  = [...abertas, ...andamento]
    .filter(o => !(o.assinaturaEletronica && o.assinaturaEletronica.nome))
    .sort((a, b) => (b.numeroSequencial||0) - (a.numeroSequencial||0));

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("pend-count-assinatura", _pendentesLista.length);
  set("pend-count-abertas",    abertas.length);
  set("pend-count-andamento",  andamento.length);
  set("pend-count-encerradas", encerradas.length);

  _pendentesPagina = 1;
  const busca = document.getElementById("pend-busca");
  if (busca) busca.value = "";
  renderPendentes();
}

function renderPendentes() {
  const busca = (document.getElementById("pend-busca")?.value || "").toLowerCase().trim();
  const lista = busca
    ? _pendentesLista.filter(o =>
        (o.numero||"").toLowerCase().includes(busca) ||
        (o.nomeSolicitante||"").toLowerCase().includes(busca))
    : _pendentesLista;

  const total = lista.length;
  const totalPag = Math.ceil(total / _PEND_POR_PAGINA) || 1;
  if (_pendentesPagina > totalPag) _pendentesPagina = totalPag;
  const inicio = (_pendentesPagina - 1) * _PEND_POR_PAGINA;
  const pagina = lista.slice(inicio, inicio + _PEND_POR_PAGINA);

  const tbody = document.getElementById("tabela-pendencias");
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#2e7d32;padding:24px;font-weight:600;">
      <i class="bi bi-check-circle"></i> ${busca ? "Nenhuma OS encontrada" : "Nenhuma OS pendente de assinatura"}
    </td></tr>`;
    document.getElementById("pend-paginacao").innerHTML = "";
    return;
  }

  const tipoBadge = (t) => {
    const v = (t||"").toLowerCase();
    if (v === "interna") return `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;background:#ede7f6;color:#6a1b9a;">INTERNA</span>`;
    if (v === "externa") return `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:10px;background:#e0f7fa;color:#00838f;">EXTERNA</span>`;
    return "";
  };

  tbody.innerHTML = pagina.map(o => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:12px 8px;">${(o.numero||"-").toUpperCase()}<br>${tipoBadge(o.tipoOS)}</td>
      <td style="padding:12px 8px;">${o.dataAbertura ? formatarData(o.dataAbertura) : "-"}</td>
      <td style="padding:12px 8px;"><span class="status-badge status-${(o.status||"").toLowerCase().replace(/\s/g,"-")}">${(o.status||"-").toUpperCase()}</span></td>
      <td style="padding:12px 8px;">${(o.nomeSolicitante||"-").toUpperCase()}</td>
      <td style="padding:12px 8px;max-width:160px;word-break:break-word;">${(o.descricaoServico||"-").substring(0,55)}…</td>
      <td style="padding:12px 8px;">
        <button class="btn btn-warning btn-icon" onclick="visualizarOS('${o.id}', true)" title="Assinar">
          <i class="bi bi-pen"></i>
        </button>
      </td>
    </tr>
  `).join("");

  // paginação
  const pag = document.getElementById("pend-paginacao");
  if (!pag) return;
  const btnAntes = _pendentesPagina > 1
    ? `<button class="btn btn-secondary" style="padding:6px 16px;font-size:13px;" onclick="pendPagina(${_pendentesPagina-1})"><i class="bi bi-chevron-left"></i> Anterior</button>`
    : `<button class="btn btn-secondary" style="padding:6px 16px;font-size:13px;opacity:.4;" disabled><i class="bi bi-chevron-left"></i> Anterior</button>`;
  const btnDepois = _pendentesPagina < totalPag
    ? `<button class="btn btn-primary" style="padding:6px 16px;font-size:13px;" onclick="pendPagina(${_pendentesPagina+1})">Próxima <i class="bi bi-chevron-right"></i></button>`
    : `<button class="btn btn-primary" style="padding:6px 16px;font-size:13px;opacity:.4;" disabled>Próxima <i class="bi bi-chevron-right"></i></button>`;
  pag.innerHTML = `
    ${btnAntes}
    <span style="font-size:13px;color:#555;font-weight:600;">
      Página ${_pendentesPagina} de ${totalPag} &nbsp;·&nbsp; ${total} OS
    </span>
    ${btnDepois}`;
}

window.carregarPendencias = carregarPendencias;
window.pendPagina = function(p) { _pendentesPagina = p; renderPendentes(); };
window.filtroPendencias = function() { _pendentesPagina = 1; renderPendentes(); };

window.imprimirPendencias = function() {
  if (!_pendentesLista.length) { mostrarAlerta("Nenhuma OS pendente para imprimir.", "Atenção"); return; }
  const dataEmissao = new Date().toLocaleString("pt-BR");
  const linhas = _pendentesLista.map((o, i) => `
    <tr>
      <td style="text-align:center;">${i+1}</td>
      <td>${(o.numero||"-").toUpperCase()}</td>
      <td>${(o.tipoOS||"-").toUpperCase()}</td>
      <td>${o.dataAbertura ? formatarData(o.dataAbertura) : "-"}</td>
      <td>${(o.status||"-").toUpperCase()}</td>
      <td>${(o.nomeSolicitante||"-").toUpperCase()}</td>
      <td>${(o.descricaoServico||"-").substring(0,80)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>OS Pendentes de Assinatura</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial; font-size: 9px; }
    .header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .header img { width:36px; }
    .header h1 { font-size:13px; }
    .header p { font-size:9px; color:#555; }
    h2 { font-size:11px; margin-bottom:8px; color:#f57f17; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f5f5f5; border:1px solid #ccc; padding:4px 6px; font-size:8.5px; text-align:left; }
    td { border:1px solid #ddd; padding:3px 6px; vertical-align:top; }
    tr:nth-child(even) td { background:#fafafa; }
    .footer { margin-top:8px; font-size:8px; color:#888; text-align:right; }
    .badge-ext { background:#e0f7fa; color:#00838f; padding:1px 5px; border-radius:8px; font-weight:bold; }
    .badge-int { background:#ede7f6; color:#6a1b9a; padding:1px 5px; border-radius:8px; font-weight:bold; }
  </style></head><body>
  <div class="header">
    <img src="assets/img/prefeitura.png">
    <div><h1>Prefeitura Municipal de Oriximiná</h1><p>Secretaria de Infraestrutura – SEINFRA</p></div>
  </div>
  <h2><i>OS Pendentes de Assinatura — Total: ${_pendentesLista.length}</i></h2>
  <table>
    <thead><tr><th>#</th><th>Número</th><th>Tipo</th><th>Data</th><th>Status</th><th>Solicitante</th><th>Descrição</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="footer">Gerado em: ${dataEmissao}</div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
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

  // Só o master vai direto para Pendências ao logar
  window._onAuthPronto = function () {
    if (window.userRole === "master") {
      const menuPendencias = document.querySelector('.menu-item[onclick*="pendencias"]');
      showPage("pendencias", menuPendencias);
      carregarPendencias();
    }
  };
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

window.abrirModalAssinatura = abrirModalAssinatura;
window.fecharModalAssinatura = fecharModalAssinatura;
window.limparCanvas = limparCanvas;
window.confirmarAssinatura = confirmarAssinatura;

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

window.filtrarTabelaMateriais = filtrarTabelaMateriais;

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
