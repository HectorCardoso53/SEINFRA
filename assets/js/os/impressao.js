// ============================================================
// impressao.js — Geração de PDF e visualização para impressão
// ============================================================

import { buscarTodasOrdens } from "../firestore.js";
import {
  formatarData,
  formatarDataCompleta,
  normalizarTexto,
} from "./utils.js";
import { osAtual } from "./state.js";
import { mostrarAlerta } from "./ui.js";
// impressao.js — no topo, adiciona a importação
import { getOrdensCached } from "./filtros.js"; // só funciona se você exportar a função

/* =========================
   ESTILOS BASE COMPARTILHADOS
========================= */
const cssBase = `
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial; font-size: 10px; line-height: 1.4; }
.folha { display: flex; flex-direction: column; gap: 0; }
.os-bloco { border: 1px solid #000; padding: 8px 10px; }
.header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px; }
.header img { width: 32px; }
.header-text h1 { font-size: 12px; margin: 0; }
.header-text p { font-size: 9px; margin: 0; }
.titulo { text-align: center; font-size: 11px; font-weight: bold; margin: 5px 0 7px 0; }
.secao { margin-bottom: 6px; }
.secao h3 { font-size: 9px; font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 4px; padding-bottom: 1px; }
.secao div { margin-bottom: 2px; word-break: break-word; }
.assinaturas { display: flex; justify-content: space-around; margin-top: 12px; gap: 16px; }
.assinatura-box { flex: 1; text-align: center; font-size: 9px; }
.linha { border-top: 1px solid #000; margin-bottom: 3px; margin-top: 22px; }
.linha-corte { border-top: 2px dashed #000; margin: 6px 0; }
.footer { margin-top: 5px; font-size: 8px; text-align: right; color: #555; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #000; padding: 2px 4px; font-size: 9px; }
th { background: #f2f2f2; }
`;

function abrirJanelaPrint(htmlCompleto) {
  const w = window.open("", "_blank");
  w.document.write(htmlCompleto);
  w.document.close();
}

function wrapHTML(title, body, css = cssBase) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title><style>${css}</style></head><body>${body}<script>window.onload=function(){window.print()}<\/script></body></html>`;
}

function headerPrefeitura(imgWidth = "40px") {
  return `
<div class="header">
  <img src="assets/img/prefeitura.png" style="width:${imgWidth}">
  <div class="header-text">
    <h1>Prefeitura Municipal de Oriximiná</h1>
    <p>Secretaria de Infraestrutura – SEINFRA</p>
  </div>
</div>`;
}

function assinaturasHTML(tipoOS) {
  const boxes =
    tipoOS === "externa"
      ? ["Secretária", "Responsável", "Requerente"]
      : ["Secretária", "Responsável"];
  return `
<div class="assinaturas">
  ${boxes
    .map(
      (label) => `
    <div class="assinatura-box">
      <div class="linha"></div>
      ${label}
    </div>`,
    )
    .join("")}
</div>`;
}

function conteudoOSHTML(dados) {
  const {
    numero,
    status,
    dataAbertura,
    dataEncerramento,
    tipoOS,
    nomeSolicitante,
    cpf,
    telefone,
    telefone2,
    setorSolicitante,
    setorResponsavel,
    execucao,
    abertura,
    local,
    pontoReferencia,
    descricao,
    assinaturaChefia,
    assinaturaRecebedor,
  } = dados;

  const tipo = (tipoOS || "").toLowerCase();
  const tipoTitulo =
    tipo === "externa" ? "EXTERNA" : tipo === "interna" ? "INTERNA" : "";
  const dataEmissao = new Date().toLocaleString("pt-BR");

  return `
${headerPrefeitura()}
<div class="titulo">ORDEM DE SERVIÇO ${tipoTitulo}</div>

