import { db, auth } from "./firebase.js";

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── STATE ──────────────────────────────────────────────
let visits = [];

let persons = [];

let editingId = null;
let currentPage = 1;
const PAGE_SIZE = 8;
let filterDate = "";
let filterService = "";
let searchTerm = "";

// Chart instances
let chartService = null;
let chartMonth = null;

window.logout = async function () {
  await signOut(auth);
  window.location.replace("/index.html");
};
async function loadVisits() {
  const q = query(collection(db, "visitas"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  visits = [];

  querySnapshot.forEach((docSnap) => {
    visits.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  updateSidebarCounter();
}

// ─── HELPERS ────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function serviceBadgeClass(service) {
  const map = {
    Certidão: "badge-certidao",
    Protocolo: "badge-protocolo",
    Informação: "badge-informacao",
    Requerimento: "badge-requerimento",
    Outros: "badge-outros",
    historico: {
      title: "Histórico",
      subtitle: "Histórico de atendimento por pessoa",
    },
  };
  return map[service] || "badge-outros";
}

function updateSidebarCounter() {
  const el = document.getElementById("visit-count");
  if (el) el.textContent = visits.length;
}

async function loadPersons() {
  const querySnapshot = await getDocs(collection(db, "pessoas"));

  persons = [];

  querySnapshot.forEach((docSnap) => {
    persons.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });
}

// ─── NAVIGATION ─────────────────────────────────────────
function navigate(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  document.getElementById(`page-${page}`)?.classList.add("active");

  document
    .querySelectorAll(`[data-nav="${page}"]`)
    .forEach((n) => n.classList.add("active"));

  atualizarHeader(page); // ← ADICIONE ESTA LINHA

  if (page === "lista") renderTable();
  if (page === "dashboard") renderDashboard();
}

window.closeSidebar = function () {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
};
// ─── SIDEBAR MOBILE ─────────────────────────────────────
window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  const main = document.querySelector(".main");

  sidebar.classList.toggle("collapsed");
  main.classList.toggle("expanded");
};

window.closeSidebar = function () {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
};

// ─── FORM ────────────────────────────────────────────────
function initForm() {
  const form = document.getElementById("visit-form");
  form.addEventListener("submit", handleFormSubmit);
  document
    .getElementById("btn-cancel-edit")
    .addEventListener("click", cancelEdit);
  document.getElementById("btn-clear").addEventListener("click", clearForm);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const data = getFormData();
  if (!validateForm(data)) return;

  try {
    if (editingId) {
      // atualizar no Firestore
      await updateDoc(doc(db, "visitas", editingId), data);

      showToast("Visita atualizada com sucesso!", "success");
      cancelEdit();
    } else {
      // salvar no Firestore
      await addDoc(collection(db, "visitas"), {
        ...data,
        createdAt: new Date().toISOString(),
      });

      await loadPersons();

      showToast("Visita cadastrada com sucesso!", "success");
      clearForm();
    }

    // recarregar lista
    await loadVisits();

    // atualizar tabela e dashboard
    renderTable();
    renderDashboard();
    renderTodayVisits();
  } catch (error) {
    console.error("Erro ao salvar visita:", error);
    showToast("Erro ao salvar visita.", "error");
  }
}

function getFormData() {
  return {
    name: document.getElementById("f-name").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    date: document.getElementById("f-date").value,
    sector: document.getElementById("f-sector").value,
    reason: document.getElementById("f-reason").value.trim(),
  };
}

async function validateForm(data) {
  const personExists = persons.some(
    (p) => p.name.toLowerCase() === data.name.toLowerCase(),
  );

  if (!personExists) {
    await addDoc(collection(db, "pessoas"), {
      name: data.name,
      phone: data.phone,
      createdAt: new Date().toISOString(),
    });

    await loadPersons();
  }

  if (!data.phone) {
    showToast("Informe o contato.", "error");
    return false;
  }

  if (!data.date) {
    showToast("Informe a data da visita.", "error");
    return false;
  }

  if (!data.sector) {
    showToast("Informe o setor.", "error");
    return false;
  }

  if (!data.reason) {
    showToast("Informe o motivo da visita.", "error");
    return false;
  }

  return true;
}

function clearForm() {
  document.getElementById("visit-form").reset();
  document.getElementById("f-date").value = today();
}

function cancelEdit() {
  editingId = null;
  document.getElementById("form-card-title").textContent = "Nova Visita";
  document.getElementById("btn-submit").innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Cadastrar Visita`;
  document.getElementById("btn-cancel-edit").style.display = "none";
  clearForm();
}

// ─── TABLE ────────────────────────────────────────────────
function getFilteredVisits() {
  return visits.filter((v) => {
    const matchDate = !filterDate || v.date === filterDate;
    const matchService =
      !filterService ||
      v.sector.toLowerCase().includes(filterService.toLowerCase());
    const matchSearch =
      !searchTerm ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.phone.includes(searchTerm);
    return matchDate && matchService && matchSearch;
  });
}

function renderTable() {
  const filtered = getFilteredVisits();
  const total = filtered.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("visits-tbody");

  if (!total) {
    tbody.innerHTML = `
    <tr>
      <td colspan="6">
        <div class="empty-state">
          <p>Nenhuma visita encontrada.</p>
        </div>
      </td>
    </tr>
    `;
  } else {
    tbody.innerHTML = page
      .map(
        (v) => `

      <tr>

        <td><strong>${escapeHtml(v.name)}</strong></td>

        <td>${escapeHtml(v.phone)}</td>

        <td>${formatDate(v.date)}</td>

        <td>
          <span class="badge">
            ${escapeHtml(v.sector)}
          </span>
        </td>

        <td style="
          color:var(--text-muted);
          font-size:12px;
          max-width:200px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap
        ">
          ${escapeHtml(v.reason)}
        </td>

        <td>
          <div class="td-actions">

            <button
              class="btn btn-icon edit"
              onclick="editVisit('${v.id}')"
              title="Editar"
            >
              ✏️
            </button>

            <button
              class="btn btn-icon delete"
              onclick="confirmDelete('${v.id}')"
              title="Excluir"
            >
              🗑️
            </button>

          </div>
        </td>

      </tr>

    `,
      )
      .join("");
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  const pageInfo = document.getElementById("page-info");
  const pageBtns = document.getElementById("page-btns");

  pageInfo.textContent = total
    ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}`
    : "0 visitas";

  let btns = "";

  btns += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? "disabled" : ""}>‹</button>`;

  for (let i = 1; i <= pages; i++) {
    if (
      pages <= 6 ||
      i === 1 ||
      i === pages ||
      Math.abs(i - currentPage) <= 1
    ) {
      btns += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === 2 && currentPage > 4) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    } else if (i === pages - 1 && currentPage < pages - 3) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }

  btns += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage >= pages ? "disabled" : ""}>›</button>`;

  pageBtns.innerHTML = btns;
}

function changePage(p) {
  const filtered = getFilteredVisits();
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderTable();
}

function editVisit(id) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;

  editingId = id;

  document.getElementById("f-name").value = v.name;
  document.getElementById("f-phone").value = v.phone;
  document.getElementById("f-date").value = v.date;
  document.getElementById("f-sector").value = v.sector;
  document.getElementById("f-reason").value = v.reason;

  document.getElementById("form-card-title").textContent = "Editar Visita";

  document.getElementById("btn-submit").innerHTML = `Salvar Alterações`;

  document.getElementById("btn-cancel-edit").style.display = "inline-flex";

  navigate("cadastro");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function confirmDelete(id) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;
  document.getElementById("confirm-name").textContent = v.name;
  document.getElementById("confirm-overlay").classList.add("open");
  document.getElementById("btn-confirm-delete").onclick = () => deleteVisit(id);
}

