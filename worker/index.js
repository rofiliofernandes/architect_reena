// Architect Reena Lotlikar — API worker
//
// Design note: the frontend already treats "all projects" as one array it
// freely mutates and re-saves in full (it used to be a single localStorage
// write). To keep the UI byte-for-byte unchanged, this worker mirrors that
// exact contract instead of forcing granular REST onto it:
//   GET  /api/projects          -> published projects, shaped exactly like
//                                   the frontend's own project objects
//   GET  /api/admin/projects    -> all projects, same shape (auth)
//   PUT  /api/admin/projects    -> body: the whole projects array; the
//                                   worker diffs it against `projects` +
//                                   `project_media` and reconciles (auth)
//   POST /api/admin/upload      -> generic "give me a URL for this file"
//                                   upload, used by every UploadBox (auth)
//   DELETE /api/admin/media?url=... -> delete one uploaded object (auth)
//   GET  /api/admin/storage     -> real usage against the 7GB cap (auth)
//
// Auth: single admin password + HMAC-signed session cookie. Added because
// this now guards a real, persistent database — the original prototype's
// admin route had no protection at all, which was fine for a localStorage
// toy and isn't fine once anyone on the internet can permanently delete
// Reena's portfolio.

const MAX_TOTAL_BYTES = 7 * 1024 * 1024 * 1024; // 7 GiB
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const CONTENT_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime"
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      const headers = corsHeaders(origin, env);
      headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      return new Response(null, { status: 204, headers });
    }

    let response;
    try {
      response = await route(request, env);
    } catch (err) {
      response = json({ error: err.message || "Server error" }, 500);
    }
    const cors = corsHeaders(origin, env);
    cors.forEach((v, k) => response.headers.set(k, v));
    return response;
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (pathname.startsWith("/media/") && method === "GET") {
    return serveMedia(decodeURIComponent(pathname.slice("/media/".length)), env);
  }

  if (pathname === "/api/login" && method === "POST") return login(request, env);
  if (pathname === "/api/logout" && method === "POST") return logout(request, env);
  if (pathname === "/api/session" && method === "GET") return json({ authenticated: await isAuthed(request, env) });

  if (pathname === "/api/projects" && method === "GET") return json(await loadProjectsFull(env, true));

  if (pathname.startsWith("/api/admin/")) {
    if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

    if (pathname === "/api/admin/projects" && method === "GET") return json(await loadProjectsFull(env, false));
    if (pathname === "/api/admin/projects" && method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!Array.isArray(body)) return json({ error: "Expected an array of projects" }, 400);
      await syncProjects(env, body);
      return json(await loadProjectsFull(env, false));
    }
    if (pathname === "/api/admin/upload" && method === "POST") return uploadFile(request, env);
    if (pathname === "/api/admin/media" && method === "DELETE") {
      await deleteOwnMedia(env, url.searchParams.get("url") || "");
      return json({ ok: true });
    }
    if (pathname === "/api/admin/storage" && method === "GET") return json(await getStorage(env));

    return json({ error: "Not found" }, 404);
  }

  return json({ error: "Not found" }, 404);
}

// ---------- auth / infra helpers ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function corsHeaders(origin, env) {
  const headers = new Headers();
  if (env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map(p => {
      const [k, ...v] = p.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function makeSessionToken(env) {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const sig = await hmac(String(expires), env.SESSION_SECRET);
  return `${expires}.${sig}`;
}

async function verifySessionToken(token, env) {
  if (!token || !env.SESSION_SECRET) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Date.now() > Number(expires)) return false;
  return timingSafeEqual(sig, await hmac(expires, env.SESSION_SECRET));
}

async function isAuthed(request, env) {
  return verifySessionToken(parseCookies(request).admin_session, env);
}

function cookieAttrs(request, env) {
  const isHttps = new URL(request.url).protocol === "https:";
  if (env.ALLOWED_ORIGIN) return "Path=/; HttpOnly; Secure; SameSite=None";
  return `Path=/; HttpOnly; SameSite=Lax${isHttps ? "; Secure" : ""}`;
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "Server is missing ADMIN_PASSWORD / SESSION_SECRET secrets." }, 500);
  }
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const ok = password.length === env.ADMIN_PASSWORD.length && timingSafeEqual(password, env.ADMIN_PASSWORD);
  if (!ok) return json({ error: "Invalid password" }, 401);
  const token = await makeSessionToken(env);
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", `admin_session=${token}; ${cookieAttrs(request, env)}; Max-Age=${SESSION_MAX_AGE}`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

function logout(request, env) {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", `admin_session=; ${cookieAttrs(request, env)}; Max-Age=0`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

function slugify(s) {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";
}

// ---------- media helpers (R2 + ledger) ----------

async function getUsedBytes(env) {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(size_bytes),0) as total FROM media_objects").first();
  return row?.total || 0;
}

async function getStorage(env) {
  const used = await getUsedBytes(env);
  return { usedBytes: used, limitBytes: MAX_TOTAL_BYTES, usedGB: +(used / 1073741824).toFixed(2), limitGB: +(MAX_TOTAL_BYTES / 1073741824).toFixed(0) };
}

