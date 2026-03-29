// ============================================================
// dashboard.js — Cards de estatísticas e gráficos Chart.js
// ============================================================

import { visits, chartService, chartMonth, setChartService, setChartMonth } from "./state.js";
import { today } from "./utils.js";

const CHART_COLORS = ["#3498db","#2ecc71","#f1c40f","#e74c3c","#9b59b6","#1abc9c","#e67e22"];

/* =========================
   DASHBOARD PRINCIPAL
========================= */
export function renderDashboard() {
  const total      = visits.length;
  const thisMonth  = visits.filter((v) => v.date?.slice(0, 7) === today().slice(0, 7)).length;
  const todayCount = visits.filter((v) => v.date === today()).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-month").textContent = thisMonth;
  document.getElementById("stat-today").textContent = todayCount;

  const sectorCounts = {};
  visits.forEach((v) => {
    if (!v.sector) return;
    sectorCounts[v.sector] = (sectorCounts[v.sector] || 0) + 1;
  });

  const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  document.getElementById("stat-top-service").textContent = topSector;

  renderServiceChart(sectorCounts);
  renderMonthChart();
}

/* =========================
   GRÁFICO DE SETORES
========================= */
function renderServiceChart(counts) {
  const canvas = document.getElementById("chart-service");
  if (!canvas) return;

  const labels = Object.keys(counts).length ? Object.keys(counts) : ["Sem dados"];
  const data   = Object.values(counts).length ? Object.values(counts) : [1];

  if (chartService) chartService.destroy();

  const novo = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: CHART_COLORS.slice(0, labels.length), borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
  setChartService(novo);
}

/* =========================
   GRÁFICO POR MÊS
========================= */
function renderMonthChart() {
  const canvas = document.getElementById("chart-month");
  if (!canvas) return;

  const monthMap = {};
  visits.forEach((v) => {
    if (!v.date) return;
    const ym = v.date.slice(0, 7);
    monthMap[ym] = (monthMap[ym] || 0) + 1;
  });

  const sorted = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const labels = sorted.map(([ym]) => ym);
  const data   = sorted.map(([, v]) => v);

  if (chartMonth) chartMonth.destroy();

  const novo = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ data, backgroundColor: "#2D5A3D", borderRadius: 6 }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
  setChartMonth(novo);
}
