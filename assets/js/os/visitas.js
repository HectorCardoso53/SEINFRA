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

    const inputNome = document.getElementById("nome-solicitante");
    const inputTelefone = document.getElementById("telefone-solicitante");
    const inputCpf = document.getElementById("cpf-solicitante");
    const inputDescricao = document.getElementById("descricao-servico");
    const inputLocal = document.getElementById("local-servico");
    const inputReferencia = document.getElementById("ponto-referencia");
    const selectSetor = document.getElementById("setor-solicitante");

    if (inputNome) inputNome.value = nome.toUpperCase();
    if (inputTelefone) inputTelefone.value = telefone;
    if (inputCpf) inputCpf.value = cpf;
    if (inputDescricao) inputDescricao.value = servico.toUpperCase();
    if (inputLocal) inputLocal.value = endereco.toUpperCase();
    if (inputReferencia) inputReferencia.value = referencia.toUpperCase();

    if (selectSetor && setor) {
      const setorFormatado = setor.toUpperCase();
      const optionExiste = [...selectSetor.options].some(
        (opt) => opt.value === setorFormatado
      );
      if (optionExiste) selectSetor.value = setorFormatado;
    }

    const box = document.getElementById("box-sugestoes");
    if (box) {
      box.innerHTML = "";
      box.style.display = "none";
    }
  } catch (error) {
    console.error("Erro ao selecionar visita:", error);
  }
}
