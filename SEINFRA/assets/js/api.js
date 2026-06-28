// assets/js/api.js
// Cliente HTTP centralizado — armazena JWT no localStorage e envia em toda requisição

const _isFile = window.location.protocol === "file:";
export const API_URL = window.SEINFRA_API_URL || (_isFile ? "http://localhost:3001/api" : "/api");

export function getToken()       { return localStorage.getItem("seinfra_token"); }
export function setToken(t)      { localStorage.setItem("seinfra_token", t); }
export function clearToken()     { localStorage.removeItem("seinfra_token"); localStorage.removeItem("seinfra_user"); }
export function getUser()        { const u = localStorage.getItem("seinfra_user"); return u ? JSON.parse(u) : null; }
export function setUser(u)       { localStorage.setItem("seinfra_user", JSON.stringify(u)); }

async function request(method, path, body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Sem conexão com o servidor"), { status: 0 });
  }

  if (res.status === 401) {
    clearToken();
    const pagina = window.location.pathname.split("/").pop();
    if (pagina !== "index.html" && pagina !== "") window.location.replace("index.html");
    throw Object.assign(new Error("Sessão expirada"), { status: 401 });
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw Object.assign(new Error(data.error || "Erro na requisição"), { status: res.status, data });
  return data;
}

export const api = {
  get:    (path)       => request("GET",    path),
  post:   (path, body) => request("POST",   path, body),
  patch:  (path, body) => request("PATCH",  path, body),
  delete: (path)       => request("DELETE", path),
};
