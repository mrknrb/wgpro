# WGPro — CLAUDE.md

## Stack
- **Frontend**: SolidJS + TailwindCSS 4 + Vite
- **Backend**: Express 5 (ESM) on port 3010, proxied from Vite on port 5173
- **Database/Auth**: Supabase (postgres + RLS)
- **AI**: DeepInfra API via openai SDK, model `moonshotai/Kimi-K2.5`
- **Chrome Extension**: MV3, scrapes WG Gesucht message threads

## Dev
```bash
npm run dev        # starts Vite + Express concurrently
npm run dev:vite   # frontend only (port 5173)
npm run dev:server # express only (port 3010)
npm run build
```

## Env vars (`.env`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLIC_KEY=
DEEPINFRA_API_KEY=
```

## Key files
| Path | Purpose |
|---|---|
| `expressServer.js` | Express server — imports and registers all `/api/*` handlers |
| `api/_lib/auth.js` | `requireUser(req)`, `send()`, `err()` — used by every API route |
| `src/lib/supabase.js` | Supabase client + `authFetch(path, opts)` for frontend API calls |
| `supabase/migrations/001_initial.sql` | Full schema + RLS policies |
| `chrome-extension/content.js` | Scraper — fetches conversation list, parses messages, uploads |
| `chrome-extension/popup.js` | Extension UI — login + session picker + scrape trigger |

## API route structure
All routes are in `api/`. Express loads them explicitly in `expressServer.js`.
The `withParams()` wrapper merges `req.params` → `req.query` (Vercel compat).

```
api/sessions/index.js              GET list, POST create
api/sessions/[id]/index.js         GET single session
api/sessions/[id]/members.js       GET members, PATCH toggle admin
api/sessions/[id]/invite.js        GET verify token, POST generate token
api/sessions/[id]/join.js          POST request to join
api/sessions/[id]/approve.js       GET pending requests, POST approve/reject
api/sessions/[id]/applicants.js    GET applicants with messages + ratings
api/sessions/[id]/ai-config.js     GET/PUT shared AI system prompt
api/sessions/[id]/appointments.js  GET/POST booked applicant slots
api/applicants/[id]/ratings.js     PUT upsert user rating + comment
api/applicants/[id]/ai-rate.js     POST run AI rating via DeepInfra
api/scrape/upload.js               POST bulk upsert from Chrome extension
api/availability/index.js          GET/POST member availability slots
```

## Database tables
`sessions` → `session_members` → `session_invites` → `join_requests`
`applicants` → `messages`, `ratings`, `ai_ratings`, `ai_configs`
`member_availability`, `applicant_appointments`

RLS: helper functions `is_session_member(sid)` and `is_session_admin(sid)`.

## Session concept
One session = one WG Gesucht ad. `sessions.wg_ad_id` is the numeric ad ID
extracted from the WG Gesucht URL. Used by the Chrome extension to match.

## Auth pattern
Frontend: `authFetch('/api/...', opts)` — attaches `Authorization: Bearer <jwt>`.
Backend: every route calls `requireUser(req)` → returns `{ user, supabase }`.

## Chrome extension
- Popup lets user log in + pick a session, then click "Scrape & Sync".
- Content script (`content.js`) fetches `/nachrichten.html?filter_type=4&ad_id=<wgAdId>&page=N`,
  parses conversation list, fetches each thread, stops at known `last_message_id`.
- Uploads to `POST /api/scrape/upload` with JWT.
- To install: Chrome → Extensions → Load unpacked → `chrome-extension/`
- Set `APP_URL` in `popup.js` to deployed URL (or `http://localhost:3010` locally).
