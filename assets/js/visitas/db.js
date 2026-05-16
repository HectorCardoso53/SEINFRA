// ============================================================
// db.js — Operações com Firestore (visitas e pessoas)
// ============================================================

import { db } from "../firebase.js";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { setVisits, setPersons } from "./state.js";
import { registrar } from "../auditoria.js";

const CACHE_TTL = 5 * 60 * 1000;

function lerCache(chave) {
  try {
    const item = sessionStorage.getItem(chave);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function gravarCache(chave, data) {
  try { sessionStorage.setItem(chave, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* quota cheia — ignora */ }
}

function invalidarCache(chave) {
  try { sessionStorage.removeItem(chave); } catch { /* ignora */ }
}

/* =========================
   VISITAS
========================= */
export async function loadVisits() {
  const cached = lerCache("visitas");
  if (cached) { setVisits(cached); return cached; }

  const q = query(
    collection(db, "visitas"),
    orderBy("createdAt", "desc"),
    limit(300)
  );
  const snapshot = await getDocs(q);
  const lista = [];
  snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, ...docSnap.data() }));
  setVisits(lista);
  gravarCache("visitas", lista);
  return lista;
}

export async function saveVisit(data) {
  const result = await addDoc(collection(db, "visitas"), {
    ...data,
    createdAt: new Date().toISOString(),
  });
  invalidarCache("visitas");
  await registrar("criar_visita", "visitas", result.id, { nome: data.name || null });
  return result;
}

export async function updateVisit(id, data) {
  await updateDoc(doc(db, "visitas", id), data);
  invalidarCache("visitas");
  await registrar("editar_visita", "visitas", id, { campos: Object.keys(data) });
}

export async function deleteVisit(id) {
  await deleteDoc(doc(db, "visitas", id));
  invalidarCache("visitas");
  await registrar("excluir_visita", "visitas", id, {});
}

/* =========================
   PESSOAS
========================= */
export async function loadPersons() {
  const cached = lerCache("pessoas");
  if (cached) { setPersons(cached); return cached; }

  const snapshot = await getDocs(
    query(collection(db, "pessoas"), orderBy("name", "asc"), limit(500))
  );
  const lista = [];
  snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, ...docSnap.data() }));
  setPersons(lista);
  gravarCache("pessoas", lista);
  return lista;
}

export async function savePerson(name, phone) {
  const result = await addDoc(collection(db, "pessoas"), {
    name,
    phone,
    createdAt: new Date().toISOString(),
  });
  invalidarCache("pessoas");
  return result;
}
