// ============================================================
// utils.js — Funções puras, sem dependência de DOM
// ============================================================

export const setoresPorDiretoria = {
  "DIRETORIA ADMINISTRATIVA": [
    "RECEPÇÃO",
    "PLANEJAMENTO",
    "RECURSOS HUMANOS",
    "COMPRAS E DEPÓSITO",
    "COMUNICAÇÃO",
    "ALMOXARIFADO",
    "LOGÍSTICA",
    "LIMPEZA E HIGIENE",
    "SHOPPING POPULAR",
  ],
  "DIRETORIA DE SANEAMENTO": [
    "ADMINISTRATIVO",
    "HIDRÁULICO",
    "ESGOTAMENTO DE FOSSA SÉPTICA",
    "SISTEMA DE ABASTECIMENTO DE ÁGUA",
  ],
  "DIRETORIA DE LIMPEZA URBANA": [
    "ADMINISTRATIVO",
    "CAPINA E VARRIÇÃO",
    "DESOBSTRUÇÃO DE BUEIROS",
    "RESÍDUOS SÓLIDOS - DOMÉSTICO, VEGETAL, SERVIÇOS DE SAÚDE",
    "CAÇAMBA ESTACIONÁRIA",
    "LIMPEZA DE FONTES LUMINOSAS",
  ],
  "DIRETORIA DE INFRAESTRUTURA": [
    "ADMINISTRATIVO",
    "TERRAPLANAGEM",
    "OFICINAS MECÂNICAS",
    "SOLDA",
    "LUBRIFICAÇÃO",
    "CARPINTARIA/MOVELARIA",
    "ELÉTRICA",
    "CEMITÉRIO",
    "REFRIGERAÇÃO",
    "ASFALTO",
    "PAVIMENTAÇÃO",
    "BLOCO E BLOQUETE",
    "PORTOS/RAMPAS HIDROVIÁRIAS",
    "PINTURA",
    "ABASTECIMENTO DE COMBUSTÍVEL",
  ],
  "DIRETORIA DE AEROPORTO": [
    "POUSO E DECOLAGEM",
    "CONTROLE DE PASSAGEIROS E BAGAGENS",
    "INSPEÇÃO OPERACIONAL",
    "SEGURANÇA AEROPORTUÁRIA",
  ],
};

export function normalizarTexto(texto) {
  return texto
    ?.toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function upper(v) {
  return v ? v.toString().trim().toUpperCase() : null;
}

export function formatarData(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataCompleta(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

export function agruparMateriais(lista) {
  const mapa = {};
  lista.forEach((m) => {
    if (!m.nome) return;
    const chave = m.nome.trim().toLowerCase() + "_" + (m.unidade || "");
    if (!mapa[chave]) {
      mapa[chave] = { nome: m.nome, unidade: m.unidade || "", quantidade: 0 };
    }
    mapa[chave].quantidade += Number(m.quantidade || 0);
  });
  return Object.values(mapa);
}

export function validarSetor(diretoria, setor) {
  const lista = setoresPorDiretoria[normalizarTexto(diretoria)] || [];
  return lista.includes(setor);
}

export function validarOrdem(dados) {
  if (!dados.descricao?.trim()) throw new Error("Descrição obrigatória");
  if (!dados.nomeSolicitante?.trim()) throw new Error("Nome do solicitante obrigatório");
  if (!dados.setorSolicitante?.trim()) throw new Error("Setor solicitante obrigatório");
  if (!dados.setorResponsavel?.trim()) throw new Error("Diretoria responsável obrigatória");
  if (!dados.local?.trim()) throw new Error("Local do serviço obrigatório");
  if (!dados.dataAbertura) throw new Error("Data de abertura obrigatória");
  if (!validarSetor(dados.setorResponsavel, dados.setorSolicitante)) {
    throw new Error("Setor inválido para a diretoria selecionada");
  }
}

export function buildOrdem(dados) {
  return {
    tipoOS: dados.tipoOS,
    dataAbertura: dados.dataAbertura,
    setorResponsavel: upper(dados.setorResponsavel),
    nomeSolicitante: upper(dados.nomeSolicitante),
    cpfSolicitante: dados.cpf || null,
    telefoneSolicitante: dados.telefone || null,
    setorSolicitante: upper(dados.setorSolicitante),
    descricaoServico: upper(dados.descricao),
    localServico: upper(dados.local),
    pontoReferencia: upper(dados.pontoReferencia),
    materiais: Array.isArray(dados.materiais)
      ? dados.materiais.map((m) => ({
          nome: upper(m.nome),
          unidade: upper(m.unidade),
          quantidade: m.quantidade || null,
        }))
      : [],
    responsavelExecucao: upper(dados.responsavelExecucao),
    responsavelAbertura: upper(dados.responsavelAbertura),
    status: "Aberta",
    dataEncerramento: null,
    observacaoFinal: null,
    assinaturaChefia: null,
    assinaturaRecebedor: null,
  };
}
