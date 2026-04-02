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
   Converte qualquer formato de data para objeto Date corretamente
========================= */
function parsearData(dataAbertura) {
  if (!dataAbertura) return null;

  // Timestamp do Firestore
  if (dataAbertura?.toDate) return dataAbertura.toDate();

  // String ISO com hora: "2026-03-16T17:36" ou "2026-03-16T17:36:00"
  if (typeof dataAbertura === "string") {
    // Garante que a comparação seja feita sem ajuste de fuso
    // Adiciona 'Z' apenas se não tiver timezone informado
    const temFuso = dataAbertura.includes("Z") || dataAbertura.includes("+") || dataAbertura.includes("-", 10);
    if (!temFuso && dataAbertura.includes("T")) {
      // Trata como horário local (não UTC)
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
  const diretoria   = document.getElementById("filtro-diretoria")?.value || "";
  const dataInicio  = document.getElementById("filtro-data-inicio")?.value || "";
  const dataFim     = document.getElementById("filtro-data-fim")?.value || "";
  const servico     = document.getElementById("filtro-servico")?.value?.trim() || "";
  const mes         = document.getElementById("filtro-mes")?.value ?? "";
  const ano         = document.getElementById("filtro-ano")?.value || "";
  const status      = document.getElementById("filtro-status")?.value || "";
  const solicitante = document.getElementById("filtro-solicitante")?.value?.trim() || "";
  const setorSolicitante = document.getElementById("filtro-setor-solicitante")?.value?.trim() || "";

  // Monta os limites de data UMA VEZ para não recriar a cada item
  const dtInicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
  const dtFim    = dataFim    ? new Date(dataFim    + "T23:59:59") : null;

  // Busca TODAS as ordens sem limite
  const baseDados = await buscarTodasOrdens();

  const ordensFiltradas = baseDados.filter((o) => {
    if (!o) return false;

    // — Serviço (busca no texto, uppercase dos dois lados)
    if (servico) {
      const desc = normalizarTexto(o.descricaoServico || "");
      if (!desc.includes(normalizarTexto(servico))) return false;
    }

    // — Parse da data da OS
    const data = parsearData(o.dataAbertura);
    if (!data || isNaN(data)) return false;

    // — Intervalo de datas
    if (dtInicio && data < dtInicio) return false;
    if (dtFim    && data > dtFim)    return false;

    // — Mês (0-11)
    if (mes !== "" && data.getMonth() !== Number(mes)) return false;

    // — Ano
    if (ano !== "" && data.getFullYear() !== Number(ano)) return false;

    // — Status
    if (status && o.status !== status) return false;

    // — Solicitante (nome parcial, case insensitive)
    if (solicitante) {
      const nome = normalizarTexto(o.nomeSolicitante || "");
      if (!nome.includes(normalizarTexto(solicitante))) return false;
    }

    // — Setor solicitante
    if (setorSolicitante) {
      const filtro = normalizarTexto(setorSolicitante).replace(/^SETOR\s+/i, "");
      const valor  = normalizarTexto(o.setorSolicitante || "");
      if (!valor.includes(filtro)) return false;
    }

    // — Diretoria responsável
    if (diretoria && o.setorResponsavel !== diretoria) return false;

    return true;
  });

  ordensFiltradas.sort((a, b) => (b.numeroSequencial || 0) - (a.numeroSequencial || 0));

  // Esconde paginação quando há filtro ativo
  const temFiltro = dataInicio || dataFim || mes !== "" || ano !== "" ||
                    status || diretoria || solicitante || setorSolicitante || servico;
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
      return `
        <tr>
          <td>${upper(ordem.numero)}</td>
          <td>${ordem.dataAbertura ? formatarData(ordem.dataAbertura) : "-"}</td>
          <td>
            <span class="status-badge status-${statusClasse}">
              ${upper(ordem.status)}
            </span>
          </td>
          <td>${upper(ordem.nomeSolicitante)}</td>
          <td>${upper(ordem.setorSolicitante)}</td>
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
        <td>${m.os}</td>
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
}

export function carregarSetoresFiltro(diretoriaSelecionada) {
  import("./utils.js").then(({ normalizarTexto, setoresPorDiretoria }) => {
    const select = document.getElementById("filtro-setor-solicitante");
    if (!select) return;
    const diretoria = normalizarTexto(diretoriaSelecionada);
    const setores = setoresPorDiretoria[diretoria] || [];
    select.innerHTML = '<option value="">Todos</option>';
    setores.forEach((setor) => {
      const opt = document.createElement("option");
      opt.value = setor;
      opt.textContent = setor;
      select.appendChild(opt);
    });
  });
}

/* =========================
   RELATÓRIO DE MATERIAIS
========================= */
export function gerarRelatorioMateriais(ordensAtuais) {
  const mesSelect = document.getElementById("materiais-mes");
  const anoSelect = document.getElementById("materiais-ano");

  if (!mesSelect || !anoSelect) {
    console.error("Campos de mês ou ano não encontrados.");
    return;
  }

  const mes = Number(mesSelect.value);
  const ano = Number(anoSelect.value);

  if (isNaN(mes) || isNaN(ano)) {
    mostrarAlerta("Selecione o mês e o ano para gerar o relatório.", "Atenção");
    return;
  }

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
          materiaisSomados[chave] = { nome: mat.nome, unidade: mat.unidade, quantidade: 0, os: 0 };
        }
        const qtd = Number(mat.quantidade || 0);
        materiaisSomados[chave].quantidade += qtd;
        materiaisSomados[chave].os += 1;
        quantidadeTotal += qtd;
      });
    }
  });

  const lista = Object.values(materiaisSomados);
  document.getElementById("total-materiais-mes").textContent = lista.length;
  document.getElementById("total-quantidade-mes").textContent = quantidadeTotal;
  renderTabelaMateriaisMes(lista);
}