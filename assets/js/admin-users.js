"use strict";

import { api } from "./api.js";

/* ==========================
   LISTAGEM DE USUÁRIOS
========================== */
async function carregarUsuarios() {
  const lista = document.getElementById("lista-usuarios");
  if (!lista) return;
  lista.innerHTML = "";

  try {
    const users = await api.get("/users");

    if (!users.length) {
      lista.innerHTML = "<p>Nenhum usuário cadastrado.</p>";
      return;
    }

    users.forEach((u) => {
      lista.innerHTML += `
        <div class="user-card">
          <div class="user-header">
            <div>
              <h4>${u.nome}</h4>
              <span class="badge ${u.role === "admin" || u.role === "master" ? "badge-admin" : "badge-user"}">
                ${u.role}
              </span>
            </div>
            <span class="${u.ativo ? "status-ativo" : "status-inativo"}">
              ${u.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div class="user-info">
            <p><b>Email:</b> ${u.email}</p>
            <p><b>Setor:</b> ${u.setor || "-"}</p>
            <p><b>Telefone:</b> ${u.telefone || "-"}</p>
          </div>
          <div class="user-actions">
            <button onclick="editarUsuario('${u.id}')" class="btn-edit">✏ Editar</button>
            <button onclick="toggleStatus('${u.id}', ${u.ativo})" class="btn-warning">
              ${u.ativo ? "Inativar" : "Ativar"}
            </button>
            <button onclick="excluirUsuario('${u.id}')" class="btn-delete">🗑 Excluir</button>
          </div>
        </div>
      `;
    });
  } catch (err) {
    lista.innerHTML = `<p style="color:red">Erro ao carregar usuários: ${err.message}</p>`;
  }
}

/* ==========================
   EXCLUIR USUÁRIO
========================== */
window.excluirUsuario = async function (id) {
  const result = await Swal.fire({
    title: "Tem certeza?",
    text: "Essa ação não poderá ser desfeita!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  });
  if (!result.isConfirmed) return;

  try {
    await api.delete(`/users/${id}`);
    Swal.fire("Excluído!", "Usuário removido.", "success");
    carregarUsuarios();
  } catch (err) {
    Swal.fire("Erro", err.message, "error");
  }
};

/* ==========================
   TOGGLE ATIVO/INATIVO
========================== */
window.toggleStatus = async function (id) {
  try {
    await api.patch(`/users/${id}/toggle`, {});
    carregarUsuarios();
  } catch (err) {
    alert("Erro ao atualizar status: " + err.message);
  }
};

/* ==========================
   EDITAR USUÁRIO
========================== */
window.editarUsuario = async function (id) {
  try {
    const users = await api.get("/users");
    const u = users.find((x) => x.id === id);
    if (!u) return;

    document.getElementById("edit-id").value       = id;
    document.getElementById("edit-nome").value     = u.nome;
    document.getElementById("edit-setor").value    = u.setor || "";
    document.getElementById("edit-telefone").value = u.telefone || "";
    document.getElementById("edit-role").value     = u.role;
    document.getElementById("modal-editar").classList.remove("hidden");
  } catch (err) {
    alert("Erro ao carregar usuário: " + err.message);
  }
};

window.salvarEdicao = async function () {
  const id       = document.getElementById("edit-id").value;
  const nome     = document.getElementById("edit-nome").value.trim();
  const setor    = document.getElementById("edit-setor").value.trim();
  const telefone = document.getElementById("edit-telefone").value.trim();
  const role     = document.getElementById("edit-role").value;

  if (!nome || !setor || !telefone) { alert("Preencha todos os campos"); return; }

  try {
    await api.patch(`/users/${id}`, { nome, setor, telefone, role });
    alert("Usuário atualizado com sucesso!");
    fecharModal();
    carregarUsuarios();
  } catch (err) {
    alert("Erro ao atualizar: " + err.message);
  }
};

window.fecharModal = function () {
  document.getElementById("modal-editar").classList.add("hidden");
};

/* ==========================
   CADASTRO DE USUÁRIOS
========================== */
const formUser = document.getElementById("form-user");
if (formUser) {
  formUser.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (window.userRole !== "master") {
      alert("Acesso negado: apenas usuários master podem cadastrar.");
      return;
    }

    const nome     = document.getElementById("user-nome").value.trim();
    const cpf      = document.getElementById("user-cpf").value.trim();
    const email    = document.getElementById("user-email").value.trim();
    const setor    = document.getElementById("user-setor").value.trim();
    const telefone = document.getElementById("user-telefone").value.trim();
    const senha    = document.getElementById("user-senha").value.trim();
    const role     = document.getElementById("user-role").value;

    if (!nome || !cpf || !email || !setor || !telefone || !senha) {
      alert("Preencha todos os campos.");
      return;
    }

    try {
      await api.post("/users", { nome, cpf, email, setor, telefone, senha, role });
      alert("Usuário cadastrado com sucesso!");
      formUser.reset();
      carregarUsuarios();
    } catch (err) {
      let msg = "Erro ao cadastrar usuário";
      if (err.data?.error?.includes("Unique")) msg = "E-mail já cadastrado";
      alert(msg);
    }
  });
}

carregarUsuarios();
