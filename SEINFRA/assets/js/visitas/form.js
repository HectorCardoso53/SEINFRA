// ============================================================
// form.js — Cadastro de visitante (AJUSTADO)
// ============================================================

import {
  loadVisits,
  saveVisit,
  updateVisit,
  loadPersons,
  savePerson,
} from "./db.js";

import { showToast } from "./ui.js";
import { renderTable, renderTodayVisits } from "./tabela.js";
import { renderDashboard } from "./dashboard.js";
import { toUpperSafe, today, validarCPF } from "./utils.js";
import { persons, visits, editingId, setEditingId } from "./state.js";

/* =========================
   COLETAR DADOS DO FORMULÁRIO
========================= */
function getFormData() {
  return {
    name: toUpperSafe(document.getElementById("f-name").value),
    cpf: document.getElementById("f-cpf").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    address: toUpperSafe(document.getElementById("f-address").value),
    reference: toUpperSafe(document.getElementById("f-reference").value),
    date: document.getElementById("f-date").value,
  };
}

/* =========================
   VALIDAÇÃO
========================= */
function validateForm(data) {
  if (!data.name) {
    showToast("Informe o nome.", "error");
    return false;
  }

  if (data.cpf && !validarCPF(data.cpf)) {
    showToast("CPF inválido.", "error");
    return false;
  }

  return true;
}

/* =========================
   GARANTIR PESSOA CADASTRADA
========================= */
async function garantirPessoaCadastrada(data) {
  const exists = persons.some(
    (p) => p.name.toLowerCase() === data.name.toLowerCase()
  );

  if (!exists) {
    await savePerson(data.name, data.phone);
    await loadPersons();
  }
}

/* =========================
   SUBMIT
========================= */
export async function handleFormSubmit(e) {
  e.preventDefault();

  const data = getFormData();

  if (!validateForm(data)) return;

  try {
    if (editingId) {
      await updateVisit(editingId, data);
      showToast("Cadastro atualizado!", "success");
      cancelEdit();
    } else {
      await garantirPessoaCadastrada(data);
      await saveVisit(data);
      showToast("Cadastro salvo!", "success");
      clearForm();
    }

    await loadVisits();
    renderTable();
    renderDashboard();
    renderTodayVisits();

  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar.", "error");
  }
}

/* =========================
   EDITAR
========================= */
export function editVisit(id, visits) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;

  setEditingId(id);

  document.getElementById("f-name").value = v.name || "";
  document.getElementById("f-cpf").value = v.cpf || "";
  document.getElementById("f-phone").value = v.phone || "";
  document.getElementById("f-address").value = v.address || "";
  document.getElementById("f-reference").value = v.reference || "";
  document.getElementById("f-date").value = v.date || "";

  document.getElementById("form-card-title").textContent = "Editar Cadastro";
  document.getElementById("btn-submit").innerText = "Salvar Alterações";
  document.getElementById("btn-cancel-edit").style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   CANCELAR
========================= */
export function cancelEdit() {
  setEditingId(null);

  document.getElementById("form-card-title").textContent = "Cadastro de Visitante";
  document.getElementById("btn-submit").innerText = "Salvar Cadastro";
  document.getElementById("btn-cancel-edit").style.display = "none";

  clearForm();
}

/* =========================
   LIMPAR
========================= */
export function clearForm() {
  document.getElementById("visit-form").reset();
  document.getElementById("f-date").value = today();
}

/* =========================
   AUTOCOMPLETE (CORRIGIDO)
========================= */
export function initPersonAutocomplete() {
  const input = document.getElementById("f-name");
  const list = document.getElementById("person-suggestions");

  if (!input) return;

  input.addEventListener("input", function () {
    const value = this.value.toLowerCase();
    list.innerHTML = "";

    if (value.length < 2) return;

    const matches = visits
      .filter((v) => v.name.toLowerCase().includes(value))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    matches.forEach((person) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.textContent = person.name + " - " + person.phone;

      div.onclick = () => {
        input.value = person.name;

        document.getElementById("f-phone").value = person.phone || "";
        document.getElementById("f-cpf").value = person.cpf || "";
        document.getElementById("f-address").value = person.address || "";
        document.getElementById("f-reference").value = person.reference || "";

        list.innerHTML = "";
      };

      list.appendChild(div);
    });
  });
}