async function deleteVisit(id) {
  await deleteDoc(doc(db, "visitas", id));

  closeConfirm(); // 👈 fecha o modal

  await loadVisits();

  renderTable();
  renderDashboard();

  showToast("Visita excluída.", "success");
}

function closeConfirm() {
  document.getElementById("confirm-overlay").classList.remove("open");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── FILTERS ─────────────────────────────────────────────
function initFilters() {
  document.getElementById("filter-date").addEventListener("input", (e) => {
    filterDate = e.target.value;
    currentPage = 1;
    renderTable();
  });

  const serviceFilter = document.getElementById("filter-service");

  if (serviceFilter) {
    serviceFilter.addEventListener("input", (e) => {
      filterService = e.target.value.trim();
      currentPage = 1;
      renderTable();
    });
  }

  document.getElementById("filter-search").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.getElementById("btn-clear-filters").addEventListener("click", () => {
    filterDate = "";
    filterService = "";
    searchTerm = "";

    const dateInput = document.getElementById("filter-date");
    const serviceInput = document.getElementById("filter-service");
    const searchInput = document.getElementById("filter-search");

    if (dateInput) dateInput.value = "";
    if (serviceInput) serviceInput.value = "";
    if (searchInput) searchInput.value = "";

    currentPage = 1;
    renderTable();
  });
}

// ─── PHONE MASK ──────────────────────────────────────────
function initPhoneMask() {
  const inputs = [
    document.getElementById("f-phone"),
    document.getElementById("p-phone"),
  ];

  inputs.forEach((el) => {
    if (!el) return;

    el.addEventListener("input", function () {
      let v = this.value.replace(/\D/g, "");

      if (v.length > 11) v = v.slice(0, 11);

      if (v.length > 6) {
        this.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        this.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        this.value = `(${v}`;
      }
    });
  });
}

// ─── DASHBOARD ────────────────────────────────────────────
function renderDashboard() {
  const total = visits.length;

  const thisMonth = visits.filter(
    (v) => v.date && v.date.slice(0, 7) === today().slice(0, 7),
  ).length;

  const todayCount = visits.filter((v) => v.date === today()).length;

  // atualizar cards
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-month").textContent = thisMonth;
  document.getElementById("stat-today").textContent = todayCount;

  // calcular setor mais visitado
  const sectorCounts = {};

  visits.forEach((v) => {
    if (!v.sector) return;

    sectorCounts[v.sector] = (sectorCounts[v.sector] || 0) + 1;
  });

  const topSector =
    Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  document.getElementById("stat-top-service").textContent = topSector;

  renderServiceChart(sectorCounts);
  renderMonthChart();
}

const CHART_COLORS = [
  "#3498db", // azul
  "#2ecc71", // verde
  "#f1c40f", // amarelo
  "#e74c3c", // vermelho
  "#9b59b6", // roxo
  "#1abc9c", // turquesa
  "#e67e22", // laranja
];

function renderServiceChart(counts) {
  const canvas = document.getElementById("chart-service");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  if (chartService) chartService.destroy();

  chartService = new Chart(ctx, {
    type: "doughnut",

    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderWidth: 0,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    },
  });
}
function renderHistory(name) {
  const tbody = document.getElementById("history-tbody");

  const history = visits.filter((v) =>
    v.name.toLowerCase().includes(name.toLowerCase()),
  );

  if (!history.length) {
    tbody.innerHTML = `
<tr>
<td colspan="5">Nenhum histórico encontrado</td>
</tr>
`;

    return;
  }

  tbody.innerHTML = history
    .map(
      (v) => `

<tr>

<td>${formatDate(v.date)}</td>

<td>${escapeHtml(v.name)}</td>

<td>${escapeHtml(v.phone)}</td>

<td>${escapeHtml(v.sector)}</td>

<td>${escapeHtml(v.reason)}</td>

</tr>

`,
    )
    .join("");
}

