// db.js — Operações de visitas e pessoas via REST API

import { api } from "../api.js";
import { setVisits, setPersons } from "./state.js";

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
  catch { /* quota cheia */ }
}

function invalidarCache(chave) {
  try { sessionStorage.removeItem(chave); } catch { }
}

/* =========================
   VISITAS
========================= */
export async function loadVisits() {
  const cached = lerCache("visitas");
  if (cached) { setVisits(cached); return cached; }

  const lista = await api.get("/visits?limit=300");
  const arr = Array.isArray(lista) ? lista : (lista.visitas || []);
  setVisits(arr);
  gravarCache("visitas", arr);
  return arr;
}

export async function saveVisit(data) {
  const result = await api.post("/visits", data);
  invalidarCache("visitas");
  return result;
}

export async function updateVisit(id, data) {
  await api.patch(`/visits/${id}`, data);
  invalidarCache("visitas");
}

export async function deleteVisit(id) {
  await api.delete(`/visits/${id}`);
  invalidarCache("visitas");
}

/* =========================
   PESSOAS
========================= */
export async function loadPersons() {
  const cached = lerCache("pessoas");
  if (cached) { setPersons(cached); return cached; }

  const lista = await api.get("/contacts?limit=500");
  const arr = Array.isArray(lista) ? lista : (lista.pessoas || []);
  setPersons(arr);
  gravarCache("pessoas", arr);
  return arr;
}

export async function savePerson(name, phone) {
  const result = await api.post("/contacts", { name, phone });
  invalidarCache("pessoas");
  return result;
}
