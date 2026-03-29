// ============================================================
// form.js — Formulário de visita: CRUD, validação e autocomplete
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
import { toUpperSafe, today, validarCPF, escapeHtml } from "./utils.js";
import { persons, visits, editingId, setEditingId } from "./state.js";

/* =========================
   COLETAR DADOS DO FORMULÁRIO
========================= */
function getFormData() {
  return {
    name: toUpperSafe(document.getElementById("f-name").value),
    cpf: document.getElementById("f-cpf").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    phone2: document.getElementById("f-phone2").value.trim(),
    address: toUpperSafe(document.getElementById("f-address").value),
    reference: toUpperSafe(document.getElementById("f-reference").value),
    date: document.getElementById("f-date").value,
    diretoria: document.getElementById("f-diretoria").value,
    sector: document.getElementById("f-sector").value,
    tipo: document.getElementById("f-tipo").value, // 🔥 NOVO
    reason: toUpperSafe(document.getElementById("f-reason").value),
  };
}

/* =========================
   VALIDAÇÃO — corrigida: valida ANTES de salvar pessoa
========================= */
function validateForm(data) {
  if (!data.name || !data.name.trim()) {
    showToast("Informe o nome do visitante.", "error");
    return false;
  }

  if (data.cpf && !validarCPF(data.cpf)) {
    showToast("CPF inválido. Verifique os dígitos.", "error");
    return false;
  }

  if (!data.phone) {
    showToast("Informe o contato.", "error");
    return false;
  }

  if (!data.date) {
    showToast("Informe a data da visita.", "error");
    return false;
  }

  if (!data.sector) {
    showToast("Informe o setor.", "error");
    return false;
  }

  if (!data.reason) {
    showToast("Informe o motivo da visita.", "error");
    return false;
  }

  return true;
}

/* =========================
   SALVAR PESSOA (somente após validação aprovada)
========================= */
async function garantirPessoaCadastrada(data) {
  const personExists = persons.some(
    (p) => p.name.toLowerCase() === data.name.toLowerCase(),
  );
  if (!personExists) {
    await savePerson(data.name, data.phone);
    await loadPersons();
  }
}

/* =========================
   SUBMIT DO FORMULÁRIO
========================= */
export async function handleFormSubmit(e) {
  e.preventDefault();

  const data = getFormData();

  // ✅ valida PRIMEIRO — só prossegue se tudo OK
  if (!validateForm(data)) return;

  try {
    if (editingId) {
      await updateVisit(editingId, data);
      showToast("Visita atualizada com sucesso!", "success");
      cancelEdit();
    } else {
      // só cadastra pessoa depois que a validação passou
      await garantirPessoaCadastrada(data);
      await saveVisit(data);
      showToast("Visita cadastrada com sucesso!", "success");
      clearForm();
    }

    await loadVisits();
    renderTable();
    renderDashboard();
    renderTodayVisits();
  } catch (error) {
    console.error("Erro ao salvar visita:", error);
    showToast("Erro ao salvar visita.", "error");
  }
}

/* =========================
   EDITAR VISITA
========================= */
export function editVisit(id, visits) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;

  setEditingId(id);

  document.getElementById("f-name").value = v.name || "";
  document.getElementById("f-cpf").value = v.cpf || "";
  document.getElementById("f-phone").value = v.phone || "";
  document.getElementById("f-phone2").value = v.phone2 || "";
  document.getElementById("f-address").value = v.address || "";
  document.getElementById("f-reference").value = v.reference || "";
  document.getElementById("f-date").value = v.date || "";
  document.getElementById("f-sector").value = v.sector || "";
  document.getElementById("f-reason").value = v.reason || "";

  document.getElementById("form-card-title").textContent = "Editar Visita";
  document.getElementById("btn-submit").innerHTML = "Salvar Alterações";
  document.getElementById("btn-cancel-edit").style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   CANCELAR EDIÇÃO
========================= */
export function cancelEdit() {
  setEditingId(null);
  document.getElementById("form-card-title").textContent = "Nova Visita";
  document.getElementById("btn-submit").innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Cadastrar Visita`;
  document.getElementById("btn-cancel-edit").style.display = "none";
  clearForm();
}

/* =========================
   LIMPAR FORMULÁRIO
========================= */
export function clearForm() {
  document.getElementById("visit-form").reset();
  document.getElementById("f-date").value = today();
}

/* =========================
   CADASTRO RÁPIDO DE PESSOA
========================= */
export async function handleSavePerson(e) {
  e.preventDefault();

  const name = document.getElementById("p-name").value.trim();
  const phone = document.getElementById("p-phone").value.trim();

  if (!name || !phone) {
    showToast("Preencha nome e telefone", "error");
    return;
  }

  const exists = persons.some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    showToast("Essa pessoa já está cadastrada", "error");
    return;
  }

  await savePerson(name, phone);
  showToast("Pessoa cadastrada com sucesso!");
  document.getElementById("person-form").reset();
  await loadPersons();
}

/* =========================
   AUTOCOMPLETE DE PESSOAS
========================= */
export function initPersonAutocomplete() {
  const input = document.getElementById("f-name");
  const list = document.getElementById("person-suggestions");
  const phone = document.getElementById("f-phone");
  const warning = document.getElementById("person-warning");

  if (!input) return;

  input.addEventListener("input", function () {
    const value = this.value.toLowerCase();
    list.innerHTML = "";
    if (warning) warning.style.display = "none";
    if (value.length < 2) return;

    const matches = visits
      .filter((v) => v.name.toLowerCase().includes(value))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // pega o mais recente primeiro

    if (!matches.length) {
      if (warning) warning.style.display = "block";
      phone.value = "";
      return;
    }

    matches.forEach((person) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      // ✅ textContent em vez de innerHTML — sem risco de XSS
      const strong = document.createElement("strong");
      strong.textContent = person.name;
      const br = document.createElement("br");
      const small = document.createElement("span");
      small.style.cssText = "font-size:12px;color:#666";
      small.textContent = person.phone;
      div.appendChild(strong);
      div.appendChild(br);
      div.appendChild(small);

      div.onclick = () => {
        input.value = person.name;

        // 🔥 Preenche tudo automaticamente
        document.getElementById("f-phone").value = person.phone || "";
        document.getElementById("f-phone2").value = person.phone2 || "";
        document.getElementById("f-cpf").value = person.cpf || "";
        document.getElementById("f-address").value = person.address || "";
        document.getElementById("f-reference").value = person.reference || "";
        document.getElementById("f-diretoria").value = person.diretoria || "";
        document.getElementById("f-sector").value = person.sector || "";
        document.getElementById("f-tipo").value = person.tipo || "";
        document.getElementById("f-reason").value = person.reason || "";

        if (warning) warning.style.display = "none";
        list.innerHTML = "";
      };
      list.appendChild(div);
    });
  });
}
