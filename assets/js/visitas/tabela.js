// ============================================================
// tabela.js — Tabela de visitas, filtros e paginação
// ============================================================

import { visits, currentPage, filterDate, searchTerm, PAGE_SIZE,
  setCurrentPage, setFilterDate, setFilterService, setSearchTerm } from "./state.js";
import { formatDate, escapeHtml, today } from "./utils.js";

/* =========================
   FILTRO
========================= */
export function getFilteredVisits() {
  return visits.filter((v) => {
    const matchDate = !filterDate || v.date === filterDate;
    const matchSearch =
      !searchTerm ||
      v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.phone?.includes(searchTerm) ||
      (v.phone2 && v.phone2.includes(searchTerm)) ||
      (v.cpf && v.cpf.includes(searchTerm));
    return matchDate && matchSearch;
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

  if (!total) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state"><p>Nenhuma visita encontrada.</p></div>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = page.map((v) => {
      const statusClasse = v.status ? v.status.toLowerCase().replace(/\s/g, "-") : "";
      return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone)}${v.phone2 ? "<br>" + escapeHtml(v.phone2) : ""}</td>
  <td>${formatDate(v.date)}</td>
  <td>
    <span class="badge" style="background:#e3f2fd;color:#1565c0">
      ${v.diretoria ? escapeHtml(v.diretoria) : '<span style="color:#e53935;font-weight:600">PENDENTE</span>'}
    </span>
  </td>
  <td><span class="badge">${escapeHtml(v.sector || "—")}</span></td>
  <td>${escapeHtml(v.address || "—")}</td>
  <td>${escapeHtml(v.reference || "—")}</td>
  <td style="color:var(--text-muted);font-size:13px;max-width:260px;white-space:normal;word-break:break-word;">
    ${escapeHtml(v.reason)}
  </td>
  <td>
    <div class="td-actions">
      <button class="btn btn-icon edit"  data-action="edit"   data-id="${escapeHtml(v.id)}" title="Editar">✏️</button>
      <button class="btn btn-icon delete" data-action="delete" data-id="${escapeHtml(v.id)}" title="Excluir">🗑️</button>
    </div>
  </td>
</tr>`;
    }).join("");
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
    if (pages <= 6 || i === 1 || i === pages || Math.abs(i - currentPage) <= 1) {
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
    tbody.innerHTML = `<tr><td colspan="8">Nenhum atendimento registrado hoje</td></tr>`;
    return;
  }

  tbody.innerHTML = todayVisits.map((v) => {
    const hour = new Date(v.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone)}${v.phone2 ? "<br>" + escapeHtml(v.phone2) : ""}</td>
  <td>${escapeHtml(v.address || "—")}</td>
  <td>${escapeHtml(v.reference || "—")}</td>
  <td>${escapeHtml(v.sector)}</td>
  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(v.reason)}</td>
  <td>${hour}</td>
</tr>`;
  }).join("");
}

/* =========================
   TABELA DE HISTÓRICO
========================= */
export function renderHistory(name) {
  const tbody = document.getElementById("history-tbody");
  const history = visits.filter(
    (v) => v.name?.toLowerCase().includes(name.toLowerCase()) || v.phone?.includes(name)
  );

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhum histórico encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map((v) => {
    const hour = new Date(v.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `
<tr>
  <td><strong>${escapeHtml(v.name)}</strong></td>
  <td>${escapeHtml(v.cpf || "—")}</td>
  <td>${escapeHtml(v.phone)}${v.phone2 ? "<br>" + escapeHtml(v.phone2) : ""}</td>
  <td>${escapeHtml(v.sector)}</td>
  <td>${escapeHtml(v.reason)}</td>
  <td>${hour}</td>
</tr>`;
  }).join("");
}

/* =========================
   INICIALIZAR FILTROS
========================= */
export function initFilters() {
  document.getElementById("filter-date")?.addEventListener("input", (e) => {
    setFilterDate(e.target.value);
    setCurrentPage(1);
    renderTable();
  });

  document.getElementById("filter-service")?.addEventListener("input", (e) => {
    setFilterService(e.target.value.trim());
    setCurrentPage(1);
    renderTable();
  });

  document.getElementById("filter-search")?.addEventListener("input", (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    renderTable();
  });

  document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
    setFilterDate("");
    setFilterService("");
    setSearchTerm("");
    const fields = ["filter-date", "filter-service", "filter-search"];
    fields.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    setCurrentPage(1);
    renderTable();
  });
}