<div class="secao">
  <h3>Informações Gerais</h3>
  <div><strong>Número:</strong> ${numero || "-"}</div>
  <div><strong>Status:</strong> ${status || "Aberta"}</div>
  <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(dataAbertura)}</div>
  <div><strong>Data de Encerramento:</strong> ${dataEncerramento ? formatarDataCompleta(dataEncerramento) : "-"}</div>
</div>

<div class="secao">
  <h3>Solicitante</h3>
  <div><strong>Nome:</strong> ${nomeSolicitante || "-"}</div>
  <div><strong>CPF:</strong> ${cpf || "-"}</div>
  <div><strong>Telefone 1:</strong> ${telefone || "-"} &nbsp;&nbsp; ${telefone2 ? `<strong>Telefone 2:</strong> ${telefone2}` : ""}</div>
  ${tipo !== "externa" ? `<div><strong>Setor:</strong> ${setorSolicitante || "-"}</div>` : ""}
  <div><strong>Diretoria Responsável:</strong> ${setorResponsavel || "-"}</div>
</div>

<div class="secao">
  <h3>Execução</h3>
  <div><strong>Responsável pela Execução:</strong> ${execucao || "-"}</div>
  <div><strong>Responsável pela Abertura:</strong> ${abertura || "-"}</div>
  <div><strong>Local do Serviço:</strong> ${local || "-"}</div>
  <div><strong>Ponto de Referência:</strong> ${pontoReferencia || "-"}</div>
</div>

<div class="secao">
  <h3>Descrição do Serviço</h3>
  <div style="line-height:1.6;">${descricao || "-"}</div>
</div>

<div class="secao">
  <h3>Encerramento</h3>
  ${assinaturaChefia ? `<div><strong>Responsável:</strong> ${assinaturaChefia}</div>` : ""}
  ${assinaturaRecebedor ? `<div><strong>Recebedor:</strong> ${assinaturaRecebedor}</div>` : ""}
  ${assinaturasHTML(tipo)}
</div>

<div class="footer">Documento gerado em: ${dataEmissao}</div>`;
}

/* =========================
   PRÉ-VISUALIZAR OS (formulário)
========================= */
export function previsualizarOS() {
  const dados = {
    tipoOS: document.getElementById("tipo-os").value,
    numero: document.getElementById("numero-os").value,
    dataAbertura: document.getElementById("data-abertura").value,
    nomeSolicitante: document.getElementById("nome-solicitante").value,
    cpf: document.getElementById("cpf-solicitante")?.value || "-",
    telefone: document.getElementById("telefone-solicitante")?.value || "-",
    telefone2: document.getElementById("telefone-solicitante2")?.value || "",
    setorSolicitante: document.getElementById("setor-solicitante").value,
    setorResponsavel: document.getElementById("setor-responsavel").value,
    descricao: document.getElementById("descricao-servico").value,
    local: document.getElementById("local-servico").value,
    pontoReferencia: document.getElementById("ponto-referencia")?.value || "-",
    execucao: document.getElementById("responsavel-execucao")?.value || "-",
    abertura: document.getElementById("responsavel-abertura").value,
    status: "Aberta",
    dataEncerramento: null,
    assinaturaChefia: null,
    assinaturaRecebedor: null,
  };

  const bloco = conteudoOSHTML(dados);
  const body = `<div class="folha"><div class="os-bloco">${bloco}<div class="linha"><span class="label">Telefone 1:</span> ${dados.telefone || "-"}</div>
