// ============================================================
// tabela.js — Tabela de visitas, filtros e paginação
// ============================================================

import {
  visits,
  currentPage,
  PAGE_SIZE,
  setCurrentPage,
  setFilterService,
  setSearchTerm,
} from "./state.js";
import { formatDate, escapeHtml, today } from "./utils.js";

/* =========================
   ESTADO LOCAL DE FILTROS DE DATA
========================= */
let filterDateStart = "";
let filterDateEnd = "";
let searchTermLocal = "";

/* =========================
   FILTRO
========================= */
export function getFilteredVisits() {
  return visits.filter((v) => {
    const matchDateStart = !filterDateStart || v.date >= filterDateStart;
    const matchDateEnd = !filterDateEnd || v.date <= filterDateEnd;
    const matchSearch =
      !searchTermLocal ||
      v.name?.toLowerCase().includes(searchTermLocal.toLowerCase()) ||
      v.phone?.includes(searchTermLocal) ||
      (v.phone2 && v.phone2.includes(searchTermLocal)) ||
      (v.cpf && v.cpf.includes(searchTermLocal));
    return matchDateStart && matchDateEnd && matchSearch;
  });
}

/* =========================
   TABELA PRINCIPAL
========================= */
export function renderTable() {
  const filtered = getFilteredVisits();
  const total = filtered.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);
  const tbody = document.getElementById("visits-tbody");

  // Badge de total filtrado
  const totalBadge = document.getElementById("filter-total-badge");
  if (totalBadge) {
    const temFiltro = filterDateStart || filterDateEnd || searchTermLocal;
    totalBadge.style.display = temFiltro ? "inline-flex" : "none";
    totalBadge.textContent = `${total} cadastro${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`;
  }

  if (!total) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state"><p>Nenhum cadastro encontrado.</p></div>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = page
      .map((v) => {
        return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone || "—")}</td>
  <td>${escapeHtml(v.address || "—")}</td>
  <td>${escapeHtml(v.reference || "—")}</td>
  <td>${formatDate(v.date)}</td>
  <td>
    <div class="td-actions">
      <button class="btn btn-icon edit" data-action="edit" data-id="${escapeHtml(v.id)}">✏️</button>
      <button class="btn btn-icon delete" data-action="delete" data-id="${escapeHtml(v.id)}">🗑️</button>
    </div>
  </td>
</tr>`;
      })
      .join("");
  }

  renderPagination(total, start);
}

function renderPagination(total, start) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageInfo = document.getElementById("page-info");
  const pageBtns = document.getElementById("page-btns");

  pageInfo.textContent = total
    ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}`
    : "0 visitas";

  let btns = `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? "disabled" : ""}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (
      pages <= 6 ||
      i === 1 ||
      i === pages ||
      Math.abs(i - currentPage) <= 1
    ) {
      btns += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    } else if (i === 2 && currentPage > 4) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    } else if (i === pages - 1 && currentPage < pages - 3) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }
  btns += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage >= pages ? "disabled" : ""}>›</button>`;
  pageBtns.innerHTML = btns;
}

export function changePage(p) {
  const filtered = getFilteredVisits();
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > pages) return;
  setCurrentPage(p);
  renderTable();
}

/* =========================
   TABELA DE HOJE
========================= */
export function renderTodayVisits() {
  const tbody = document.getElementById("today-visits");
  if (!tbody) return;

  const todayVisits = visits.filter((v) => v.date === today());

  if (!todayVisits.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum cadastro hoje</td></tr>`;
    return;
  }

  tbody.innerHTML = todayVisits
    .map((v) => {
      return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone || "—")}</td>
  <td>${escapeHtml(v.address || "—")}</td>
  <td>${escapeHtml(v.reference || "—")}</td>
  <td>${escapeHtml(v.date || "—")}</td>
</tr>`;
    })
    .join("");
}

