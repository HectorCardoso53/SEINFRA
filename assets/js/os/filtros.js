// ============================================================
// filtros.js — Filtros, tabelas de relatórios e paginação
// ============================================================

import { buscarTodasOrdens, buscarOrdensPaginadas } from "../firestore.js";
import { mostrarAlerta } from "./ui.js";
import { normalizarTexto, formatarData } from "./utils.js";
import {
  ordens,
  carregando,
  paginaAtual,
  historicoDocs,
  setOrdens,
  setCarregando,
  setPaginaAtual,
  setHistoricoDocs,
} from "./state.js";

let cacheOrdens = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000;

// variável para guardar lista completa sem filtro
let _listaMateriais = [];

/* =========================
   RELATÓRIO DE MATERIAIS
========================= */
export async function gerarRelatorioMateriais() {
  const mesSelect = document.getElementById("materiais-mes");
  const anoSelect = document.getElementById("materiais-ano");

  if (!mesSelect || !anoSelect) return;

  const mes = Number(mesSelect.value);
  const ano = Number(anoSelect.value);

  if (isNaN(mes) || isNaN(ano)) {
    mostrarAlerta("Selecione o mês e o ano.", "Atenção");
    return;
  }

  const ordensAtuais = await getOrdensCached();

  let materiaisSomados = {};
  let quantidadeTotal = 0;

  ordensAtuais.forEach((ordem) => {
    if (!ordem.dataAbertura) return;
    const data = parsearData(ordem.dataAbertura);
    if (!data || isNaN(data)) return;
    if (data.getMonth() === mes && data.getFullYear() === ano) {
      if (!ordem.materiais || ordem.materiais.length === 0) return;
      ordem.materiais.forEach((mat) => {
        const chave = mat.nome + "_" + mat.unidade;
        if (!materiaisSomados[chave]) {
          materiaisSomados[chave] = {
            nome: mat.nome,
            unidade: mat.unidade,
            quantidade: 0,
            numeroOS: [],
            tiposOS: [],
            detalhesOS: [], // 👈 guarda número + data + hora
          };
        }
        const qtd = Number(mat.quantidade || 0);
        materiaisSomados[chave].quantidade += qtd;

        const numOS = ordem.numero || ordem.id;
        const dataHora = ordem.dataAbertura
          ? new Date(ordem.dataAbertura).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";

        // guarda detalhes únicos por OS
        const jaExiste = materiaisSomados[chave].detalhesOS.some(
          (d) => d.numero === numOS,
        );
        if (!jaExiste) {
          materiaisSomados[chave].detalhesOS.push({
            numero: numOS,
            dataHora,
          });
        }

        if (!materiaisSomados[chave].numeroOS.includes(numOS)) {
          materiaisSomados[chave].numeroOS.push(numOS);
        }

        const tipoOS = (ordem.tipoOS || "").toLowerCase();
        if (tipoOS && !materiaisSomados[chave].tiposOS.includes(tipoOS)) {
          materiaisSomados[chave].tiposOS.push(tipoOS);
        }

        quantidadeTotal += qtd;
      });
    }
  });

  _listaMateriais = Object.values(materiaisSomados);

  // limpa filtros ao trocar mês/ano
  const filtroNome = document.getElementById("filtro-material-nome");
  const filtroTipo = document.getElementById("filtro-material-tipo");
  if (filtroNome) filtroNome.value = "";
  if (filtroTipo) filtroTipo.value = "";

  document.getElementById("total-materiais-mes").textContent =
    _listaMateriais.length;
  document.getElementById("total-quantidade-mes").textContent = quantidadeTotal;
  renderTabelaMateriaisMes(_listaMateriais);
}

export function filtrarTabelaMateriais() {
  const busca = (document.getElementById("filtro-material-nome")?.value || "")
    .toLowerCase()
    .trim();
  const tipo = document.getElementById("filtro-material-tipo")?.value || "";

  const listaFiltrada = _listaMateriais.filter((m) => {
    const matchNome = !busca || m.nome.toLowerCase().includes(busca);
    const matchTipo = !tipo || m.tiposOS.includes(tipo);
    return matchNome && matchTipo;
  });

  const totalQtd = listaFiltrada.reduce((acc, m) => acc + m.quantidade, 0);
  document.getElementById("total-materiais-mes").textContent =
    listaFiltrada.length;
  document.getElementById("total-quantidade-mes").textContent = totalQtd;

  renderTabelaMateriaisMes(listaFiltrada);
}

