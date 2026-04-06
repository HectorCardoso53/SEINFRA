import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  where,
  setDoc,
  getDoc,
  startAfter,
  runTransaction,
  getCountFromServer,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";

export async function buscarVisitasPorNome(nome) {
  const nomeUpper = nome.toUpperCase();
  const q = query(
    collection(db, "visitas"),
    where("name", ">=", nomeUpper),
    where("name", "<=", nomeUpper + "\uf8ff"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function contarOrdensFirestore() {
  const ref = collection(db, "ordens");
  const snapshot = await getCountFromServer(ref);
  return snapshot.data().count;
}

export async function buscarResumoDashboard() {
  const ref = doc(db, "estatisticas", "dashboard");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function buscarOrdensDashboard() {
  const q = query(
    collection(db, "ordens"),
    orderBy("numeroSequencial", "desc"),
    limit(20),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/* =========================
   🔑 SEM LIMITE — busca TODAS as ordens para filtros funcionarem
========================= */
export async function buscarTodasOrdens() {
  const q = query(
    collection(db, "ordens"),
    orderBy("numeroSequencial", "desc"),
    // ❌ limit(500) REMOVIDO — causava corte nos filtros
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const ultimoDocumento = snapshot.docs[snapshot.docs.length - 1];
  return { lista, ultimoDocumento };
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

export async function buscarOrdensComFiltro({
  status,
  setorResponsavel,
  dataInicio,
  dataFim,
}) {
  let constraints = [];
  if (dataInicio) constraints.push(where("dataAbertura", ">=", dataInicio));
  if (dataFim) constraints.push(where("dataAbertura", "<=", dataFim));
  if (status) constraints.push(where("status", "==", status));
  if (setorResponsavel)
    constraints.push(where("setorResponsavel", "==", setorResponsavel));
  constraints.push(orderBy("dataAbertura", "desc"));
  const q = query(collection(db, "ordens"), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function gerarNumeroOS() {
  const ano = new Date().getFullYear();
  const ref = doc(db, "contadores", "os_" + ano);
  const numero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    let ultimo = 0;
    if (snap.exists()) {
      ultimo = snap.data().ultimoNumero || 0;
      transaction.update(ref, { ultimoNumero: ultimo + 1 });
    } else {
      transaction.set(ref, { ultimoNumero: 1 });
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
  await getDocs(q);
  return [];
}

async function descontarEstoque(materiais) {
  const operacoes = materiais.map(async (mat) => {
    if (!mat.quantidade) return;
    const idMaterial = normalizarNome(mat.nome);
    const ref = doc(db, "materiais", idMaterial);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const atual = snap.data().estoque || 0;
      if (atual < mat.quantidade)
        throw new Error(`Estoque insuficiente para ${mat.nome}`);
      transaction.update(ref, { estoque: atual - mat.quantidade });
    });
  });
  await Promise.all(operacoes);
}

export async function consultarProximoNumeroOS() {
  const ano = new Date().getFullYear();
  const ref = doc(db, "contadores", "os_" + ano);
  const snap = await getDoc(ref);
  let proximo = 1;
  if (snap.exists()) proximo = (snap.data().ultimoNumero || 0) + 1;
  const numeroFormatado = String(proximo).padStart(3, "0");
  return `OS ${numeroFormatado}/${ano} - SEINFRA`;
}

export async function sincronizarContadorOS() {
  const snapshot = await getDocs(collection(db, "ordens"));
  let maior = 0;
  const ano = new Date().getFullYear();
  await setDoc(doc(db, "contadores", "os_" + ano), { ultimoNumero: maior });
  console.log("contador sincronizado:", maior);
}

export async function salvarOrdemFirestore(ordem) {
  return await runTransaction(db, async (transaction) => {
    const ano = new Date().getFullYear();
    const contadorRef = doc(db, "contadores", "os_" + ano);
    const statsRef = doc(db, "estatisticas", "dashboard");
    const snap = await transaction.get(contadorRef);
    const statsSnap = await transaction.get(statsRef);
    let numeroFinal = 1;
    if (snap.exists()) numeroFinal = (snap.data().ultimoNumero || 0) + 1;
    const numeroFormatado = String(numeroFinal).padStart(3, "0");
    const numeroOS = `OS ${numeroFormatado}/${ano} - SEINFRA`;
    const ordemRef = doc(collection(db, "ordens"));
    if (snap.exists()) {
      transaction.update(contadorRef, { ultimoNumero: numeroFinal });
    } else {
      transaction.set(contadorRef, { ultimoNumero: 1 });
    }
    transaction.set(ordemRef, {
      ...ordem,
      materiais: Array.isArray(ordem.materiais) ? ordem.materiais : [],
      numero: numeroOS,
      numeroSequencial: numeroFinal,
      criadoEm: new Date(),
      criadoPor: auth.currentUser?.email || "sistema",
    });
    if (!statsSnap.exists()) {
      const meses = new Array(12).fill(0);
      const data = new Date(ordem.dataAbertura);
      if (!isNaN(data)) meses[data.getMonth()] = 1;
      transaction.set(statsRef, {
        total: 1,
        abertas: 1,
        andamento: 0,
        encerradas: 0,
        totalMateriais: ordem.materiais?.length || 0,
        ordensPorMes: meses,
      });
    } else {
      const stats = statsSnap.data();
      let meses = stats.ordensPorMes || new Array(12).fill(0);
      const data = new Date(ordem.dataAbertura);
      if (!isNaN(data)) {
        const mesIndex = data.getMonth();
        meses[mesIndex] = (meses[mesIndex] || 0) + 1;
      }
      transaction.update(statsRef, {
        total: (stats.total || 0) + 1,
        abertas: (stats.abertas || 0) + 1,
        totalMateriais:
          (stats.totalMateriais || 0) + (ordem.materiais?.length || 0),
        ordensPorMes: meses,
      });
    }
    return { id: ordemRef.id, numero: numeroOS };
  });
}

export async function atualizarStatusComDashboard(id, dadosAtualizacao) {
  const ordemRef = doc(db, "ordens", id);
  const statsRef = doc(db, "estatisticas", "dashboard");
  await runTransaction(db, async (transaction) => {
    const ordemSnap = await transaction.get(ordemRef);
    const statsSnap = await transaction.get(statsRef);
    if (!ordemSnap.exists() || !statsSnap.exists()) return;
    const ordem = ordemSnap.data();
    const statusAntigo = ordem.status;
    const novoStatus = dadosAtualizacao.status;
    if (!novoStatus) return;
    if (statusAntigo === novoStatus) {
      transaction.update(ordemRef, dadosAtualizacao);
      return;
    }
    const stats = statsSnap.data();
    let novasStats = {
      total: stats.total || 0,
      abertas: stats.abertas || 0,
      andamento: stats.andamento || 0,
      encerradas: stats.encerradas || 0,
      totalMateriais: stats.totalMateriais || 0,
    };
    if (statusAntigo === "Aberta")
      novasStats.abertas = Math.max(0, novasStats.abertas - 1);
    if (statusAntigo === "Em andamento")
      novasStats.andamento = Math.max(0, novasStats.andamento - 1);
    if (statusAntigo === "Encerrada")
      novasStats.encerradas = Math.max(0, novasStats.encerradas - 1);
    if (novoStatus === "Aberta") novasStats.abertas += 1;
    if (novoStatus === "Em andamento") novasStats.andamento += 1;
    if (novoStatus === "Encerrada") novasStats.encerradas += 1;
    transaction.update(ordemRef, dadosAtualizacao);
    transaction.update(statsRef, novasStats);
  });
}

export async function buscarOrdensFirestore() {
  return [];
}

export async function atualizarOrdemComDashboard(id, novosDados) {
  const ordemRef = doc(db, "ordens", id);
  const statsRef = doc(db, "estatisticas", "dashboard");
  await runTransaction(db, async (transaction) => {
    const ordemSnap = await transaction.get(ordemRef);
    const statsSnap = await transaction.get(statsRef);
    if (!ordemSnap.exists() || !statsSnap.exists()) return;
    const ordemAntiga = ordemSnap.data();
    const stats = statsSnap.data();
    let novosStats = {
      total: stats.total || 0,
      abertas: stats.abertas || 0,
      andamento: stats.andamento || 0,
      encerradas: stats.encerradas || 0,
      totalMateriais: stats.totalMateriais || 0,
      ordensPorMes: stats.ordensPorMes || new Array(12).fill(0),
    };
    if (novosDados.status && novosDados.status !== ordemAntiga.status) {
      if (ordemAntiga.status === "Aberta")
        novosStats.abertas = Math.max(0, novosStats.abertas - 1);
      if (ordemAntiga.status === "Em andamento")
        novosStats.andamento = Math.max(0, novosStats.andamento - 1);
      if (ordemAntiga.status === "Encerrada")
        novosStats.encerradas = Math.max(0, novosStats.encerradas - 1);
      if (novosDados.status === "Aberta") novosStats.abertas++;
      if (novosDados.status === "Em andamento") novosStats.andamento++;
      if (novosDados.status === "Encerrada") novosStats.encerradas++;
    }
    if (novosDados.materiais) {
      const antigos = ordemAntiga.materiais?.length || 0;
      const novos = novosDados.materiais?.length || 0;
      novosStats.totalMateriais += novos - antigos;
    }
    if (
      novosDados.dataAbertura &&
      novosDados.dataAbertura !== ordemAntiga.dataAbertura
    ) {
      const antiga = new Date(ordemAntiga.dataAbertura);
      const nova = new Date(novosDados.dataAbertura);
      if (!isNaN(antiga))
        novosStats.ordensPorMes[antiga.getMonth()] = Math.max(
          0,
          novosStats.ordensPorMes[antiga.getMonth()] - 1,
        );
      if (!isNaN(nova))
        novosStats.ordensPorMes[nova.getMonth()] =
          (novosStats.ordensPorMes[nova.getMonth()] || 0) + 1;
    }
    transaction.update(ordemRef, novosDados);
    transaction.update(statsRef, novosStats);
  });
}

// Salva aceite dos termos no Firestore
export async function salvarAceiteTermos(userId) {
  await setDoc(doc(db, "termosAceitos", userId), {
    aceito: true,
    dataAceite: serverTimestamp(),
  });
}

// Verifica se o usuário já aceitou os termos
export async function verificarAceiteTermos(userId) {
  const snap = await getDoc(doc(db, "termosAceitos", userId));
  return snap.exists() && snap.data()?.aceito === true;
}

export async function excluirOrdemFirestore(id) {
  const ref = doc(db, "ordens", id);
  const refStats = doc(db, "estatisticas", "dashboard");
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const statsSnap = await transaction.get(refStats);
    if (!snap.exists() || !statsSnap.exists()) return;
    const ordem = snap.data();
    const dados = statsSnap.data();
    transaction.delete(ref);
    dados.total = Math.max(0, (dados.total || 0) - 1);
    if (ordem.status === "Aberta")
      dados.abertas = Math.max(0, (dados.abertas || 0) - 1);
    if (ordem.status === "Em andamento")
      dados.andamento = Math.max(0, (dados.andamento || 0) - 1);
    if (ordem.status === "Encerrada")
      dados.encerradas = Math.max(0, (dados.encerradas || 0) - 1);
    if (ordem.materiais)
      dados.totalMateriais = Math.max(
        0,
        (dados.totalMateriais || 0) - ordem.materiais.length,
      );
    if (ordem.dataAbertura) {
      const data = new Date(ordem.dataAbertura);
      if (!isNaN(data)) {
        const mesIndex = data.getMonth();
        if (!dados.ordensPorMes) dados.ordensPorMes = new Array(12).fill(0);
        if (dados.ordensPorMes[mesIndex] > 0) dados.ordensPorMes[mesIndex] -= 1;
      }
    }
    transaction.update(refStats, dados);
  });
}

export async function reconstruirDashboard() {
  if (!window.isAdmin) {
    console.warn("Acesso negado");
    return;
  }
  const snapshot = await getDocs(collection(db, "ordens"));
  let total = 0,
    abertas = 0,
    andamento = 0,
    encerradas = 0,
    totalMateriais = 0;
  let ordensPorMes = new Array(12).fill(0);
  snapshot.forEach((docSnap) => {
    const o = docSnap.data();
    total++;
    if (o.status === "Aberta") abertas++;
    if (o.status === "Em andamento") andamento++;
    if (o.status === "Encerrada") encerradas++;
    if (o.materiais) totalMateriais += o.materiais.length;
    if (o.dataAbertura) {
      const data = new Date(o.dataAbertura);
      if (!isNaN(data)) ordensPorMes[data.getMonth()]++;
    }
  });
  await setDoc(doc(db, "estatisticas", "dashboard"), {
    total,
    abertas,
    andamento,
    encerradas,
    totalMateriais,
    ordensPorMes,
  });
  console.log("✅ Dashboard reconstruído");
}

export async function buscarOrdemPorId(id) {
  const ref = doc(db, "ordens", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function buscarVisitaPorId(id) {
  const docRef = doc(db, "visitas", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
