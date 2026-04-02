// ============================================================
// ui.js — Manipulação de DOM: modais, alertas, sidebar, header
// ============================================================

import { materiais, materiaisEncerramento } from "./state.js";

/* =========================
   ALERTAS E CONFIRMAÇÕES
========================= */
export function mostrarAlerta(mensagem, titulo = "Aviso") {
  document.getElementById("modal-alerta-titulo").innerText = titulo;
  document.getElementById("modal-alerta-mensagem").innerText = mensagem;
  document.getElementById("modal-alerta").classList.remove("hidden");
}

export function fecharAlerta() {
  document.getElementById("modal-alerta").classList.add("hidden");
}

export function fecharConfirm() {
  document.getElementById("modal-confirm").classList.add("hidden");
}

export function mostrarConfirmacao(mensagem, callbackConfirmar) {
  document.getElementById("modal-confirm-mensagem").innerText = mensagem;
  const modal = document.getElementById("modal-confirm");
  modal.classList.remove("hidden");
  const btn = document.getElementById("btn-confirmar-acao");
  btn.onclick = function () {
    callbackConfirmar();
    fecharConfirm();
  };
}

/* =========================
   HEADER
========================= */
export function atualizarHeader(pageId) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  const map = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Visão geral do sistema de ordens de serviço",
    },
    "nova-os": {
      title: "Nova Ordem de Serviço",
      subtitle: "Criação de uma nova OS",
    },
    relatorios: {
      title: "Relatórios",
      subtitle: "Consulta e análise das ordens",
    },
    "materiais-mes": {
      title: "Materiais por Mês",
      subtitle: "Relatório de materiais utilizados nas ordens",
    },
    usuarios: {
      title: "Cadastro de Usuários",
      subtitle: "Gerenciamento de acessos do sistema",
    },
  };
  if (map[pageId]) {
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }
}

/* =========================
   NAVEGAÇÃO
========================= */
export function showPage(pageId, element) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById("page-" + pageId).classList.remove("hidden");
  document
    .querySelectorAll(".menu-item")
    .forEach((m) => m.classList.remove("active"));
  if (element) element.classList.add("active");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

export function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");
  if (sidebar) sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("show");
}

export function toggleMenu() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.querySelector(".overlay");
  const main = document.querySelector(".main-content");
  if (!sidebar) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("show");
  } else {
    sidebar.classList.toggle("oculto");
    if (main) main.classList.toggle("expandido");
  }
}

/* =========================
   RENDERIZAÇÃO DE MATERIAIS
========================= */
export function renderizarMateriais(materiaisLista) {
  const lista = document.getElementById("lista-materiais");
  if (materiaisLista.length === 0) {
    lista.classList.add("hidden");
    lista.innerHTML = "";
    return;
  }
  lista.classList.remove("hidden");
  lista.innerHTML = materiaisLista
    .map(
      (m, index) => `
    <div class="material-item">
      <div class="material-info">
        <strong>${m.nome}</strong><br>
        <small>${m.quantidade ? m.quantidade + " " + m.unidade : m.unidade}</small>
      </div>
      <button type="button" class="btn btn-danger btn-small" onclick="removerMaterial(${index})">
        Remover
      </button>
    </div>
  `,
    )
    .join("");
}

export function renderizarMateriaisEncerramento(lista) {
  const el = document.getElementById("lista-materiais-encerramento");
  if (!el) return;
  if (lista.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = lista
    .map(
      (m, i) => `
      <div class="material-item">
        <strong>${m.nome}</strong> - ${m.quantidade || ""} ${m.unidade}
        <button onclick="removerMaterialEncerramento(${i})">Remover</button>
      </div>
    `,
    )
    .join("");
}

export function mostrarProgresso() {
  const overlay = document.getElementById("progressbar-global");
  if (overlay) overlay.classList.remove("hidden");
}

export function concluirProgresso() {
  const overlay = document.getElementById("progressbar-global");
  if (overlay) overlay.classList.add("hidden");
}

/* =========================
   SUGESTÕES DE VISITA
========================= */
export function renderSugestoes(lista, onSelect) {
  const box = document.getElementById("box-sugestoes");
  if (!box) {
    console.warn("Box de sugestões não encontrada");
    return;
  }
  if (!Array.isArray(lista) || lista.length === 0) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }
  const html = lista
    .map((v) => {
      const nome = (v.name || v.nome || "").toUpperCase();
      return `<div class="item-sugestao" data-id="${v.id}">${nome}</div>`;
    })
    .join("");
  box.innerHTML = html;
  box.style.display = "block";
  box.querySelectorAll(".item-sugestao").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      onSelect(id);
    });
  });
}
