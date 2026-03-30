// ============================================================
// dashboard.js — Dashboard simplificado (cadastro de visitantes)
// ============================================================

import {
  visits,
  chartService,
  chartMonth,
  setChartService,
  setChartMonth,
} from "./state.js";

import { today } from "./utils.js";

const CHART_COLORS = [
  "#3498db",
  "#2ecc71",
  "#f1c40f",
  "#e74c3c",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
];

/* =========================
   DASHBOARD PRINCIPAL
========================= */
export function renderDashboard() {
  const total = visits.length;

  const thisMonth = visits.filter(
    (v) => v.date?.slice(0, 7) === today().slice(0, 7)
  ).length;

  const todayCount = visits.filter((v) => v.date === today()).length;

  // Estatísticas principais
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-month").textContent = thisMonth;
  document.getElementById("stat-today").textContent = todayCount;

  // =========================
  // ENDEREÇO MAIS FREQUENTE
  // =========================
  const addressCount = {};

  visits.forEach((v) => {
    const addr = v.address || "Não informado";
    addressCount[addr] = (addressCount[addr] || 0) + 1;
  });

  const topAddress =
    Object.entries(addressCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const topEl = document.getElementById("stat-top-service");
  if (topEl) topEl.textContent = topAddress;

  // =========================
  // GRÁFICOS
  // =========================
  renderAddressChart(addressCount);
  renderMonthChart();
}

/* =========================
   GRÁFICO POR ENDEREÇO
========================= */
function renderAddressChart(counts) {
  const canvas = document.getElementById("chart-service");
  if (!canvas) return;

  // pega top 6 para não poluir
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const labels = entries.length ? entries.map(([k]) => k) : ["Sem dados"];
  const data = entries.length ? entries.map(([, v]) => v) : [1];

  if (chartService) chartService.destroy();

  const chart = new Chart(canvas.getContext("2d"), {
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

  setChartService(chart);
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

  const sorted = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);

  const labels = sorted.map(([ym]) => ym);
  const data = sorted.map(([, v]) => v);

  if (chartMonth) chartMonth.destroy();

  const chart = new Chart(canvas.getContext("2d"), {
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

  setChartMonth(chart);
}