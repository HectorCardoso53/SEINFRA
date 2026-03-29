// ============================================================
// db.js — Operações com Firestore (visitas e pessoas)
// ============================================================

import { db } from "../firebase.js";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { setVisits, setPersons } from "./state.js";

/* =========================
   VISITAS
========================= */
export async function loadVisits() {
  const q = query(
    collection(db, "visitas"),
    orderBy("createdAt", "desc"),
    limit(300)
  );
  const snapshot = await getDocs(q);
  const lista = [];
  snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, ...docSnap.data() }));
  setVisits(lista);
  return lista;
}

export async function saveVisit(data) {
  return await addDoc(collection(db, "visitas"), {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export async function updateVisit(id, data) {
  await updateDoc(doc(db, "visitas", id), data);
}

export async function deleteVisit(id) {
  await deleteDoc(doc(db, "visitas", id));
}

/* =========================
   PESSOAS
========================= */
export async function loadPersons() {
  const snapshot = await getDocs(
    query(collection(db, "pessoas"), orderBy("name", "asc"), limit(500))
  );
  const lista = [];
  snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, ...docSnap.data() }));
  setPersons(lista);
  return lista;
}

export async function savePerson(name, phone) {
  return await addDoc(collection(db, "pessoas"), {
    name,
    phone,
    createdAt: new Date().toISOString(),
  });
}
