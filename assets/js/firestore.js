import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  where,
  setDoc,
  getDoc,
  updateDoc,
  startAfter,
  deleteDoc,
  runTransaction,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";

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
  console.log("🔥 BUSCANDO ORDENS (dashboard)");
  const q = query(
    collection(db, "ordens"),
    orderBy("numeroSequencial", "desc"),
    limit(20), // 🔥 obrigatório
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

}

export async function buscarTodasOrdens() {
  const q = query(
    collection(db, "ordens"),
    orderBy("numeroSequencial", "desc"),
    limit(500) // 🔥 LIMITE
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}


export async function buscarOrdensPaginadas(ultimaDoc = null, limite = 20) {
  console.log("🔥 BUSCANDO ORDENS (paginadas)");
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

export async function buscarOrdensComFiltro({
  status,
  setorResponsavel,
  dataInicio,
  dataFim,
}) {
  let constraints = [];

  // 🔥 DATA (PRIORIDADE)
  if (dataInicio) {
    constraints.push(where("dataAbertura", ">=", dataInicio));
  }

  if (dataFim) {
    constraints.push(where("dataAbertura", "<=", dataFim));
  }

  // 🔥 OUTROS FILTROS
  if (status) {
    constraints.push(where("status", "==", status));
  }

  if (setorResponsavel) {
    constraints.push(where("setorResponsavel", "==", setorResponsavel));
  }

  // 🔥 OBRIGATÓRIO quando usa intervalo
  constraints.push(orderBy("dataAbertura", "desc"));

  const q = query(collection(db, "ordens"), ...constraints);

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
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
    const statsRef = doc(db, "estatisticas", "dashboard");

    // 🔥 LEITURAS
    const snap = await transaction.get(contadorRef);
    const statsSnap = await transaction.get(statsRef);

    let numeroFinal = 1;

    if (snap.exists()) {
      numeroFinal = (snap.data().ultimoNumero || 0) + 1;
    }

    const numeroFormatado = String(numeroFinal).padStart(3, "0");
    const numeroOS = `OS ${numeroFormatado}/${ano} - SEINFRA`;

    const ordemRef = doc(collection(db, "ordens"));

    // 🔥 CONTADOR
    if (snap.exists()) {
      transaction.update(contadorRef, {
        ultimoNumero: numeroFinal,
      });
    } else {
      transaction.set(contadorRef, {
        ultimoNumero: 1,
      });
    }

    // 🔥 SALVA ORDEM
    // 🔥 SALVA ORDEM
    transaction.set(ordemRef, {
      ...ordem,

      // 🔥 GARANTE QUE SEMPRE É ARRAY
      materiais: Array.isArray(ordem.materiais) ? ordem.materiais : [],

      numero: numeroOS,
      numeroSequencial: numeroFinal,
      criadoEm: new Date(),
      criadoPor: auth.currentUser?.email || "sistema",
    });

    // 🔥 DASHBOARD
    if (!statsSnap.exists()) {
      const meses = new Array(12).fill(0);

      const data = new Date(ordem.dataAbertura);

      if (!isNaN(data)) {
        meses[data.getMonth()] = 1;
      }

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
      } else {
        console.warn("Data inválida:", ordem.dataAbertura);
      }

      transaction.update(statsRef, {
        total: (stats.total || 0) + 1,
        abertas: (stats.abertas || 0) + 1,
        totalMateriais:
          (stats.totalMateriais || 0) + (ordem.materiais?.length || 0),
        ordensPorMes: meses,
      });
    }

    return {
      id: ordemRef.id,
      numero: numeroOS,
    };
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

    // 🔥 validação básica
    if (!novoStatus) return;

    // 🔥 se não mudou, não faz nada
    if (statusAntigo === novoStatus) {
      transaction.update(ordemRef, dadosAtualizacao);
      return;
    }

    const stats = statsSnap.data();

    // 🔥 cria novo objeto (não muta direto)
    let novasStats = {
      total: stats.total || 0,
      abertas: stats.abertas || 0,
      andamento: stats.andamento || 0,
      encerradas: stats.encerradas || 0,
      totalMateriais: stats.totalMateriais || 0,
    };

    // 🔥 REMOVE DO ANTIGO
    if (statusAntigo === "Aberta")
      novasStats.abertas = Math.max(0, novasStats.abertas - 1);
    if (statusAntigo === "Em andamento")
      novasStats.andamento = Math.max(0, novasStats.andamento - 1);
    if (statusAntigo === "Encerrada")
      novasStats.encerradas = Math.max(0, novasStats.encerradas - 1);

    // 🔥 ADICIONA NO NOVO
    if (novoStatus === "Aberta") novasStats.abertas += 1;
    if (novoStatus === "Em andamento") novasStats.andamento += 1;
    if (novoStatus === "Encerrada") novasStats.encerradas += 1;

    // 🔥 ATUALIZA ORDEM
    transaction.update(ordemRef, dadosAtualizacao);

    // 🔥 ATUALIZA DASHBOARD
    transaction.update(statsRef, novasStats);
  });
}
/* =========================
   BUSCAR ORDENS
========================= */
export async function buscarOrdensFirestore() {
  console.log("🔥 BUSCANDO TODAS AS ORDENS (PERIGO)");
  const snapshot = await getDocs(collection(db, "ordens"));

  const lista = [];

  return lista;
}

