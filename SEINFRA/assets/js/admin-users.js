"use strict";

import { api } from "./api.js";

const ROLE_LABEL = {
  visita: "Visita",
  os: "OS",
  admin: "Administrador",
  master: "Master",
};

const ROLE_COLOR = {
  visita: "#6c757d",
  os:     "#0d6efd",
  admin:  "#fd7e14",
  master: "#dc3545",
};

/* ==========================
   LISTAGEM DE USUÁRIOS
========================== */
async function carregarUsuarios() {
  const lista = document.getElementById("lista-usuarios");
  if (!lista) return;
  lista.innerHTML = "<p style='color:#888'>Carregando...</p>";

  try {
    const users = await api.get("/users");

    if (!users.length) {
      lista.innerHTML = "<p>Nenhum usuário cadastrado.</p>";
      return;
    }

    lista.innerHTML = users.map((u) => {
      const roleLabel = ROLE_LABEL[u.role] || u.role;
      const roleColor = ROLE_COLOR[u.role] || "#6c757d";
      return `
        <div class="user-card">
          <div class="user-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <h4 style="margin:0">${u.nome}</h4>
              <span style="background:${roleColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">
                ${roleLabel}
              </span>
            </div>
            <span class="${u.ativo ? "status-ativo" : "status-inativo"}">
              ${u.ativo ? "● Ativo" : "● Inativo"}
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
            <button onclick="excluirUsuario('${u.id}', '${u.nome.replace(/'/g, "\\'")}')" class="btn-delete">🗑 Excluir</button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    lista.innerHTML = `<p style="color:red">Erro ao carregar usuários: ${err.message}</p>`;
  }
}

/* ==========================
   EXCLUIR USUÁRIO
========================== */
window.excluirUsuario = async function (id, nome) {
  const result = await Swal.fire({
    title: "Excluir usuário?",
    text: `O usuário "${nome}" será removido permanentemente.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  });
  if (!result.isConfirmed) return;

  try {
    await api.delete(`/users/${id}`);
    Swal.fire({ title: "Excluído!", text: "Usuário removido com sucesso.", icon: "success", timer: 1500, showConfirmButton: false });
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
    Swal.fire("Erro", "Não foi possível alterar o status: " + err.message, "error");
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
    document.getElementById("edit-senha").value    = "";
    document.getElementById("modal-editar").classList.remove("hidden");
  } catch (err) {
    Swal.fire("Erro", "Não foi possível carregar usuário: " + err.message, "error");
  }
};

window.salvarEdicao = async function () {
  const id    = document.getElementById("edit-id").value;
  const nome  = document.getElementById("edit-nome").value.trim();
  const setor = document.getElementById("edit-setor").value.trim();
  const tel   = document.getElementById("edit-telefone").value.trim();
  const role  = document.getElementById("edit-role").value;
  const senha = document.getElementById("edit-senha").value.trim();

  if (!nome) { Swal.fire("Atenção", "O nome é obrigatório.", "warning"); return; }
  if (senha && senha.length < 6) { Swal.fire("Atenção", "A senha deve ter no mínimo 6 caracteres.", "warning"); return; }

  const payload = { nome, setor, telefone: tel, role };
  if (senha) payload.senha = senha;

  try {
    await api.patch(`/users/${id}`, payload);
    Swal.fire({ title: "Salvo!", text: "Usuário atualizado com sucesso.", icon: "success", timer: 1500, showConfirmButton: false });
    fecharModal();
    carregarUsuarios();
  } catch (err) {
    Swal.fire("Erro", "Não foi possível atualizar: " + err.message, "error");
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
      Swal.fire("Acesso negado", "Apenas usuários master podem cadastrar novos usuários.", "error");
      return;
    }

    const nome     = document.getElementById("user-nome").value.trim();
    const cpf      = document.getElementById("user-cpf").value.trim();
    const email    = document.getElementById("user-email").value.trim();
    const setor    = document.getElementById("user-setor").value.trim();
    const telefone = document.getElementById("user-telefone").value.trim();
    const senha    = document.getElementById("user-senha").value.trim();
    const role     = document.getElementById("user-role").value;

    if (!nome || !email || !senha) {
      Swal.fire("Atenção", "Nome, e-mail e senha são obrigatórios.", "warning");
      return;
    }
    if (senha.length < 6) {
      Swal.fire("Atenção", "A senha deve ter no mínimo 6 caracteres.", "warning");
      return;
    }

    try {
      await api.post("/users", { nome, cpf, email, setor, telefone, senha, role });
      Swal.fire({ title: "Cadastrado!", text: `Usuário "${nome}" criado com sucesso.`, icon: "success", timer: 2000, showConfirmButton: false });
      formUser.reset();
      carregarUsuarios();
    } catch (err) {
      const msg = err.data?.error?.includes?.("Unique") || err.message?.includes?.("email")
        ? "Este e-mail já está cadastrado no sistema."
        : "Erro ao cadastrar usuário: " + err.message;
      Swal.fire("Erro", msg, "error");
    }
  });
}

carregarUsuarios();
