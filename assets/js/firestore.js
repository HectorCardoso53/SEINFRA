"use strict";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth } from "./firebase.js";

export const db = getFirestore();

/* =========================
   UTIL
========================= */
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
}

/* =========================
   GERAR NÚMERO DE OS SEGURO
========================= */
export async function gerarNumeroOS() {
  const ano = new Date().getFullYear();
  const ref = doc(db, "contadores", "os_" + ano);

  const numero = await runTransaction(db, async (transaction) => {

    const snap = await transaction.get(ref);

    let ultimo = 0;

    if (snap.exists()) {

      ultimo = snap.data().ultimoNumero || 0;

      transaction.update(ref, {
        ultimoNumero: ultimo + 1
      });

    } else {

      transaction.set(ref, {
        ultimoNumero: 1
      });

      return 1;
    }

    return ultimo + 1;

  });

  const numeroFormatado = String(numero).padStart(3, "0");

  return `OS ${numeroFormatado}/${ano} - SEINFRA`;
}


export async function buscarUltimasOrdensFirestore(qtd = 100) {

  const q = query(
    collection(db, "ordens"),
    orderBy("dataAbertura", "desc"),
    limit(qtd)
  );

  const snapshot = await getDocs(q);

  const lista = [];

  snapshot.forEach((docSnap) => {
    lista.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  return lista;
}


/* =========================
   DESCONTAR ESTOQUE
========================= */
async function descontarEstoque(materiais) {
  for (const mat of materiais) {
    if (!mat.quantidade) continue;

    const idMaterial = normalizarNome(mat.nome);
    const ref = doc(db, "materiais", idMaterial);

    const snap = await getDoc(ref);
    if (!snap.exists()) continue;

    const atual = snap.data().estoque || 0;

    if (atual < mat.quantidade) {
      throw new Error(`Estoque insuficiente para ${mat.nome}`);
    }

    await updateDoc(ref, {
      estoque: atual - mat.quantidade,
    });
  }
}

export async function consultarProximoNumeroOS() {

  const ano = new Date().getFullYear();
  const ref = doc(db, "contadores", "os_" + ano);

  const snap = await getDoc(ref);

  let proximo = 1;

  if (snap.exists()) {
    proximo = (snap.data().ultimoNumero || 0) + 1;
  }

  const numeroFormatado = String(proximo).padStart(3, "0");

  return `OS ${numeroFormatado}/${ano} - SEINFRA`;
}


export async function sincronizarContadorOS() {

  const snapshot = await getDocs(collection(db, "ordens"));

  let maior = 0;

  snapshot.forEach((docSnap) => {

    const numero = docSnap.data().numero;

    if (!numero) return;

    const match = numero.match(/OS\s*(\d+)/);

    if (match) {
      const n = parseInt(match[1]);

      if (n > maior) {
        maior = n;
      }
    }

  });

  const ano = new Date().getFullYear();

  await setDoc(doc(db, "contadores", "os_" + ano), {
    ultimoNumero: maior
  });

  console.log("contador sincronizado:", maior);

}
/* =========================
   SALVAR ORDEM
========================= */
export async function salvarOrdemFirestore(ordem) {

  const numeroOS = await gerarNumeroOS(); // 🔥 GERA O NÚMERO REAL

  ordem.numero = numeroOS;

  const ref = doc(collection(db, "ordens"));

  await setDoc(ref, {
    ...ordem,
    criadoEm: new Date(),
    criadoPor: auth.currentUser?.email || "sistema",
  });

  if (ordem.materiais && ordem.materiais.length > 0) {
    await descontarEstoque(ordem.materiais);
  }

  return numeroOS;
}


/* =========================
   BUSCAR ORDENS
========================= */
export async function buscarOrdensFirestore() {
  const snapshot = await getDocs(collection(db, "ordens"));

  const lista = [];

  snapshot.forEach((docSnap) => {
    lista.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  return lista;
}

/* =========================
   ATUALIZAR ORDEM
========================= */
export async function atualizarOrdemFirestore(id, dados) {
  const ref = doc(db, "ordens", id);

  await updateDoc(ref, dados);
}

/* =========================
   EXCLUIR ORDEM
========================= */
export async function excluirOrdemFirestore(id) {
  const ref = doc(db, "ordens", id);

  await deleteDoc(ref);
}