/* =========================
   TABELA DE HISTÓRICO
========================= */
export function renderHistory(name) {
  const tbody = document.getElementById("history-tbody");
  const history = visits.filter(
    (v) =>
      v.name?.toLowerCase().includes(name.toLowerCase()) ||
      v.phone?.includes(name),
  );

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum histórico encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = history
    .map((v) => {
      const hour = new Date(v.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone)}${v.phone2 ? "<br>" + escapeHtml(v.phone2) : ""}</td>
  <td>${escapeHtml(v.sector)}</td>
  <td>${escapeHtml(v.reason)}</td>
  <td>${hour}</td>
</tr>`;
    })
    .join("");
}

/* =========================
   INICIALIZAR FILTROS
========================= */
export function initFilters() {
  // Imprimir lista
  document.getElementById("btn-print-lista")?.addEventListener("click", () => {
    imprimirListaVisitas();
  });
  // Data inicial
  document
    .getElementById("filter-date-start")
    ?.addEventListener("input", (e) => {
      filterDateStart = e.target.value;
      setCurrentPage(1);
      renderTable();
    });

  // Data final
  document.getElementById("filter-date-end")?.addEventListener("input", (e) => {
    filterDateEnd = e.target.value;
    setCurrentPage(1);
    renderTable();
  });

  // Busca por nome / telefone / CPF
  document.getElementById("filter-search")?.addEventListener("input", (e) => {
    searchTermLocal = e.target.value;
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    renderTable();
  });

  // Limpar filtros
  document
    .getElementById("btn-clear-filters")
    ?.addEventListener("click", () => {
      filterDateStart = "";
      filterDateEnd = "";
      searchTermLocal = "";
      setSearchTerm("");
      setFilterService("");

      ["filter-date-start", "filter-date-end", "filter-search"].forEach(
        (id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        },
      );

      setCurrentPage(1);
      renderTable();
      imprimirListaVisitas();
    });
}

/* =========================
   IMPRIMIR LISTA
========================= */
function imprimirListaVisitas() {
  const filtered = getFilteredVisits();
  const total = filtered.length;
  const dataEmissao = new Date().toLocaleString("pt-BR");

  const periodoStart = document.getElementById("filter-date-start")?.value;
  const periodoEnd = document.getElementById("filter-date-end")?.value;
  const busca = document.getElementById("filter-search")?.value?.trim();

  const periodo =
    periodoStart && periodoEnd
      ? `Período: ${new Date(periodoStart + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(periodoEnd + "T00:00:00").toLocaleDateString("pt-BR")}`
      : periodoStart
        ? `A partir de: ${new Date(periodoStart + "T00:00:00").toLocaleDateString("pt-BR")}`
        : periodoEnd
          ? `Até: ${new Date(periodoEnd + "T00:00:00").toLocaleDateString("pt-BR")}`
          : "Todos os registros";

  const linhas = filtered
    .map(
      (v,i) => `
    <tr>
    <td style="text-align:center; color:#999; font-size:10px;">${i + 1}</td>
      <td>${v.name || "—"}</td>
      <td>${v.cpf || "—"}</td>
      <td>${v.phone || "—"}</td>
      <td>${v.address || "—"}</td>
      <td>${v.reference || "—"}</td>
      <td>${v.date || "—"}</td>
    </tr>
  `,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Lista de Visitantes</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #222; }
        .header { text-align: center; margin-bottom: 16px; }
        .header img { width: 55px; margin-bottom: 6px; }
        .header h2 { font-size: 14px; margin: 0; }
        .header p { font-size: 10px; color: #555; margin: 2px 0; }
        .titulo { text-align: center; font-size: 13px; font-weight: bold;
                  text-transform: uppercase; margin: 10px 0 4px; }
        .periodo { text-align: center; font-size: 9px; color: #555; margin-bottom: 10px; }
        .resumo { display: inline-block; background: #e3f2fd; color: #1565c0;
                  font-weight: bold; padding: 4px 14px; border-radius: 20px;
                  font-size: 11px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f6f9; font-size: 10px; text-transform: uppercase;
             padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
        td { padding: 5px 8px; border: 1px solid #e0e0e0; vertical-align: top; }
        tr:nth-child(even) { background: #f9fbfd; }
        .footer { margin-top: 16px; font-size: 9px; color: #777; text-align: right; }
        @media print {
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/assets/img/prefeitura.png" alt="Prefeitura">
        <h2>Prefeitura Municipal de Oriximiná</h2>
        <p>Secretaria de Infraestrutura – SEINFRA</p>
      </div>

      <div class="titulo">Lista de Visitantes Cadastrados</div>
      <div class="periodo">${periodo}${busca ? ` &nbsp;|&nbsp; Busca: "${busca}"` : ""}</div>
      <div style="text-align:center;">
        <span class="resumo">Total: ${total} cadastro${total !== 1 ? "s" : ""}</span>
      </div>

      <table>
        <thead>
          <tr>
          <th style="width:35px; text-align:center;">#</th>
            <th>Nome</th>
            <th>CPF</th>
            <th>Telefone</th>
            <th>Endereço</th>
            <th>Referência</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>${linhas || `<tr><td colspan="7" style="text-align:center;">Nenhum cadastro encontrado</td></tr>`}</tbody>
      </table>

      <div class="footer">Documento gerado em: ${dataEmissao}</div>
    </body>
    </html>
  `;

  const janela = window.open("", "_blank", "width=900,height=700");
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 500);
}
