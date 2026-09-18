// Talks to the Worker API. Kept intentionally thin: the frontend still
// works in terms of "the whole projects array", so this just mirrors that.
const BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: isForm ? options.headers : { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: password => request("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/api/logout", { method: "POST" }),
  session: () => request("/api/session"),

  listPublic: () => request("/api/projects"),
  listAdmin: () => request("/api/admin/projects"),
  sync: projects => request("/api/admin/projects", { method: "PUT", body: JSON.stringify(projects) }),

  upload: file => { const fd = new FormData(); fd.append("file", file); return request("/api/admin/upload", { method: "POST", body: fd }); },
  deleteMedia: url => request(`/api/admin/media?url=${encodeURIComponent(url)}`, { method: "DELETE" }),

  storage: () => request("/api/admin/storage")
};
