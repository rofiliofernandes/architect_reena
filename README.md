# Architect Reena Lotlikar — Phase 1

Phase 1 is the visual/design pass for the public portfolio — now backed by
a real Cloudflare Worker + D1 + R2, with a 7 GB media storage cap.

## Design direction locked in
- Reena is the brand.
- Projects are the primary content.
- Large editorial photography with minimal metadata.
- No Journal / Articles section.
- Public navigation: Home, Work, About, Contact.
- Project cards use large images, project type/location, title, year and status.
- Project pages are visual-first with gallery, optional video, construction
  progress and Reena's note.
- Responsive desktop/tablet/mobile presentation.
- Admin UI/UX is unchanged from the original prototype — same layout, same
  editor, same interactions. Only the data layer changed: uploads and saves
  now persist for real instead of living in localStorage/blob URLs.

## What changed vs. the original prototype
- **Storage**: `localStorage` → D1 (project content) + R2 (media files),
  with a 7 GB hard cap enforced server-side on every upload.
- **Auth**: `/admin` previously had no protection at all — anyone who found
  the URL had full write access. Since this is now a real, persistent
  database, a minimal password gate was added in front of the admin UI
  (`worker/index.js` handles it with a signed session cookie, no extra
  dependencies). This is the one addition beyond "just the backend" — happy
  to remove it if you'd rather have it fully open, but wanted to flag it
  rather than change that silently.
- Everything else — layout, components, the editor, preview, the Media and
  Storage pages, all copy — is byte-for-byte the same JSX as the original.
  Only the internals of upload/delete handlers changed (real API calls
  instead of `URL.createObjectURL`/localStorage).

## Architecture
- **Frontend**: unchanged React + Vite SPA (`src/main.jsx`). It still treats
  "all projects" as one array it freely edits and re-saves in full — that's
  exactly what it did before, just now the save goes to the API instead of
  `localStorage.setItem`.
- **API**: `worker/index.js`. Rather than forcing granular REST onto a UI
  that was built around "one big array", the API mirrors that contract:
  `GET/PUT /api/admin/projects` reads/writes the whole array, and the worker
  diffs it against the `projects`/`project_media` tables to reconcile what
  changed (including deleting orphaned R2 objects when an image is removed
  from a project or a whole project is deleted).
- **Media**: `POST /api/admin/upload` is a single generic "store this file,
  give me a URL back" endpoint used by every UploadBox in the UI (cover,
  gallery, video, construction photos, and the standalone Media page). The
  returned URL gets held in React state exactly like the old blob URL did,
  and becomes permanent once the containing project is next saved.
- **Auth**: single admin password + HMAC-signed session cookie (7 day
  expiry, Web Crypto, no dependencies).

## One-time setup
```
npm install
wrangler login

wrangler d1 create architect-reena-lotlikar-db   # paste the id into wrangler.toml
wrangler r2 bucket create architect-reena-lotlikar-media

npm run db:migrate          # local schema
npm run db:migrate:remote   # production schema

wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
```

For local dev, put the same two values in a `.dev.vars` file (gitignored)
instead of `wrangler secret put`:
```
ADMIN_PASSWORD=your-dev-password
SESSION_SECRET=any-long-random-string
```

## Run locally
Two terminals:
```
npm run dev:worker   # Worker (API + media) on :8787
npm run dev           # Vite on :5173, proxying /api and /media to :8787
```
Visit `http://localhost:5173`, and `http://localhost:5173/admin` for the studio.

## Deploy
```
npm run deploy
```
If the frontend is deployed separately (e.g. Cloudflare Pages) rather than
served by this Worker, set `VITE_API_BASE` at build time to the Worker's
URL, and set `ALLOWED_ORIGIN` in `wrangler.toml` to the frontend's origin
so the cross-site cookie and CORS work.

## Storage
7 GB total, enforced server-side on every upload — not a client-side
estimate. Deleting media (removing a gallery image, replacing a cover,
deleting a project) reclaims its space immediately.
