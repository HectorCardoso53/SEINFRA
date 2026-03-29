// ============================================================
// impressao.js — Geração de PDF e visualização para impressão
// ============================================================

import { buscarTodasOrdens } from "../firestore.js";
import { formatarData, formatarDataCompleta, normalizarTexto } from "./utils.js";
import { osAtual } from "./state.js";
import { mostrarAlerta } from "./ui.js";

/* =========================
   ESTILOS BASE COMPARTILHADOS
========================= */
const cssBase = `
@page { size: A4 portrait; margin: 12mm; }
body { font-family: Arial; font-size: 12px; }
.folha { display:flex; flex-direction:column; gap:15px; }
.os-bloco { border:1px solid #000; padding:12px; }
.header { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:10px; }
.header img { width:40px; }
.header-text h1 { font-size:16px; margin:0; }
.header-text p { font-size:11px; margin:0; }
.titulo { text-align:center; font-size:14px; font-weight:bold; margin:10px 0; }
.secao { margin-bottom:10px; }
.secao h3 { font-size:12px; border-bottom:1px solid #000; margin-bottom:6px; }
.assinaturas { display:flex; justify-content:space-around; margin-top:25px; gap:30px; }
.assinatura-box { flex:1; text-align:center; }
.linha { border-top:1px solid #000; margin-bottom:5px; }
.linha-corte { border-top:2px dashed #000; margin:5px 0; }
.footer { margin-top:10px; font-size:10px; text-align:right; }
table { width:100%; border-collapse:collapse; }
th, td { border:1px solid #000; padding:4px; font-size:11px; }
th { background:#f2f2f2; }
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
  const boxes = tipoOS === "externa"
    ? ["Secretária", "Responsável", "Requerente"]
    : ["Secretária", "Responsável"];
  return `
<div class="assinaturas">
  ${boxes.map((label) => `<div class="assinatura-box"><div class="linha"></div>${label}</div>`).join("")}
</div>`;
}

function conteudoOSHTML(dados) {
  const { numero, status, dataAbertura, dataEncerramento, tipoOS, nomeSolicitante,
    cpf, telefone, setorSolicitante, setorResponsavel, execucao, abertura, local, descricao } = dados;
  const tipo = (tipoOS || "").toLowerCase();
  const tipoTitulo = tipo === "externa" ? "EXTERNA" : tipo === "interna" ? "INTERNA" : "";
  const dataEmissao = new Date().toLocaleString("pt-BR");

  return `
${headerPrefeitura()}
<div class="titulo">ORDEM DE SERVIÇO ${tipoTitulo}</div>

<div class="secao">
<h3>Informações Gerais</h3>
<div><strong>Número:</strong> ${numero}</div>
<div><strong>Status:</strong> ${status || "Aberta"}</div>
<div><strong>Data de Abertura:</strong> ${formatarDataCompleta(dataAbertura)}</div>
<div><strong>Data de Encerramento:</strong> ${dataEncerramento ? formatarDataCompleta(dataEncerramento) : "-"}</div>
</div>

<div class="secao">
<h3>Solicitante</h3>
<div><strong>Nome:</strong> ${nomeSolicitante}</div>
<div><strong>CPF:</strong> ${cpf || "-"}</div>
<div><strong>Telefone:</strong> ${telefone || "-"}</div>
<div><strong>Setor:</strong> ${setorSolicitante || "-"}</div>
<div><strong>Setor Responsável:</strong> ${setorResponsavel}</div>
</div>

<div class="secao">
<h3>Execução</h3>
<div><strong>Responsável Execução:</strong> ${execucao || "-"}</div>
<div><strong>Responsável Abertura:</strong> ${abertura}</div>
<div><strong>Local do Serviço:</strong> ${local}</div>
</div>

<div class="secao">
<h3>Descrição do Serviço</h3>
<div>${descricao}</div>
</div>

<div class="secao">
<h3>Encerramento</h3>
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
    setorSolicitante: document.getElementById("setor-solicitante").value,
    setorResponsavel: document.getElementById("setor-responsavel").value,
    descricao: document.getElementById("descricao-servico").value,
    local: document.getElementById("local-servico").value,
    execucao: document.getElementById("responsavel-execucao")?.value || "-",
    abertura: document.getElementById("responsavel-abertura").value,
    status: "Aberta",
    dataEncerramento: null,
  };

  const bloco = conteudoOSHTML(dados);
  const body = `<div class="folha"><div class="os-bloco">${bloco}</div><div class="linha-corte"></div><div class="os-bloco">${bloco}</div></div>`;
  abrirJanelaPrint(wrapHTML("Pré-visualização OS", body));
}