${dados.telefone2 ? `<div class="linha"><span class="label">Telefone 2:</span> ${dados.telefone2}</div>` : ""}`;
  abrirJanelaPrint(wrapHTML("Pré-visualização OS", body));
}

/* =========================
   IMPRIMIR DETALHES OS
========================= */
export function imprimirDetalhesOS() {
  if (!osAtual) return;

  const temMateriais = osAtual.materiais && osAtual.materiais.length > 0;
  const materiaisHTML = temMateriais
    ? osAtual.materiais
        .map(
          (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome}</td>
          <td>${m.quantidade || "-"}</td>
          <td>${m.unidade}</td>
        </tr>`,
        )
        .join("")
    : "";

  const dados = {
    tipoOS: osAtual.tipoOS,
    numero: osAtual.numero,
    status: osAtual.status,
    dataAbertura: osAtual.dataAbertura,
    dataEncerramento: osAtual.dataEncerramento,
    nomeSolicitante: osAtual.nomeSolicitante,
    cpf: osAtual.cpfSolicitante,
    telefone: osAtual.telefoneSolicitante,
    telefone2: osAtual.telefone2 || "",
    setorSolicitante: osAtual.setorSolicitante,
    setorResponsavel: osAtual.setorResponsavel,
    execucao: osAtual.responsavelExecucao,
    abertura: osAtual.responsavelAbertura,
    local: osAtual.localServico,
    pontoReferencia: osAtual.pontoReferencia,
    descricao: osAtual.descricaoServico,
    assinaturaChefia: osAtual.assinaturaChefia,
    assinaturaRecebedor: osAtual.assinaturaRecebedor,
  };

  let bloco = conteudoOSHTML(dados);

  if (temMateriais) {
    bloco += `
<div class="secao" style="margin-top:6px;">
  <h3>Materiais Utilizados</h3>
  <table>
    <thead><tr><th>#</th><th>Material</th><th>Quantidade</th><th>Unidade</th></tr></thead>
    <tbody>${materiaisHTML}</tbody>
  </table>
</div>`;
  }

  // Duas vias por página — cada bloco ocupa metade do A4
  const body = `
<div class="folha">
  <div class="os-bloco">${bloco}</div>
  <div class="linha-corte"></div>
  <div class="os-bloco">${bloco}</div>
</div>`;

  abrirJanelaPrint(wrapHTML(`Ordem de Serviço - ${osAtual.numero}`, body));
}