/* =========================
   ATUALIZAR ORDEM
========================= */
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

    // ========================
    // 🔥 STATUS
    // ========================
    if (novosDados.status && novosDados.status !== ordemAntiga.status) {
      // remove antigo
      if (ordemAntiga.status === "Aberta") {
        novosStats.abertas = Math.max(0, novosStats.abertas - 1);
      }

      if (ordemAntiga.status === "Em andamento") {
        novosStats.andamento = Math.max(0, novosStats.andamento - 1);
      }

      if (ordemAntiga.status === "Encerrada") {
        novosStats.encerradas = Math.max(0, novosStats.encerradas - 1);
      }

      // adiciona novo
      if (novosDados.status === "Aberta") novosStats.abertas++;
      if (novosDados.status === "Em andamento") novosStats.andamento++;
      if (novosDados.status === "Encerrada") novosStats.encerradas++;
    }

    // ========================
    // 🔥 MATERIAIS
    // ========================
    if (novosDados.materiais) {
      const antigos = ordemAntiga.materiais?.length || 0;
      const novos = novosDados.materiais?.length || 0;

      novosStats.totalMateriais += novos - antigos;
    }

    // ========================
    // 🔥 DATA (GRÁFICO)
    // ========================
    if (
      novosDados.dataAbertura &&
      novosDados.dataAbertura !== ordemAntiga.dataAbertura
    ) {
      const antiga = new Date(ordemAntiga.dataAbertura);
      const nova = new Date(novosDados.dataAbertura);

      if (!isNaN(antiga)) {
        const mesAntigo = antiga.getMonth();
        novosStats.ordensPorMes[mesAntigo] = Math.max(
          0,
          novosStats.ordensPorMes[mesAntigo] - 1,
        );
      }

      if (!isNaN(nova)) {
        const mesNovo = nova.getMonth();
        novosStats.ordensPorMes[mesNovo] =
          (novosStats.ordensPorMes[mesNovo] || 0) + 1;
      }
    }

    // ========================
    // 🔥 UPDATE FINAL
    // ========================
    transaction.update(ordemRef, novosDados);
    transaction.update(statsRef, novosStats);
  });
}

/* =========================
   EXCLUIR ORDEM
========================= */
export async function excluirOrdemFirestore(id) {
  const ref = doc(db, "ordens", id);
  const refStats = doc(db, "estatisticas", "dashboard");

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const statsSnap = await transaction.get(refStats);

    if (!snap.exists() || !statsSnap.exists()) return;

    const ordem = snap.data();
    const dados = statsSnap.data();

    // 🔥 REMOVE ORDEM
    transaction.delete(ref);

    // 🔥 TOTAL
    dados.total = Math.max(0, (dados.total || 0) - 1);

    // 🔥 STATUS
    if (ordem.status === "Aberta") {
      dados.abertas = Math.max(0, (dados.abertas || 0) - 1);
    }

    if (ordem.status === "Em andamento") {
      dados.andamento = Math.max(0, (dados.andamento || 0) - 1);
    }

    if (ordem.status === "Encerrada") {
      dados.encerradas = Math.max(0, (dados.encerradas || 0) - 1);
    }

    // 🔥 MATERIAIS
    if (ordem.materiais) {
      dados.totalMateriais = Math.max(
        0,
        (dados.totalMateriais || 0) - ordem.materiais.length,
      );
    }

    // 🔥 CORREÇÃO DO GRÁFICO (AQUI ESTAVA TEU BUG)
    if (ordem.dataAbertura) {
      const data = new Date(ordem.dataAbertura);

      if (!isNaN(data)) {
        const mesIndex = data.getMonth();

        if (!dados.ordensPorMes) {
          dados.ordensPorMes = new Array(12).fill(0);
        }

        if (dados.ordensPorMes[mesIndex] > 0) {
          dados.ordensPorMes[mesIndex] -= 1;
        }
      } else {
        console.warn("Data inválida ao excluir:", ordem.dataAbertura);
      }
    }

    // 🔥 SALVA
    transaction.update(refStats, dados);
  });
}

export async function reconstruirDashboard() {
  console.log("🔥 RECONSTRUINDO DASHBOARD (LEITURA MASSIVA)");
  if (!window.isAdmin) {
    console.warn("Acesso negado");
    return;
  }

  console.warn("⚠️ RECONSTRUINDO DASHBOARD...");

  const snapshot = await getDocs(collection(db, "ordens"));

  let total = 0;
  let abertas = 0;
  let andamento = 0;
  let encerradas = 0;
  let totalMateriais = 0;

  let ordensPorMes = new Array(12).fill(0);

  snapshot.forEach((docSnap) => {
    const o = docSnap.data();

    total++;

    if (o.status === "Aberta") abertas++;
    if (o.status === "Em andamento") andamento++;
    if (o.status === "Encerrada") encerradas++;

    if (o.materiais) {
      totalMateriais += o.materiais.length;
    }

    if (o.dataAbertura) {
      const data = new Date(o.dataAbertura);
      if (!isNaN(data)) {
        ordensPorMes[data.getMonth()]++;
      }
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

  return {
    id: snap.id,
    ...snap.data(),
  };
}
