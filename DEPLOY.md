# Deploy Wavebox API to Vercel

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

- **`api/*.js`** → serverless routes at `/api/*`
- **`/`** → rewrites to `/api` (JSON documentation)

No build command required.

## Production URLs

After deploy, your API base is:

```text
https://<project-name>.vercel.app
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | API docs JSON |
| `/api/health` | GET | Health check |
| `/api/request` | POST | **Main entry** (Flutter uses this) |
| `/api/search` | GET, POST | Song search |
| `/api/suggestions` | GET, POST | Autocomplete |

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

Set `baseUrl` to your Vercel production URL.

## Environment variables

None required for basic operation.

Optional on Vercel dashboard → Project → Settings → Environment Variables if you add features later.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on `/api/search` | Redeploy; ensure `api/search.js` exists |
| Cold start slow | First request after idle may take 5–15s |
| CORS from web | Headers already allow `*` |
| Flutter on Android emulator calling `localhost` | Use `10.0.2.2:3000` for local API, not `localhost` |
