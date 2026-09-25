# Deploy Wavebox API to Vercel

## What deploys on Vercel

| Works on Vercel | Local Express only (`npm start`) |
|-----------------|-----------------------------------|
| Search, suggestions, album / artist / playlist | Progressive MP3 (`/api/audio`, `/api/audio/stream`) |
| Health, API docs (`/api`) | Cached files under `/audio/*.mp3` |
| Lyrics (`/api/lyrics`) | Full custom player streaming while converting |
| Web demo at `/` (search + YouTube embed fallback) | Requires **ffmpeg** + **yt-dlp** |

Audio endpoints return **`501`** on Vercel (including `POST /api/request` with `action: "audio"`).

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Vercel account](https://vercel.com/signup)
- Git repository (recommended)

## Deploy

```bash
npm install
npx vercel login
npx vercel          # preview
npx vercel --prod   # production
```

Vercel will detect:

- **Framework:** Other (`framework: null` — not Express; `local-server.js` is local-only and ignored on deploy)
- **`api/*.js`** → serverless routes at `/api/*`
- **`public/`** → static files (`/` → web demo via rewrite to `index.html`)
- **`/api`** → JSON API documentation

No build command required. No environment variables required for basic search.

## Production URLs

After deploy, your API base is:

```text
https://<project-name>.vercel.app
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Web demo (search; YouTube play fallback) |
| `/api` | GET | API docs JSON |
| `/api/health` | GET | Health check |
| `/api/request` | POST | **Main entry** (Flutter uses this) |
| `/api/search` | GET, POST | Song search |
| `/api/suggestions` | GET, POST | Autocomplete |
| `/api/lyrics` | GET, POST | Lyrics (LRCLIB) |
| `/api/audio` | GET, POST | **501** — local only |
| `/api/audio/stream/:videoId` | GET | **501** — local only |

### POST `/api/request` (recommended for mobile)

```json
{
  "action": "search",
  "query": "pathaan",
  "type": "song"
}
```

## Flutter

See [`flutter/README.md`](flutter/README.md) and copy `flutter/wavebox_api.dart`.

- **Search on Vercel:** set `baseUrl` to your Vercel production URL.
- **MP3 playback:** point `baseUrl` at a machine running `npm start` (with ffmpeg + yt-dlp), or use YouTube embed with `videoId`.

## Environment variables

None required for basic operation.

Optional on Vercel dashboard → Project → Settings → Environment Variables if you add features later.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on `/api/search` | Redeploy; ensure `api/search.js` exists |
| `/` shows INTERNAL_SERVER_ERROR | Redeploy with `framework: null` in `vercel.json` (do not run Express on Vercel). Ensure `public/index.html` is committed. |
| `/api/audio` returns 501 | Expected on Vercel — run locally for MP3 |
| Cold start slow | First request after idle may take 5–15s |
| CORS from web | Headers already allow `*` |
| Flutter on Android emulator calling `localhost` | Use `10.0.2.2:3000` for local API, not `localhost` |
