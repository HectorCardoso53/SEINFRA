"use strict";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where, // 🔥 FALTAVA ISSO
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  startAfter,
  deleteDoc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth } from "./firebase.js";

export const db = getFirestore();

export async function buscarResumoDashboard() {
  const ref = doc(db, "estatisticas", "dashboard");

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      total: 0,
      abertas: 0,
      andamento: 0,
      encerradas: 0,
      totalMateriais: 0,
    };
  }

  return snap.data();
}
/*
async function atualizarEstatisticasCriacao(ordem) {
  const ref = doc(db, "estatisticas", "dashboard");

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    let dados = {
      total: 0,
      abertas: 0,
      andamento: 0,
      encerradas: 0,
      totalMateriais: 0,
    };

    if (snap.exists()) {
      dados = snap.data();
    }

    dados.total += 1;

    if (ordem.status === "Aberta") dados.abertas += 1;
    if (ordem.status === "Em andamento") dados.andamento += 1;
    if (ordem.status === "Encerrada") dados.encerradas += 1;

    if (ordem.materiais) {
      dados.totalMateriais += ordem.materiais.length;
    }

    transaction.set(ref, dados);
  });
}
*/

export async function buscarOrdensDashboard() {
  const q = query(collection(db, "ordens"), orderBy("dataAbertura", "desc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function buscarOrdensPaginadas(ultimaDoc = null, limite = 20) {
  let q;

  if (ultimaDoc) {
    q = query(
      collection(db, "ordens"),
      orderBy("numeroSequencial", "desc"),
      startAfter(ultimaDoc),
      limit(limite),
    );
  } else {
    q = query(
      collection(db, "ordens"),
      orderBy("numeroSequencial", "desc"),
      limit(limite),
    );
  }

  const snapshot = await getDocs(q);

  const lista = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const ultimoDocumento = snapshot.docs[snapshot.docs.length - 1];

  return {
    lista,
    ultimoDocumento,
  };
}
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
        ultimoNumero: ultimo + 1,
      });
    } else {
      transaction.set(ref, {
        ultimoNumero: 1,
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
    limit(qtd),
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
  const operacoes = materiais.map(async (mat) => {
    if (!mat.quantidade) return;

    const idMaterial = normalizarNome(mat.nome);
    const ref = doc(db, "materiais", idMaterial);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);

      if (!snap.exists()) return;

      const atual = snap.data().estoque || 0;

      if (atual < mat.quantidade) {
        throw new Error(`Estoque insuficiente para ${mat.nome}`);
      }

      transaction.update(ref, {
        estoque: atual - mat.quantidade,
      });
    });
  });

  await Promise.all(operacoes);
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
    ultimoNumero: maior,
  });

  console.log("contador sincronizado:", maior);
}
/* =========================
   SALVAR ORDEM
========================= */
export async function salvarOrdemFirestore(ordem) {
  return await runTransaction(db, async (transaction) => {
    const ano = new Date().getFullYear();
    const contadorRef = doc(db, "contadores", "os_" + ano);

    const snap = await transaction.get(contadorRef);

    let baseNumero = 0;

    if (snap.exists()) {
      baseNumero = snap.data().ultimoNumero || 0;
    }

    // 🔥 CONTROLE DE TENTATIVA (ANTI-COLISÃO)
    const tentativaMax = 10;
    let tentativa = 0;

    let numeroFinal;
    let numeroOS;
    let ordemRef;

    while (tentativa < tentativaMax) {
      const numero = baseNumero + 1 + tentativa;

      const numeroFormatado = String(numero).padStart(3, "0");
      numeroOS = `OS ${numeroFormatado}/${ano} - SEINFRA`;

      const idSeguro = numeroOS.replace(/\//g, "-");
      ordemRef = doc(db, "ordens", idSeguro);

      const jaExiste = await transaction.get(ordemRef);

      if (!jaExiste.exists()) {
        numeroFinal = numero;
        break;
      }

      tentativa++;
    }

    // 🚨 SE NÃO CONSEGUIR GERAR
    if (!numeroFinal) {
      throw new Error("Falha ao gerar número único para OS");
    }

    // 🔥 ATUALIZA CONTADOR COM O NÚMERO REAL
    if (snap.exists()) {
      transaction.update(contadorRef, {
        ultimoNumero: numeroFinal,
      });
    } else {
      transaction.set(contadorRef, {
        ultimoNumero: numeroFinal,
      });
    }

    // 🔥 SALVA ORDEM
    transaction.set(ordemRef, {
      ...ordem,
      numero: numeroOS,
      numeroSequencial: numeroFinal,
      criadoEm: new Date(),
      criadoPor: auth.currentUser?.email || "sistema",
    });

    return {
      id: ordemRef.id,
      numero: numeroOS,
    };
  });
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

  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const ordem = snap.data();

  await deleteDoc(ref);

  const refStats = doc(db, "estatisticas", "dashboard");

  await runTransaction(db, async (transaction) => {
    const statsSnap = await transaction.get(refStats);

    if (!statsSnap.exists()) return;

    let dados = statsSnap.data();

    dados.total -= 1;

    if (ordem.status === "Aberta") dados.abertas -= 1;
    if (ordem.status === "Em andamento") dados.andamento -= 1;
    if (ordem.status === "Encerrada") dados.encerradas -= 1;

    if (ordem.materiais) {
      dados.totalMateriais -= ordem.materiais.length;
    }

    transaction.set(refStats, dados);
  });
}

export async function reconstruirDashboard() {
  const snapshot = await getDocs(collection(db, "ordens"));

  let total = 0;
  let abertas = 0;
  let andamento = 0;
  let encerradas = 0;
  let totalMateriais = 0;

  snapshot.forEach((docSnap) => {
    const o = docSnap.data();

    total++;

    if (o.status === "Aberta") abertas++;
    if (o.status === "Em andamento") andamento++;
    if (o.status === "Encerrada") encerradas++;

    if (o.materiais) {
      totalMateriais += o.materiais.length;
    }
  });

  await setDoc(doc(db, "estatisticas", "dashboard"), {
    total,
    abertas,
    andamento,
    encerradas,
    totalMateriais,
  });

  console.log("Dashboard reconstruído com sucesso");
}

window.reordenarTudo = async function () {
  const snapshot = await getDocs(collection(db, "ordens"));

  const lista = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    lista.push({
      id: docSnap.id,
      ...data,
    });
  });

  // ordena por data de criação (mais antigo primeiro)
  lista.sort((a, b) => {
    const t1 = a.criadoEm?.seconds || 0;
    const t2 = b.criadoEm?.seconds || 0;
    return t1 - t2;
  });

  console.log("Total de OS:", lista.length);

  let contador = 1;
  const ano = new Date().getFullYear();

  for (const o of lista) {
    const numeroFormatado = String(contador).padStart(3, "0");
    const novoNumero = `OS ${numeroFormatado}/${ano} - SEINFRA`;

    await updateDoc(doc(db, "ordens", o.id), {
      numero: novoNumero,
      numeroSequencial: contador,
    });

    console.log("✔", o.id, "→", novoNumero);

    contador++;
  }

  console.log("🔥 REORDENAÇÃO FINALIZADA");
};