export function gerarPDFMateriais() {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map(
      (m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${m.nome}</td>
        <td>${m.quantidade || "-"}</td>
        <td>${m.unidade}</td>
      </tr>`,
    )
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const body = `
${headerPrefeitura("50px")}
<div class="titulo">RELAÇÃO DE MATERIAIS SOLICITADOS</div>

<div style="margin-bottom:12px; font-size:11px; line-height:1.8; border:1px solid #ccc; padding:8px 10px; border-radius:4px;">
  <div style="font-weight:bold; font-size:12px; border-bottom:1px solid #ccc; margin-bottom:6px; padding-bottom:4px;">
    Informações da Ordem de Serviço
  </div>
  <div><strong>Número da OS:</strong> ${osAtual.numero || "-"}</div>
  <div><strong>Status:</strong> ${osAtual.status || "-"}</div>
  <div><strong>Tipo:</strong> ${osAtual.tipoOS ? osAtual.tipoOS.toUpperCase() : "-"}</div>
  <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
  <div><strong>Data de Encerramento:</strong> ${osAtual.dataEncerramento ? formatarDataCompleta(osAtual.dataEncerramento) : "Não encerrada"}</div>
</div>

<div style="margin-bottom:12px; font-size:11px; line-height:1.8; border:1px solid #ccc; padding:8px 10px; border-radius:4px;">
  <div style="font-weight:bold; font-size:12px; border-bottom:1px solid #ccc; margin-bottom:6px; padding-bottom:4px;">
    Solicitante
  </div>
  <div><strong>Nome:</strong> ${osAtual.nomeSolicitante || "-"}</div>
  <div><strong>CPF:</strong> ${osAtual.cpfSolicitante || "-"}</div>
  <div><strong>Telefone:</strong> ${osAtual.telefoneSolicitante || "-"}</div>
  <div><strong>Setor:</strong> ${osAtual.setorSolicitante || "-"}</div>
  <div><strong>Diretoria Responsável:</strong> ${osAtual.setorResponsavel || "-"}</div>
</div>

<div style="margin-bottom:12px; font-size:11px; line-height:1.8; border:1px solid #ccc; padding:8px 10px; border-radius:4px;">
  <div style="font-weight:bold; font-size:12px; border-bottom:1px solid #ccc; margin-bottom:6px; padding-bottom:4px;">
    Execução
  </div>
  <div><strong>Responsável pela Execução:</strong> ${osAtual.responsavelExecucao || "-"}</div>
  <div><strong>Responsável pela Abertura:</strong> ${osAtual.responsavelAbertura || "-"}</div>
  <div><strong>Local do Serviço:</strong> ${osAtual.localServico || "-"}</div>
  <div><strong>Ponto de Referência:</strong> ${osAtual.pontoReferencia || "-"}</div>
  <div><strong>Descrição do Serviço:</strong> ${osAtual.descricaoServico || "-"}</div>
</div>

<div style="margin-bottom:12px; font-size:11px; line-height:1.8; border:1px solid #ccc; padding:8px 10px; border-radius:4px;">
  <div style="font-weight:bold; font-size:12px; border-bottom:1px solid #ccc; margin-bottom:6px; padding-bottom:4px;">
    Materiais Utilizados
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Material</th>
        <th>Quantidade</th>
        <th>Unidade</th>
      </tr>
    </thead>
    <tbody>${lista}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right; font-weight:bold; background:#f2f2f2; padding:4px 6px;">
          Total de itens: ${osAtual.materiais.length}
        </td>
      </tr>
    </tfoot>
  </table>
</div>

${
  osAtual.assinaturaChefia || osAtual.assinaturaRecebedor
    ? `
<div style="margin-bottom:12px; font-size:11px; line-height:1.8; border:1px solid #ccc; padding:8px 10px; border-radius:4px;">
  <div style="font-weight:bold; font-size:12px; border-bottom:1px solid #ccc; margin-bottom:6px; padding-bottom:4px;">
    Encerramento
  </div>
  ${osAtual.assinaturaChefia ? `<div><strong>Responsável:</strong> ${osAtual.assinaturaChefia}</div>` : ""}
  ${osAtual.assinaturaRecebedor ? `<div><strong>Recebedor:</strong> ${osAtual.assinaturaRecebedor}</div>` : ""}
</div>`
    : ""
}

<div class="footer">Documento gerado em: ${dataEmissao}</div>`;

  abrirJanelaPrint(wrapHTML(`Materiais - ${osAtual.numero}`, body));
}

/* =========================
   EXPORTAR MATERIAIS OS
========================= */
export function exportarMateriaisOS() {
  gerarPDFMateriais();
}

/* =========================
   IMPRIMIR MATERIAIS DO MÊS
========================= */
export function imprimirMateriaisMes() {
  const linhas = document.querySelectorAll("#tabela-materiais-mes tr");
  if (!linhas.length) {
    mostrarAlerta("Nenhum material para imprimir.", "Atenção");
    return;
  }

  // Pega o mês e ano selecionados para exibir no cabeçalho
  const mesSelect = document.getElementById("materiais-mes");
  const anoSelect = document.getElementById("materiais-ano");
  const nomeMes = mesSelect?.options[mesSelect.selectedIndex]?.text || "";
  const ano = anoSelect?.value || "";

  // Lê os dados diretamente da tabela renderizada (inclui coluna OS)
  let conteudoTabela = "";
  let totalItens = 0;
  let totalQuantidade = 0;

  linhas.forEach((linha) => {
    const colunas = linha.querySelectorAll("td");
    if (colunas.length >= 4) {
      const qtd = parseFloat(colunas[1].innerText) || 0;
      totalQuantidade += qtd;
      totalItens++;
      conteudoTabela += `
        <tr>
          <td>${colunas[0].innerText}</td>
          <td style="text-align:center;">${colunas[1].innerText}</td>
          <td style="text-align:center;">${colunas[2].innerText}</td>
          <td style="font-size:8px; line-height:1.6;">${colunas[3].innerText}</td>
        </tr>`;
    }
  });

  if (!conteudoTabela) {
    mostrarAlerta("Nenhum material para imprimir.", "Atenção");
    return;
  }

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const body = `
${headerPrefeitura("50px")}
<div class="titulo">RELATÓRIO DE MATERIAIS UTILIZADOS</div>
<div style="text-align:center; font-size:9px; margin-bottom:8px; color:#555;">
  Período: ${nomeMes} / ${ano}
</div>

<!-- Resumo -->
<table style="margin-bottom:10px; border:1px solid #ccc;">
  <thead>
    <tr>
      <th style="text-align:center;">Tipos de Materiais</th>
      <th style="text-align:center;">Quantidade Total Utilizada</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:center; font-weight:bold;">${totalItens}</td>
      <td style="text-align:center; font-weight:bold;">${totalQuantidade}</td>
    </tr>
  </tbody>
</table>

<!-- Tabela principal -->
<table>
  <thead>
    <tr>
      <th>Material</th>
      <th style="text-align:center;">Quantidade</th>
      <th style="text-align:center;">Unidade</th>
      <th>Ordens de Serviço / Data</th>
    </tr>
  </thead>
  <tbody>${conteudoTabela}</tbody>
  <tfoot>
    <tr>
      <td colspan="4" style="text-align:right; font-weight:bold; background:#f2f2f2; padding:4px 6px;">
        Total de tipos: ${totalItens} &nbsp;|&nbsp; Quantidade total: ${totalQuantidade}
      </td>
    </tr>
  </tfoot>
</table>

<div class="footer">Documento gerado em: ${dataEmissao}</div>`;

  abrirJanelaPrint(wrapHTML(`Materiais - ${nomeMes}/${ano}`, body));
}

/* =========================
   IMPRIMIR RELATÓRIO GERAL
========================= */
export async function imprimirRelatorio() {
  const dataEmissao = new Date().toLocaleString("pt-BR");
  const nomeUsuario = window._userName || "Não identificado";
  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const status = document.getElementById("filtro-status").value;
  const diretoria = document.getElementById("filtro-diretoria")?.value || "";
  const tipoOS = document.getElementById("filtro-tipo-os")?.value || "";
  const solicitante = document
    .getElementById("filtro-solicitante")
    .value.trim()
    .toLowerCase();
  const setorSolicitante = document
    .getElementById("filtro-setor-solicitante")
    ?.value.trim();

  if (!dataInicio && !dataFim) {
    alert("Selecione um período.");
    return;
  }

  let todasOrdens = await getOrdensCached();

  let ordensFiltradas = todasOrdens.filter((o) => {
    if (!o.dataAbertura) return false;
    const data = new Date(o.dataAbertura);
    if (dataInicio && data < new Date(dataInicio + "T00:00:00")) return false;
    if (dataFim && data > new Date(dataFim + "T23:59:59")) return false;
    if (status && o.status !== status) return false;
    if (tipoOS && (o.tipoOS || "").toLowerCase() !== tipoOS) return false;
    if (solicitante && !o.nomeSolicitante?.toLowerCase().includes(solicitante))
      return false;
    if (setorSolicitante) {
      if (setorSolicitante === "__nao_informado__") {
        const valor = normalizarTexto(o.setorSolicitante || "")
          .replace(/^setor\s+/i, "")
          .trim();
        if (valor !== "") return false;
      } else {
        const filtro = normalizarTexto(setorSolicitante)
          .replace(/^setor\s+/i, "")
          .trim();
        const valor = normalizarTexto(o.setorSolicitante || "")
          .replace(/^setor\s+/i, "")
          .trim();
        if (!valor.includes(filtro)) return false;
      }
    }
    if (diretoria && o.setorResponsavel !== diretoria) return false;
    return true;
  });

  if (ordensFiltradas.length >= 200) {
    alert("Muitos resultados. Refine o filtro.");
    return;
  }

  ordensFiltradas.sort(
    (a, b) => (b.numeroSequencial || 0) - (a.numeroSequencial || 0),
  );

  const totalAbertas = ordensFiltradas.filter(
    (o) => o.status === "Aberta",
  ).length;
  const totalAndamento = ordensFiltradas.filter(
    (o) => o.status === "Em andamento",
  ).length;
  const totalEncerradas = ordensFiltradas.filter(
    (o) => o.status === "Encerrada",
  ).length;
  const totalInternas = ordensFiltradas.filter(
    (o) => (o.tipoOS || "").toLowerCase() === "interna",
  ).length;
  const totalExternas = ordensFiltradas.filter(
    (o) => (o.tipoOS || "").toLowerCase() === "externa",
  ).length;

  const linhas = ordensFiltradas
    .map(
      (o) => `
      <tr>
        <td>${o.numero || "-"}</td>
        <td>${(o.tipoOS || "-").toUpperCase()}</td>
        <td>${o.dataAbertura ? formatarData(o.dataAbertura) : "-"}</td>
        <td>${o.status || "-"}</td>
        <td>${o.nomeSolicitante || "-"}</td>
        <td>${
          (o.setorSolicitante || "")
            .trim()
            .replace(/^setor\s+/i, "")
            .toUpperCase() || "NÃO INFORMADO"
        }</td>
        <td style="white-space:pre-wrap; word-break:break-word;">${(o.descricaoServico || "-")}</td>
      </tr>`,
    )
    .join("");

  const periodo =
    dataInicio && dataFim
      ? `Período: ${new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`
      : dataInicio
        ? `A partir de: ${new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR")}`
        : `Até: ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`;

  const body = `
${headerPrefeitura("50px")}
<div class="titulo">RELATÓRIO DE ORDENS DE SERVIÇO</div>
<div style="text-align:center;font-size:9px;margin-bottom:8px;color:#555;">${periodo}</div>

<table style="margin-bottom:10px;border:1px solid #ccc;">
  <thead>
    <tr>
      <th style="text-align:center;">Total Geral</th>
      <th style="text-align:center;color:#6a1b9a;">Internas</th>
      <th style="text-align:center;color:#00838f;">Externas</th>
      <th style="text-align:center;color:#1565c0;">Abertas</th>
      <th style="text-align:center;color:#e65100;">Em Andamento</th>
      <th style="text-align:center;color:#2e7d32;">Encerradas</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:center;font-weight:bold;">${ordensFiltradas.length}</td>
      <td style="text-align:center;color:#6a1b9a;font-weight:bold;">${totalInternas}</td>
      <td style="text-align:center;color:#00838f;font-weight:bold;">${totalExternas}</td>
      <td style="text-align:center;color:#1565c0;font-weight:bold;">${totalAbertas}</td>
      <td style="text-align:center;color:#e65100;font-weight:bold;">${totalAndamento}</td>
      <td style="text-align:center;color:#2e7d32;font-weight:bold;">${totalEncerradas}</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th>Nº OS</th>
      <th>Tipo</th>
      <th>Data</th>
      <th>Status</th>
      <th>Solicitante</th>
      <th>Setor</th>
      <th>Descrição</th>
    </tr>
  </thead>
  <tbody>${linhas || `<tr><td colspan="7">Nenhuma ordem encontrada</td></tr>`}</tbody>
</table>
<div class="footer">Documento gerado em: ${dataEmissao} &nbsp;|&nbsp; Gerado por: <strong>${nomeUsuario}</strong></div>`;

  abrirJanelaPrint(wrapHTML("Relatório de Ordens", body));
}