async function uploadFile(request, env) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return json({ error: "No file provided" }, 400);

  const used = await getUsedBytes(env);
  if (used + file.size > MAX_TOTAL_BYTES) {
    return json({ error: "Upload rejected: the 7 GB storage quota would be exceeded." }, 413);
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const key = `uploads/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  await env.DB.prepare("INSERT INTO media_objects (key, size_bytes, content_type) VALUES (?,?,?)")
    .bind(key, file.size, file.type || "").run();

  return json({ url: `/media/${key}`, size_bytes: file.size });
}

function ownKey(url) {
  return url && url.startsWith("/media/") ? decodeURIComponent(url.slice("/media/".length)) : null;
}

async function lookupOwnMediaSize(env, url) {
  const key = ownKey(url);
  if (!key) return 0;
  const row = await env.DB.prepare("SELECT size_bytes FROM media_objects WHERE key = ?").bind(key).first();
  return row?.size_bytes || 0;
}

async function deleteOwnMedia(env, url) {
  const key = ownKey(url);
  if (!key) return; // external/pasted URLs aren't ours to delete
  await env.MEDIA.delete(key).catch(() => {});
  await env.DB.prepare("DELETE FROM media_objects WHERE key = ?").bind(key).run().catch(() => {});
}

async function serveMedia(key, env) {
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const ext = key.split(".").pop().toLowerCase();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  if (!headers.get("content-type")) headers.set("content-type", CONTENT_TYPES[ext] || "application/octet-stream");
  return new Response(obj.body, { headers });
}

// ---------- project state sync ----------

async function loadProjectsFull(env, onlyPublished) {
  const { results: rows } = await env.DB.prepare(
    onlyPublished
      ? "SELECT * FROM projects WHERE published = 1 ORDER BY created_at DESC"
      : "SELECT * FROM projects ORDER BY created_at DESC"
  ).all();

  const out = [];
  for (const row of rows) {
    const { results: media } = await env.DB.prepare(
      "SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC"
    ).bind(row.id).all();
    out.push({
      id: row.id,
      title: row.title,
      location: row.location || "",
      category: row.category || "",
      year: row.year,
      status: row.status || "",
      excerpt: row.excerpt || "",
      cover: row.cover_key || "",
      gallery: media.filter(m => m.kind === "gallery").map(m => m.r2_key),
      videos: media.filter(m => m.kind === "video").map(m => m.r2_key),
      construction: {
        stage: row.construction_stage || "Design",
        note: row.construction_note || "",
        media: media.filter(m => m.kind === "construction").map(m => m.r2_key)
      },
      reenaNote: row.reena_note || "",
      published: !!row.published
    });
  }
  return out;
}

async function reconcileMediaKind(env, projectId, kind, urls) {
  urls = (urls || []).filter(Boolean);
  const { results: existing } = await env.DB.prepare(
    "SELECT id, r2_key FROM project_media WHERE project_id = ? AND kind = ?"
  ).bind(projectId, kind).all();

  const existingByUrl = new Map(existing.map(r => [r.r2_key, r]));
  const keep = new Set(urls);

  for (const row of existing) {
    if (!keep.has(row.r2_key)) {
      await env.DB.prepare("DELETE FROM project_media WHERE id = ?").bind(row.id).run();
      await deleteOwnMedia(env, row.r2_key);
    }
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const row = existingByUrl.get(url);
    if (row) {
      await env.DB.prepare("UPDATE project_media SET sort_order = ? WHERE id = ?").bind(i, row.id).run();
    } else {
      const size = await lookupOwnMediaSize(env, url);
      await env.DB.prepare(
        "INSERT INTO project_media (id, project_id, kind, r2_key, size_bytes, sort_order) VALUES (?,?,?,?,?,?)"
      ).bind(crypto.randomUUID(), projectId, kind, url, size, i).run();
    }
  }
}

async function upsertProject(env, item) {
  const id = String(item.id);
  const title = String(item.title || "Untitled project").trim();
  const slug = `${slugify(title)}-${id.slice(-6)}`;

  const existing = await env.DB.prepare("SELECT cover_key FROM projects WHERE id = ?").bind(id).first();
  if (existing && existing.cover_key && existing.cover_key !== (item.cover || null)) {
    await deleteOwnMedia(env, existing.cover_key); // old cover replaced — reclaim its space
  }

  await env.DB.prepare(`
    INSERT INTO projects (id, slug, title, location, category, year, status, excerpt, cover_key, construction_stage, construction_note, reena_note, published, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug, title=excluded.title, location=excluded.location, category=excluded.category,
      year=excluded.year, status=excluded.status, excerpt=excluded.excerpt, cover_key=excluded.cover_key,
      construction_stage=excluded.construction_stage, construction_note=excluded.construction_note,
      reena_note=excluded.reena_note, published=excluded.published, updated_at=CURRENT_TIMESTAMP
  `).bind(
    id, slug, title, item.location || "", item.category || "", item.year || null, item.status || "",
    item.excerpt || "", item.cover || null, item.construction?.stage || "Design",
    item.construction?.note || "", item.reenaNote || "", item.published ? 1 : 0
  ).run();

  await reconcileMediaKind(env, id, "gallery", item.gallery);
  await reconcileMediaKind(env, id, "video", item.videos);
  await reconcileMediaKind(env, id, "construction", item.construction?.media);
}

async function deleteProjectFully(env, id) {
  const { results: media } = await env.DB.prepare("SELECT r2_key FROM project_media WHERE project_id = ?").bind(id).all();
  for (const m of media) await deleteOwnMedia(env, m.r2_key);
  const proj = await env.DB.prepare("SELECT cover_key FROM projects WHERE id = ?").bind(id).first();
  if (proj?.cover_key) await deleteOwnMedia(env, proj.cover_key);
  await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run(); // cascades project_media
}

async function syncProjects(env, incoming) {
  const { results: existingRows } = await env.DB.prepare("SELECT id FROM projects").all();
  const existingIds = new Set(existingRows.map(r => r.id));
  const incomingIds = new Set(incoming.map(p => String(p.id)));

  for (const id of existingIds) {
    if (!incomingIds.has(id)) await deleteProjectFully(env, id);
  }
  for (const item of incoming) {
    await upsertProject(env, item);
  }
}