/* =========================
   IMPRIMIR DETALHES OS
========================= */
export function imprimirDetalhesOS() {
  if (!osAtual) return;

  const temMateriais = osAtual.materiais && osAtual.materiais.length > 0;
  const materiaisHTML = temMateriais
    ? osAtual.materiais.map((m, i) => `<tr><td>${i + 1}</td><td>${m.nome}</td><td>${m.quantidade || "-"}</td><td>${m.unidade}</td></tr>`).join("")
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
    setorSolicitante: osAtual.setorSolicitante,
    setorResponsavel: osAtual.setorResponsavel,
    execucao: osAtual.responsavelExecucao,
    abertura: osAtual.responsavelAbertura,
    local: osAtual.localServico,
    descricao: osAtual.descricaoServico,
  };

  let bloco = conteudoOSHTML(dados);
  if (temMateriais) {
    bloco += `
<div class="secao">
<h3>Materiais Utilizados</h3>
<table><thead><tr><th>#</th><th>Material</th><th>Quantidade</th><th>Unidade</th></tr></thead>
<tbody>${materiaisHTML}</tbody></table>
</div>`;
  }

  const body = `<div class="folha"><div class="os-bloco">${bloco}</div><div class="linha-corte"></div><div class="os-bloco">${bloco}</div></div>`;
  abrirJanelaPrint(wrapHTML(`Ordem de Serviço - ${osAtual.numero}`, body));
}

/* =========================
   GERAR PDF DE MATERIAIS
========================= */
export function gerarPDFMateriais() {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map((m, i) => `<tr><td>${i + 1}</td><td>${m.nome}</td><td>${m.quantidade || "-"}</td><td>${m.unidade}</td></tr>`)
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const body = `
${headerPrefeitura("80px")}
<div class="titulo">RELAÇÃO DE MATERIAIS SOLICITADOS</div>
<div style="margin-bottom:20px;font-size:14px;">
  <div><strong>Número da OS:</strong> ${osAtual.numero}</div>
  <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
  <div><strong>Solicitante:</strong> ${osAtual.nomeSolicitante}</div>
  <div><strong>Setor:</strong> ${osAtual.setorSolicitante}</div>
  <div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>
  <div><strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao || ""}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Material</th><th>Quantidade</th><th>Unidade</th></tr></thead>
  <tbody>${lista}</tbody>
</table>
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

  let conteudoTabela = "";
  linhas.forEach((linha) => {
    const colunas = linha.querySelectorAll("td");
    if (colunas.length >= 3) {
      conteudoTabela += `<tr><td>${colunas[0].innerText}</td><td>${colunas[1].innerText}</td><td>${colunas[2].innerText}</td></tr>`;
    }
  });

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const body = `
${headerPrefeitura("80px")}
<div class="titulo">RELATÓRIO DE MATERIAIS UTILIZADOS</div>
<table>
  <thead><tr><th>Material</th><th>Quantidade</th><th>Unidade</th></tr></thead>
  <tbody>${conteudoTabela}</tbody>
</table>
<div class="footer">Documento gerado em: ${dataEmissao}</div>`;

  abrirJanelaPrint(wrapHTML("Relatório de Materiais", body));
}

/* =========================
   IMPRIMIR RELATÓRIO GERAL
========================= */
export async function imprimirRelatorio() {
  const dataEmissao = new Date().toLocaleString("pt-BR");
  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const status = document.getElementById("filtro-status").value;
  const diretoria = document.getElementById("filtro-diretoria")?.value || "";
  const solicitante = document.getElementById("filtro-solicitante").value.trim().toLowerCase();
  const setorSolicitante = document.getElementById("filtro-setor-solicitante")?.value.trim();

  if (!dataInicio && !dataFim) {
    alert("Selecione um período.");
    return;
  }

  let todasOrdens = await buscarTodasOrdens();

  let ordensFiltradas = todasOrdens.filter((o) => {
    if (!o.dataAbertura) return false;
    const data = new Date(o.dataAbertura);
    if (dataInicio && data < new Date(dataInicio + "T00:00:00")) return false;
    if (dataFim && data > new Date(dataFim + "T23:59:59")) return false;
    if (status && o.status !== status) return false;
    if (solicitante && !o.nomeSolicitante?.toLowerCase().includes(solicitante)) return false;
    if (setorSolicitante) {
      const filtro = normalizarTexto(setorSolicitante);
      const valor = normalizarTexto(o.setorSolicitante || "");
      if (!valor.includes(filtro)) return false;
    }
    if (diretoria && o.setorResponsavel !== diretoria) return false;
    return true;
  });

  if (ordensFiltradas.length >= 200) {
    alert("Muitos resultados. Refine o filtro.");
    return;
  }

  ordensFiltradas.sort((a, b) => (b.numeroSequencial || 0) - (a.numeroSequencial || 0));

  const linhas = ordensFiltradas
    .map(
      (o) => `
      <tr>
        <td>${o.numero || "-"}</td>
        <td>${o.dataAbertura ? formatarData(o.dataAbertura) : "-"}</td>
        <td>${o.status || "-"}</td>
        <td>${o.nomeSolicitante || "-"}</td>
        <td>${o.setorSolicitante || "-"}</td>
        <td>${(o.descricaoServico || "-").substring(0, 100)}</td>
      </tr>`
    )
    .join("");

  const body = `
${headerPrefeitura("80px")}
<div class="titulo">RELATÓRIO DE ORDENS DE SERVIÇO</div>
<table>
  <thead>
    <tr><th>Nº OS</th><th>Data</th><th>Status</th><th>Solicitante</th><th>Setor</th><th>Descrição</th></tr>
  </thead>
  <tbody>${linhas || `<tr><td colspan="6">Nenhuma ordem encontrada</td></tr>`}</tbody>
</table>
<div class="footer">Documento gerado em: ${dataEmissao}</div>`;

  abrirJanelaPrint(wrapHTML("Relatório de Ordens", body));
}
