// ============================================================
// termos.js — Termos de Uso do Sistema de Visitas
// ============================================================

import { auth } from "../firebase.js";
import { salvarAceiteTermos, verificarAceiteTermos } from "../firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   VERIFICAR AO LOGAR
========================= */
export async function verificarTermos(userId) {
  try {
    const jaAceitou = await verificarAceiteTermos(userId);
    if (!jaAceitou) abrirModalTermos();
  } catch (e) {
    console.error("Erro ao verificar termos:", e);
  }
}

function abrirModalTermos() {
  const modal = document.getElementById("modal-termos");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("show");
  }
}

/* =========================
   ACEITAR
========================= */
export async function aceitarTermos() {
  const userId = window._userId;
  if (!userId) return;
  try {
    await salvarAceiteTermos(userId);
    const modal = document.getElementById("modal-termos");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("show");
    }
  } catch (e) {
    console.error("Erro ao salvar aceite:", e);
    alert("Erro ao registrar aceite. Tente novamente.");
  }
}

/* =========================
   RECUSAR
========================= */
export async function recusarTermos() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  } finally {
    window.location.replace("index.html");
  }
}

/* =========================
   REABRIR (rodapé)
========================= */
export async function reabrirTermos() {
  const modal = document.getElementById("modal-termos");
  if (!modal) return;

  const userId = window._userId;
  const jaAceitou = userId ? await verificarAceiteTermos(userId) : false;

  const btnRecusar = document.getElementById("btn-recusar-termos");
  const btnAceitar = document.getElementById("btn-aceitar-termos");
  const msgAceito  = document.getElementById("msg-termos-aceito");

  if (jaAceitou) {
    if (btnRecusar) { btnRecusar.disabled = true; btnRecusar.style.opacity = "0.5"; btnRecusar.style.cursor = "not-allowed"; }
    if (btnAceitar) { btnAceitar.disabled = true; btnAceitar.style.opacity = "0.5"; btnAceitar.style.cursor = "not-allowed"; }
    if (msgAceito)  msgAceito.style.display = "flex";
  } else {
    if (btnRecusar) { btnRecusar.disabled = false; btnRecusar.style.opacity = "1"; btnRecusar.style.cursor = "pointer"; }
    if (btnAceitar) { btnAceitar.disabled = false; btnAceitar.style.opacity = "1"; btnAceitar.style.cursor = "pointer"; }
    if (msgAceito)  msgAceito.style.display = "none";
  }

  modal.classList.remove("hidden");
  modal.classList.add("show");
}

/* =========================
   FECHAR (ESC / clique fora)
========================= */
async function fecharTermosSeAceito() {
  const userId = window._userId;
  const jaAceitou = userId ? await verificarAceiteTermos(userId) : false;
  if (!jaAceitou) return;
  const modal = document.getElementById("modal-termos");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  }
}

export function inicializarEventosTermos() {
  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") await fecharTermosSeAceito();
  });

  document.getElementById("modal-termos")?.addEventListener("click", async function (e) {
    if (e.target === this) await fecharTermosSeAceito();
  });
}