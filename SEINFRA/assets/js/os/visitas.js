// ============================================================
// visitas.js — Autocomplete e seleção de visitantes
// ============================================================

import { buscarVisitasPorNome, buscarVisitaPorId } from "../firestore.js";
import { renderSugestoes } from "./ui.js";

export function inicializarAutoCompleteVisitas() {
  const inputNome = document.getElementById("nome-solicitante");
  if (!inputNome) return;

  inputNome.addEventListener("input", async (e) => {
    const valor = e.target.value.trim().toUpperCase();
    if (valor.length < 2) {
      const box = document.getElementById("box-sugestoes");
      if (box) box.innerHTML = "";
      return;
    }
    const lista = await buscarVisitasPorNome(valor);
    renderSugestoes(lista, selecionarVisita);
  });
}

export async function selecionarVisita(id) {
  try {
    const v = await buscarVisitaPorId(id);
    if (!v) return;

    const nome = v.name || "";
    const telefone = v.phone || "";
    const cpf = v.cpf || "";
    const endereco = v.address || "";
    const referencia = v.reference || "";
    const servico = v.reason || "";
    const setor = v.sector || "";
    const diretoria = v.diretoria || "";
    const tipo = v.tipo || "";

    // =========================
    // CAMPOS
    // =========================
    const inputNome = document.getElementById("nome-solicitante");
    const inputTelefone = document.getElementById("telefone-solicitante");
    const inputCpf = document.getElementById("cpf-solicitante");
    const inputDescricao = document.getElementById("descricao-servico");
    const inputLocal = document.getElementById("local-servico");
    const inputReferencia = document.getElementById("ponto-referencia");

    const selectSetor = document.getElementById("setor-solicitante");
    const selectDiretoria = document.getElementById("setor-responsavel");
    const selectTipo = document.getElementById("tipo-os");

    // =========================
    // PREENCHIMENTO BÁSICO
    // =========================
    if (inputNome) inputNome.value = nome.toUpperCase();
    if (inputTelefone) inputTelefone.value = telefone;
    if (inputCpf) inputCpf.value = cpf;
    if (inputDescricao) inputDescricao.value = servico.toUpperCase();
    if (inputLocal) inputLocal.value = endereco.toUpperCase();
    if (inputReferencia) inputReferencia.value = referencia.toUpperCase();

    // =========================
    // 🔥 TIPO (INTERNA / EXTERNA)
    // =========================
    if (selectTipo && tipo) {
      const tipoFormatado = tipo.toLowerCase() === "interno" ? "interna" : "externa";
      selectTipo.value = tipoFormatado;
    }

    // =========================
    // 🔥 DIRETORIA
    // =========================
   // =========================
// 🔥 DIRETORIA + SETOR (CORRETO)
// =========================
if (selectDiretoria && diretoria) {
  const diretoriaFormatada = diretoria.toUpperCase();

  const existeDiretoria = [...selectDiretoria.options].some(
    (opt) => opt.value === diretoriaFormatada || opt.textContent === diretoriaFormatada
  );

  if (existeDiretoria) {
    selectDiretoria.value = diretoriaFormatada;

    // 🔥 FORÇA EVENTO (isso é o segredo)
    selectDiretoria.dispatchEvent(new Event("change"));

    // AGORA espera carregar os setores
    setTimeout(() => {
      if (selectSetor && setor) {
        const setorFormatado = setor.toUpperCase();

        const existeSetor = [...selectSetor.options].some(
          (opt) => opt.value === setorFormatado
        );

        if (existeSetor) {
          selectSetor.value = setorFormatado;
        }
      }
    }, 400);
  }
}

    // =========================
    // 🔥 SETOR
    // =========================
    if (selectSetor && setor) {
  const setorFormatado = setor.toUpperCase();

  // tenta setar direto primeiro
  selectSetor.value = setorFormatado;

  // se não funcionou (não encontrou), tenta novamente depois
  setTimeout(() => {
    const existe = [...selectSetor.options].some(
      (opt) => opt.value === setorFormatado
    );

    if (existe) {
      selectSetor.value = setorFormatado;
    }
  }, 300);
}

    // =========================
    // LIMPAR SUGESTÕES
    // =========================
    const box = document.getElementById("box-sugestoes");
    if (box) {
      box.innerHTML = "";
      box.style.display = "none";
    }

  } catch (error) {
    console.error("Erro ao selecionar visita:", error);
  }
}