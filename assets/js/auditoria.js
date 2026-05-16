"use strict";

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Registra uma entrada de auditoria no Firestore.
 * Nunca bloqueia a operação principal — erros são silenciosos.
 *
 * @param {string} acao       - ex: "criar_os", "excluir_visita"
 * @param {string} colecao    - coleção afetada
 * @param {string|null} docId - id do documento
 * @param {object} detalhes   - dados relevantes (sem CPF/senha)
 */
export async function registrar(acao, colecao, docId = null, detalhes = {}) {
  try {
    await addDoc(collection(db, "auditoria"), {
      acao,
      colecao,
      docId,
      detalhes,
      userId:   window._userId   || null,
      userName: window.userNome  || window._userName || "sistema",
      userRole: window.userRole  || null,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error("Auditoria falhou (não bloqueia operação):", e);
  }
}