export async function getOrdensCached() {
  const agora = Date.now();
  const cacheValido =
    cacheOrdens && cacheTimestamp && agora - cacheTimestamp < CACHE_TTL;
  if (cacheValido) return cacheOrdens;
  cacheOrdens = await buscarTodasOrdens();
  cacheTimestamp = agora;
  return cacheOrdens;
}

export function invalidarCache() {
  cacheOrdens = null;
  cacheTimestamp = null;
}

/* =========================
   DEBOUNCE
========================= */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* =========================
   FILTROS DINÂMICOS
========================= */
export function inicializarFiltrosDinamicos() {
  const camposTexto = [
    "filtro-numero-os",
    "filtro-solicitante",
    "filtro-servico",
    "filtro-data-inicio",
    "filtro-data-fim",
  ];

  const camposSelect = [
    "filtro-status",
    "filtro-diretoria",
    "filtro-setor-solicitante",
    "filtro-mes",
    "filtro-ano",
    "filtro-tipo-os",
  ];

  camposTexto.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      "input",
      debounce(() => aplicarFiltros(), 400),
    );
  });

  camposSelect.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => aplicarFiltros());
  });
}

export function limparFiltros() {
  const ids = [
    "filtro-numero-os",
    "filtro-solicitante",
    "filtro-servico",
    "filtro-data-inicio",
    "filtro-data-fim",
    "filtro-status",
    "filtro-diretoria",
    "filtro-setor-solicitante",
    "filtro-mes",
    "filtro-ano",
    "filtro-tipo-os",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const paginacao = document.querySelector(".paginacao");
  if (paginacao) paginacao.style.display = "flex";

  carregarPagina(1);
}

/* =========================
   PAGINAÇÃO
========================= */
export async function carregarPagina(pagina) {
  setCarregando(true);

  let docReferencia = null;
  if (pagina > 1) {
    docReferencia = historicoDocs[pagina - 2];
  }

  const resultado = await buscarOrdensPaginadas(docReferencia, 20);

  document.getElementById("pagina-info").innerText = `Página ${pagina}`;

  const novoHistorico = [...historicoDocs];
  novoHistorico[pagina - 1] = resultado.ultimoDocumento;
  setHistoricoDocs(novoHistorico);

  setOrdens(resultado.lista);
  carregarTabelaRelatorios(resultado.lista);
  setPaginaAtual(pagina);
  setCarregando(false);
}

export function proximaPagina() {
  if (carregando) return;
  carregarPagina(paginaAtual + 1);
}

export function paginaAnterior() {
  if (paginaAtual === 1 || carregando) return;
  carregarPagina(paginaAtual - 1);
}

/* =========================
   UTILITÁRIO DE DATA
========================= */
function parsearData(dataAbertura) {
  if (!dataAbertura) return null;

  if (dataAbertura?.toDate) return dataAbertura.toDate();

  if (typeof dataAbertura === "string") {
    const temFuso =
      dataAbertura.includes("Z") ||
      dataAbertura.includes("+") ||
      dataAbertura.includes("-", 10);
    if (!temFuso && dataAbertura.includes("T")) {
      return new Date(dataAbertura);
    }
    return new Date(dataAbertura);
  }

  return new Date(dataAbertura);
}

/* =========================
   FILTROS
========================= */
export async function aplicarFiltros() {
  const numeroOS =
    document.getElementById("filtro-numero-os")?.value?.trim() || "";
  const diretoria = document.getElementById("filtro-diretoria")?.value || "";
  const dataInicio = document.getElementById("filtro-data-inicio")?.value || "";
  const dataFim = document.getElementById("filtro-data-fim")?.value || "";
  const servico =
    document.getElementById("filtro-servico")?.value?.trim() || "";
  const mes = document.getElementById("filtro-mes")?.value ?? "";
  const ano = document.getElementById("filtro-ano")?.value || "";
  const status = document.getElementById("filtro-status")?.value || "";
  const solicitante =
    document.getElementById("filtro-solicitante")?.value?.trim() || "";
  const setorSolicitante =
    document.getElementById("filtro-setor-solicitante")?.value?.trim() || "";
  const tipoOS = document.getElementById("filtro-tipo-os")?.value || "";

  const dtInicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
  const dtFim = dataFim ? new Date(dataFim + "T23:59:59") : null;

  const baseDados = await getOrdensCached();

  const ordensFiltradas = baseDados.filter((o) => {
    if (!o) return false;

    // — Tipo de Ordem (interna/externa)
    if (tipoOS && (o.tipoOS || "").toLowerCase() !== tipoOS) return false;

    // — Número da OS (busca parcial)
    if (numeroOS) {
      const num = normalizarTexto(o.numero || "");
      if (!num.includes(normalizarTexto(numeroOS))) return false;
    }

    // — Serviço
    if (servico) {
      const desc = normalizarTexto(o.descricaoServico || "");
      if (!desc.includes(normalizarTexto(servico))) return false;
    }

    // — Parse da data da OS
    const data = parsearData(o.dataAbertura);
    if (!data || isNaN(data)) return false;

    // — Intervalo de datas
    if (dtInicio && data < dtInicio) return false;
    if (dtFim && data > dtFim) return false;

    // — Mês (0-11)
    if (mes !== "" && data.getMonth() !== Number(mes)) return false;

    // — Ano
    if (ano !== "" && data.getFullYear() !== Number(ano)) return false;

    // — Status
    if (status && o.status !== status) return false;

    // — Solicitante
    if (solicitante) {
      const nome = normalizarTexto(o.nomeSolicitante || "");
      if (!nome.includes(normalizarTexto(solicitante))) return false;
    }

    // — Setor solicitante
    if (setorSolicitante) {
      if (setorSolicitante === "__nao_informado__") {
        // Filtra apenas OS sem setor (antigas sem preenchimento)
        const valor = normalizarTexto(o.setorSolicitante || "")
          .replace(/^setor\s+/i, "")
          .trim();
        if (valor !== "") return false;
      } else {
        // Remove prefixo "SETOR " dos dois lados antes de comparar
        const filtro = normalizarTexto(setorSolicitante)
          .replace(/^setor\s+/i, "")
          .trim();
        const valor = normalizarTexto(o.setorSolicitante || "")
          .replace(/^setor\s+/i, "")
          .trim();
        if (!valor.includes(filtro)) return false;
      }
    }

    // — Diretoria responsável
    if (diretoria && o.setorResponsavel !== diretoria) return false;

    return true;
  });

  ordensFiltradas.sort(
    (a, b) => (b.numeroSequencial || 0) - (a.numeroSequencial || 0),
  );

  const temFiltro =
    dataInicio ||
    dataFim ||
    mes !== "" ||
    ano !== "" ||
    status ||
    diretoria ||
    solicitante ||
    setorSolicitante ||
    servico ||
    numeroOS ||
    tipoOS;

  const paginacao = document.querySelector(".paginacao");
  if (paginacao) paginacao.style.display = temFiltro ? "none" : "block";

  carregarTabelaRelatorios(ordensFiltradas);
}

/* =========================
   TABELAS
========================= */
export function carregarTabelaRelatorios(ordensParaExibir) {
  const tbody = document.getElementById("tabela-relatorios");
  const upper = (valor) => (valor || "-").toString().toUpperCase();

  if (!ordensParaExibir || ordensParaExibir.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <h3>NENHUMA ORDEM ENCONTRADA</h3>
          <p>TENTE AJUSTAR OS FILTROS</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = ordensParaExibir
    .map((ordem) => {
      const statusClasse = ordem.status
        ? ordem.status.toLowerCase().replace(/\s/g, "-")
        : "aberta";

      const tipo = (ordem.tipoOS || "").toLowerCase();
      const tipoBg =
        tipo === "interna"
          ? "#ede7f6"
          : tipo === "externa"
            ? "#e0f7fa"
            : "#f5f5f5";
      const tipoColor =
        tipo === "interna"
          ? "#6a1b9a"
          : tipo === "externa"
            ? "#00838f"
            : "#999";
      const tipoLabel = tipo ? tipo.toUpperCase() : "N/I";

      // Setor: OS antigas sem setor mostram "NÃO INFORMADO"
      const setor = (ordem.setorSolicitante || "").trim();
      const setorLabel = setor ? upper(setor) : "NÃO INFORMADO";
      const setorStyle = setor
        ? ""
        : "color:#999; font-style:italic; font-size:11px;";

      return `
        <tr>
          <td>
            ${upper(ordem.numero)}
            <br>
            <span style="font-size:11px; font-weight:600; padding:2px 7px; border-radius:10px;
              background:${tipoBg}; color:${tipoColor};">
              ${tipoLabel}
            </span>
          </td>
          <td>${ordem.dataAbertura ? formatarData(ordem.dataAbertura) : "-"}</td>
          <td>
            <span class="status-badge status-${statusClasse}">
              ${upper(ordem.status)}
            </span>
          </td>
          <td>${upper(ordem.nomeSolicitante)}</td>
          <td style="${setorStyle}">${setorLabel}</td>
          <td>${upper(ordem.descricaoServico).substring(0, 40)}...</td>
          <td class="acoes">
            <button class="btn btn-primary btn-icon" onclick="visualizarOS('${ordem.id}')" title="Visualizar">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-secondary btn-icon" onclick="editarOS('${ordem.id}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-danger btn-icon" onclick="excluirOS('${ordem.id}')" title="Excluir">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderTabelaMateriaisMes(lista) {
  const tbody = document.getElementById("tabela-materiais-mes");
  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">Nenhum material utilizado neste período</td>
      </tr>`;
    return;
  }
  tbody.innerHTML = lista
    .map((m) => `
      <tr>
        <td>${m.nome}</td>
        <td>${m.quantidade}</td>
        <td>${m.unidade}</td>
        <td style="font-size: 11px; line-height: 1.9;">
          ${(m.detalhesOS || m.numeroOS.map(n => ({ numero: n, dataHora: "-" })))
            .map(d => `<span style="display:block;">
              <strong>${d.numero}</strong>
              <span style="color:#7f8c8d; font-size:10px;"> — ${d.dataHora}</span>
            </span>`)
            .join("")}
        </td>
      </tr>
    `)
    .join("");
}

/* =========================
   SELECTS DE ANO/MÊS
========================= */
export function carregarFiltroAno() {
  const select = document.getElementById("filtro-ano");
  if (!select) return;
  const anoAtual = new Date().getFullYear();
  select.innerHTML = '<option value="">Todos</option>';
  for (let ano = anoAtual; ano >= 2026; ano--) {
    const opt = document.createElement("option");
    opt.value = ano;
    opt.textContent = ano;
    select.appendChild(opt);
  }
}

export function carregarAnoMateriais() {
  const select = document.getElementById("materiais-ano");
  if (!select) return;
  const anoAtual = new Date().getFullYear();
  select.innerHTML = "";
  for (let i = anoAtual; i >= 2026; i--) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    if (i === anoAtual) opt.selected = true;
    select.appendChild(opt);
  }

  const mesSelect = document.getElementById("materiais-mes");
  if (mesSelect) {
    mesSelect.value = new Date().getMonth();
  }
}

export function carregarSetoresFiltro(diretoriaSelecionada) {
  import("./utils.js").then(({ normalizarTexto, setoresPorDiretoria }) => {
    const select = document.getElementById("filtro-setor-solicitante");
    if (!select) return;
    const diretoria = normalizarTexto(diretoriaSelecionada);
    const setores = setoresPorDiretoria[diretoria] || [];
    select.innerHTML = '<option value="">Todos</option>';

    // Opção para OS antigas sem setor definido
    const optNI = document.createElement("option");
    optNI.value = "__nao_informado__";
    optNI.textContent = "NÃO INFORMADO";
    optNI.style.color = "#999";
    optNI.style.fontStyle = "italic";
    select.appendChild(optNI);

    setores.forEach((setor) => {
      const opt = document.createElement("option");
      opt.value = setor;
      opt.textContent = setor;
      select.appendChild(opt);
    });
  });
}