function renderMonthChart() {
  const canvas = document.getElementById("chart-month");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const monthMap = {};

  visits.forEach((v) => {
    if (!v.date) return;

    const ym = v.date.slice(0, 7);

    monthMap[ym] = (monthMap[ym] || 0) + 1;
  });

  const sorted = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  const labels = sorted.map(([ym]) => ym);
  const data = sorted.map(([, v]) => v);

  if (chartMonth) chartMonth.destroy();

  chartMonth = new Chart(ctx, {
    type: "bar",

    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: "#2D5A3D",
          borderRadius: 6,
        },
      ],
    },

    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function renderTodayVisits() {
  const tbody = document.getElementById("today-visits");

  if (!tbody) return;

  const todayVisits = visits.filter((v) => v.date === today());

  if (todayVisits.length === 0) {
    tbody.innerHTML = `
    <tr>
      <td colspan="5">Nenhum atendimento registrado hoje</td>
    </tr>
    `;

    return;
  }

  tbody.innerHTML = todayVisits
    .map((v) => {
      const hour = new Date(v.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      return `

<tr>

<td><strong>${escapeHtml(v.name)}</strong></td>

<td>${escapeHtml(v.phone)}</td>

<td>${escapeHtml(v.sector)}</td>

<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
${escapeHtml(v.reason)}
</td>

<td>${hour}</td>

</tr>

`;
    })
    .join("");
}

// ─── TOAST ────────────────────────────────────────────────
function showToast(msg, type = "success") {
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

async function savePerson(e) {
  const exists = persons.some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );

  if (exists) {
    showToast("Essa pessoa já está cadastrada", "error");
    return;
  }

  e.preventDefault();

  const name = document.getElementById("p-name").value.trim();
  const phone = document.getElementById("p-phone").value.trim();

  if (!name || !phone) {
    showToast("Preencha nome e telefone", "error");
    return;
  }

  await addDoc(collection(db, "pessoas"), {
    name,
    phone,
    createdAt: new Date().toISOString(),
  });

  showToast("Pessoa cadastrada com sucesso!");

  document.getElementById("person-form").reset();
}

function atualizarHeader(pageId) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  const map = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Resumo e análise das visitas registradas",
    },

    cadastro: {
      title: "Cadastrar Visita",
      subtitle: "Registro de novos atendimentos",
    },

    lista: {
      title: "Lista de Visitas",
      subtitle: "Consulta de visitas registradas",
    },
  };

  if (map[pageId]) {
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }
}

