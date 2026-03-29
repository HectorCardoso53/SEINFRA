// ============================================================
// utils.js — Funções puras, sem dependência de DOM
// ============================================================

export const setoresPorDiretoria = {
  "DIRETORIA ADMINISTRATIVA": [
    "RECEPÇÃO", "PLANEJAMENTO", "RECURSOS HUMANOS", "COMPRAS E DEPÓSITO",
    "COMUNICAÇÃO", "LOGÍSTICA", "LIMPEZA E HIGIENE", "SHOPPING POPULAR",
  ],
  "DIRETORIA DE SANEAMENTO": [
    "ADMINISTRATIVO", "HIDRÁULICO", "ESGOTAMENTO DE FOSSA SÉPTICA",
    "SISTEMA DE ABASTECIMENTO DE ÁGUA",
  ],
  "DIRETORIA DE LIMPEZA URBANA": [
    "ADMINISTRATIVO", "CAPINA E VARRIÇÃO", "DESOBSTRUÇÃO DE BUEIROS",
    "RESÍDUOS SÓLIDOS - DOMÉSTICO, VEGETAL, SERVIÇOS DE SAÚDE",
    "CAÇAMBA ESTACIONÁRIA", "LIMPEZA DE FONTES LUMINOSAS",
  ],
  "DIRETORIA DE INFRAESTRUTURA": [
    "ADMINISTRATIVO", "TERRAPLANAGEM", "OFICINAS MECÂNICAS", "SOLDA",
    "LUBRIFICAÇÃO", "CARPINTARIA/MOVELARIA", "ELÉTRICA", "CEMITÉRIO",
    "REFRIGERAÇÃO", "ASFALTO", "PAVIMENTAÇÃO", "BLOCO E BLOQUETE",
    "PORTOS/RAMPAS HIDROVIÁRIAS", "PINTURA", "ABASTECIMENTO DE COMBUSTÍVEL",
  ],
  "DIRETORIA DE AEROPORTO": [
    "POUSO E DECOLAGEM", "CONTROLE DE PASSAGEIROS E BAGAGENS",
    "INSPEÇÃO OPERACIONAL", "SEGURANÇA AEROPORTUÁRIA",
  ],
};

export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function today() {
  return new Date().toISOString().split("T")[0];
}

export function toUpperSafe(value) {
  return value?.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Valida dígitos verificadores do CPF
export function validarCPF(cpf) {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(nums[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(nums[10]);
}
