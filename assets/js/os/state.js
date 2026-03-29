// ============================================================
// state.js — Estado global compartilhado entre módulos
// ============================================================

export let ordens = [];
export let materiais = [];
export let materiaisEncerramento = [];
export let osAtual = null;
export let carregando = false;
export let paginaAtual = 1;
export let historicoDocs = [];
export let sistemaInicializado = false;
export let graficoStatus = null;
export let graficoMes = null;
export let salvando = false;

export function setOrdens(valor) { ordens = valor; }
export function setMateriais(valor) { materiais = valor; }
export function setMateriaisEncerramento(valor) { materiaisEncerramento = valor; }
export function setOsAtual(valor) { osAtual = valor; }
export function setCarregando(valor) { carregando = valor; }
export function setPaginaAtual(valor) { paginaAtual = valor; }
export function setHistoricoDocs(valor) { historicoDocs = valor; }
export function setSistemaInicializado(valor) { sistemaInicializado = valor; }
export function setGraficoStatus(valor) { graficoStatus = valor; }
export function setGraficoMes(valor) { graficoMes = valor; }
export function setSalvando(valor) { salvando = valor; }