window.toggleSidebar = function () {
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
};

/* fechar clicando no fundo */

document.getElementById("sidebar-overlay").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
});

function initPersonAutocomplete() {
  const input = document.getElementById("f-name");
  const list = document.getElementById("person-suggestions");
  const phone = document.getElementById("f-phone");
  const warning = document.getElementById("person-warning");

  if (!input) return;

  input.addEventListener("input", function () {
    const value = this.value.toLowerCase();

    list.innerHTML = "";
    warning.style.display = "none";

    if (value.length < 2) return;

    const matches = persons.filter((p) => p.name.toLowerCase().includes(value));

    if (matches.length === 0) {
      warning.style.display = "block";
      phone.value = "";

      return;
    }

    matches.forEach((person) => {
      const div = document.createElement("div");

      div.className = "autocomplete-item";

      div.innerHTML = `
<strong>${person.name}</strong>
<br>
<span style="font-size:12px;color:#666">${person.phone}</span>
`;

      div.onclick = () => {
        input.value = person.name;
        phone.value = person.phone;

        warning.style.display = "none";
        list.innerHTML = "";
      };

      list.appendChild(div);
    });
  });
}
// ─── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadVisits();
  await loadPersons();

  initForm();
  initFilters();
  initPhoneMask();
  initPersonAutocomplete();

  // conectar formulário de cadastro de pessoa
  const personForm = document.getElementById("person-form");
  if (personForm) {
    personForm.addEventListener("submit", savePerson);
  }

  // definir data padrão da visita
  const dateInput = document.getElementById("f-date");
  if (dateInput) {
    dateInput.value = today();
  }

  const historyBtn = document.getElementById("btn-search-history");

  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      const name = document.getElementById("history-search").value;

      renderHistory(name);
    });
  }

  // navegação do menu
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  // badge de hoje (se existir)
  const todayBadge = document.getElementById("today-badge");
  if (todayBadge) {
    const d = new Date();
    todayBadge.textContent = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  // botão hamburger
  const hamburger = document.getElementById("hamburger");
  if (hamburger) {
    hamburger.addEventListener("click", toggleSidebar);
  }

  // fechar sidebar clicando fora
  const overlay = document.getElementById("sidebar-overlay");
  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  // cancelar exclusão
  const cancelDelete = document.getElementById("btn-cancel-delete");
  if (cancelDelete) {
    cancelDelete.addEventListener("click", closeConfirm);
  }

  // página inicial
  navigate("dashboard");

  renderTable();
  renderDashboard();
  renderTodayVisits();
});

document.addEventListener("click", (e) => {
  const box = document.querySelector(".autocomplete-box");
  const list = document.getElementById("person-suggestions");

  if (!box.contains(e.target)) {
    list.innerHTML = "";
  }
});

window.editVisit = editVisit;
window.confirmDelete = confirmDelete;
window.changePage = changePage;