window.reconstruirDashboard = reconstruirDashboard;

window.listarDuplicadas = async function () {
  const lista = await buscarOrdensDashboard();

  const mapa = {};

  lista.forEach((o) => {
    if (!mapa[o.numero]) {
      mapa[o.numero] = [];
    }
    mapa[o.numero].push(o);
  });

  Object.keys(mapa).forEach((numero) => {
    if (mapa[numero].length > 1) {
      console.log("💥 DUPLICADA:", numero, mapa[numero]);
    }
  });
};

window.analisarDuplicadas = async function () {
  const lista = await buscarOrdensDashboard();

  const mapa = {};

  // Agrupa por número
  lista.forEach((o) => {
    if (!mapa[o.numero]) mapa[o.numero] = [];
    mapa[o.numero].push(o);
  });

  Object.keys(mapa).forEach((numero) => {
    const grupo = mapa[numero];

    if (grupo.length < 2) return;

    console.log("=================================");
    console.log("💥 DUPLICADA:", numero);

    const [a, b] = grupo;

    const campos = new Set([...Object.keys(a), ...Object.keys(b)]);

    campos.forEach((campo) => {
      const v1 = a[campo];
      const v2 = b[campo];

      if (JSON.stringify(v1) !== JSON.stringify(v2)) {
        console.log(`🔸 ${campo}:`);
        console.log("   A:", v1);
        console.log("   B:", v2);
      }
    });

    console.log("=================================");
  });
};

window.corrigirDuplicadas = async function () {
  const lista = await buscarOrdensDashboard();

  const mapa = {};

  lista.forEach((o) => {
    if (!mapa[o.numero]) mapa[o.numero] = [];
    mapa[o.numero].push(o);
  });

  for (const numero in mapa) {
    const grupo = mapa[numero];

    if (grupo.length < 2) continue;

    console.log("⚠️ Corrigindo:", numero);

    // mantém o mais antigo
    grupo.sort((a, b) => {
      const t1 = a.criadoEm?.seconds || 0;
      const t2 = b.criadoEm?.seconds || 0;
      return t1 - t2;
    });

    const manter = grupo[0];

    for (let i = 1; i < grupo.length; i++) {
      const o = grupo[i];

      let novoNumero;
      let existe = true;

      // 🔥 LOOP ATÉ ACHAR UM NÚMERO LIVRE
      while (existe) {
        novoNumero = await gerarNumeroOS();

        const q = query(
          collection(db, "ordens"),
          where("numero", "==", novoNumero),
        );

        const snap = await getDocs(q);

        existe = !snap.empty;
      }

      const match = novoNumero.match(/OS\s*(\d+)/);
      const numeroSequencial = match ? parseInt(match[1]) : 0;

      await atualizarOrdemFirestore(o.id, {
        numero: novoNumero,
        numeroSequencial: numeroSequencial,
      });

      console.log("✔ Atualizado:", o.id, "→", novoNumero);
    }
  }

  console.log("🔥 Correção finalizada (SEM duplicação)");
};

window.reconstruirDashboard = reconstruirDashboard;
window.sincronizarContadorOS = sincronizarContadorOS;
