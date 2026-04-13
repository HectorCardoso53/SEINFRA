// ============================================================
// state.js — Estado global compartilhado entre módulos
// ============================================================

export let visits = [];
export let persons = [];
export let editingId = null;
export let currentPage = 1;
export let filterDate = "";
export let filterService = "";
export let searchTerm = "";
export let filterDateStart = "";
export let filterDateEnd = "";
export let chartService = null;
export let chartMonth = null;

export const PAGE_SIZE = 8;

export function setVisits(v)        { visits = v; }
export function setPersons(v)       { persons = v; }
export function setEditingId(v)     { editingId = v; }
export function setCurrentPage(v)   { currentPage = v; }
export function setFilterDate(v)    { filterDate = v; }
export function setFilterService(v) { filterService = v; }
export function setSearchTerm(v)    { searchTerm = v; }
export function setChartService(v)  { chartService = v; }
export function setChartMonth(v)    { chartMonth = v; }
export function setFilterDateStart(v) { filterDateStart = v; }
export function setFilterDateEnd(v) { filterDateEnd = v; }
