// firestore.js — mantém os mesmos nomes de funções exportadas
// substitui Firestore por chamadas REST à API SEINFRA

import { api } from "./api.js";

// Mapeamento: campo frontend → campo backend (onde diferem)
function toBackend(ordem) {
  return {
    tipoOS:              ordem.tipoOS,
    dataAbertura:        ordem.dataAbertura,
    nomeSolicitante:     ordem.nomeSolicitante,
    cpf:                 ordem.cpfSolicitante,
    telefone:            ordem.telefoneSolicitante,
    telefone2:           ordem.telefone2,
    setorSolicitante:    ordem.setorSolicitante,
    setorResponsavel:    ordem.setorResponsavel,
    descricao:           ordem.descricaoServico,
    local:               ordem.localServico,
    pontoReferencia:     ordem.pontoReferencia,
    materiais:           ordem.materiais || [],
    responsavelExecucao: ordem.responsavelExecucao,
    responsavelAbertura: ordem.responsavelAbertura,
    observacaoFinal:     ordem.observacaoFinal,
    assinaturaChefia:    ordem.assinaturaChefia,
    assinaturaRecebedor: ordem.assinaturaRecebedor,
    assinaturaEletronica: ordem.assinaturaEletronica,
    status:              ordem.status,
    dataEncerramento:    ordem.dataEncerramento,
  };
}

function toFrontend(res) {
  if (!res) return null;
  return {
    id:                   res.id,
    numero:               res.numero,
    numeroSequencial:     res.numeroSequencial,
    tipoOS:               res.tipoOS,
    status:               res.status,
    dataAbertura:         res.dataAbertura,
    dataEncerramento:     res.dataEncerramento,
    nomeSolicitante:      res.nomeSolicitante,
    cpfSolicitante:       res.cpf,
    telefoneSolicitante:  res.telefone,
    telefone2:            res.telefone2,
    setorSolicitante:     res.setorSolicitante,
    setorResponsavel:     res.setorResponsavel,
    descricaoServico:     res.descricao,
    localServico:         res.local,
    pontoReferencia:      res.pontoReferencia,
    materiais:            res.materiais || [],
    responsavelExecucao:  res.responsavelExecucao,
    responsavelAbertura:  res.responsavelAbertura,
    observacaoFinal:      res.observacaoFinal,
    assinaturaChefia:     res.assinaturaChefia,
    assinaturaRecebedor:  res.assinaturaRecebedor,
    assinaturaEletronica: res.assinaturaEletronica,
    criadoEm:             res.criadoEm,
    criadoPor:            res.criador?.nome || res.criadoPor,
  };
}

export async function buscarVisitasPorNome(nome) {
  const res = await api.get(`/visits?search=${encodeURIComponent(nome)}&limit=20`);
  return Array.isArray(res) ? res : (res.visitas || []);
}

export async function contarOrdensFirestore() {
  const res = await api.get("/orders?limit=1");
  return res.total || 0;
}

export async function buscarResumoDashboard() {
  return api.get("/orders/stats/dashboard");
}

export async function buscarOrdensDashboard() {
  const res = await api.get("/orders?limit=20");
  return (res.ordens || []).map(toFrontend);
}

export async function buscarTodasOrdens() {
  const res = await api.get("/orders?limit=9999");
  return (res.ordens || []).map(toFrontend);
}

export async function buscarOrdensPaginadas(paginaOuCursor = 1, limite = 20) {
  const pagina = typeof paginaOuCursor === "number" ? paginaOuCursor : 1;
  const res = await api.get(`/orders?page=${pagina}&limit=${limite}`);
  return {
    lista:          (res.ordens || []).map(toFrontend),
    ultimoDocumento: null,
    total:          res.total || 0,
    totalPages:     res.totalPages || 1,
  };
}

export async function buscarOrdensComFiltro({ status, setorResponsavel, dataInicio, dataFim } = {}) {
  const p = new URLSearchParams({ limit: "9999" });
  if (status)           p.set("status",    status);
  if (setorResponsavel) p.set("diretoria", setorResponsavel);
  if (dataInicio)       p.set("dataInicio", dataInicio);
  if (dataFim)          p.set("dataFim",    dataFim);
  const res = await api.get(`/orders?${p}`);
  return (res.ordens || []).map(toFrontend);
}

export async function gerarNumeroOS() {
  const res = await api.get("/orders/next-number");
  return res.numero;
}

export async function consultarProximoNumeroOS() {
  const res = await api.get("/orders/next-number");
  return res.numero;
}

export async function salvarOrdemFirestore(ordem) {
  const res = await api.post("/orders", toBackend(ordem));
  return { id: res.id, numero: res.numero };
}

export async function atualizarStatusComDashboard(id, dados) {
  await api.patch(`/orders/${id}`, toBackend(dados));
}

export async function atualizarOrdemComDashboard(id, dados) {
  await api.patch(`/orders/${id}`, toBackend(dados));
}

export async function excluirOrdemFirestore(id) {
  await api.delete(`/orders/${id}`);
}

export async function buscarOrdemPorId(id) {
  const res = await api.get(`/orders/${id}`);
  return toFrontend(res);
}

export async function buscarVisitaPorId(id) {
  return api.get(`/visits/${id}`);
}

export async function salvarAceiteTermos() {
  await api.post("/terms/accept", {});
}

export async function verificarAceiteTermos() {
  const res = await api.get("/terms/check");
  return res.aceito === true;
}

export async function reconstruirDashboard() {
  console.log("reconstruirDashboard: gerenciado automaticamente pelo backend");
}

export async function buscarOrdensFirestore() { return []; }
