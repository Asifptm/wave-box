# Wavebox — YouTube Music API

REST API for searching YouTube Music. Deploy on **Vercel**, call from **Flutter**, web, or any HTTP client.

---

## Base URL (after Vercel deploy)

Replace `YOUR-PROJECT` with your Vercel project name:

```text
https://YOUR-PROJECT.vercel.app
```

All API routes live under **`/api`**. Examples below use this base.

| Environment | Base URL |
|-------------|----------|
| Production (Vercel) | `https://YOUR-PROJECT.vercel.app` |
| Local | `http://localhost:3000` |

---

## Deploy to Vercel

```bash
npm install
npx vercel login
npx vercel          # preview deployment
npx vercel --prod   # production
```

More detail: [DEPLOY.md](./DEPLOY.md)

After deploy, open **`https://YOUR-PROJECT.vercel.app/`** — returns JSON API documentation.

---

## API endpoints (Vercel examples)

Every successful response uses this shape:

```json
{
  "status": 200,
  "message": "success",
  "response": { },
  "meta": { }
}
```

Errors use the same shape with `"response": null` and a non-200 `status`.

### 1. API documentation

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/` |
| **Method** | `GET` |
| **Also** | `https://YOUR-PROJECT.vercel.app/api` |

```bash
curl "https://YOUR-PROJECT.vercel.app/"
```

---

### 2. Health check

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/health` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/health"
```

Example response:

```json
{
  "status": 200,
  "message": "success",
  "response": { "ok": true, "service": "wavebox-api" }
}
```

---

### 3. Unified request (recommended — Flutter / mobile)

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/request` |
| **Method** | `POST` |
| **Header** | `Content-Type: application/json` |

**Search songs**

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/request" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"search\",\"query\":\"pathaan\",\"type\":\"song\"}"
```

**Suggestions**

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/request" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"suggestions\",\"query\":\"path\"}"
```

**Health (via gateway)**

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/request" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"health\"}"
```

| `action` | Body fields |
|----------|-------------|
| `health` | — |
| `search` | `query` or `q`, optional `type` (default `song`) |
| `suggestions` | `query` or `q` |
| `album` | `browseId` or `id` |
| `artist` | `browseId` or `id` |
| `playlist` | `browseId` or `id` |

---

### 4. Search (GET)

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/search?q=pathaan&type=song` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/search?q=pathaan&type=song"
```

POST with JSON body (same fields as query):

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"pathaan\",\"type\":\"song\"}"
```

`type` values: `song`, `video`, `album`, `artist`, `playlist` (default: `song`).

---

### 5. Search suggestions (GET)

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/suggestions?q=path` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/suggestions?q=path"
```

---

### 6. Album

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/album/BROWSE_ID` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/album/MPREb_9TuSrHElFSO"
```

---

### 7. Artist

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/artist/BROWSE_ID` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/artist/UCCvxgd2z194wYgpBt-sajrA"
```

---

### 8. Playlist

| | |
|---|---|
| **URL** | `https://YOUR-PROJECT.vercel.app/api/playlist/BROWSE_ID` |
| **Method** | `GET` or `POST` |

```bash
curl "https://YOUR-PROJECT.vercel.app/api/playlist/VLPLTw3BBwcLBjG-4fernx2Xt-GHdYMPYAFM"
```

---

## Search response example (normalized songs)

`POST https://YOUR-PROJECT.vercel.app/api/request` with `action: search`:

```json
{
  "status": 200,
  "message": "success",
  "response": {
    "query": "pathaan",
    "type": "song",
    "count": 20,
    "items": [
      {
        "type": "song",
        "id": "AU9AdGIdWZs",
        "videoId": "AU9AdGIdWZs",
        "title": "Jhoome Jo Pathaan (From \"Pathaan\")",
        "artist": "Arijit Singh, Vishal - Shekhar, Sukriti Kakar, Vishal Dadlani",
        "artists": ["Arijit Singh", "Vishal - Shekhar", "Sukriti Kakar", "Vishal Dadlani"],
        "album": "Arijit Singh",
        "albumId": "UCDxKh1gFWeYsqePvgVzmPoQ",
        "duration": { "ms": 209000, "seconds": 209, "label": "3:29" },
        "thumbnail": {
          "url": "https://yt3.googleusercontent.com/...",
          "width": 120,
          "height": 120
        }
      }
    ]
  },
  "meta": { "action": "search", "type": "song" }
}
```

---


## Local development

```bash
npm start
```

Use the same paths with `http://localhost:3000`:

```text
http://localhost:3000/api/health
http://localhost:3000/api/request
http://localhost:3000/api/search?q=pathaan&type=song
```

---


---

## Quick reference

| Endpoint | Example URL |
|----------|-------------|
| Docs | `https://YOUR-PROJECT.vercel.app/` |
| Health | `https://YOUR-PROJECT.vercel.app/api/health` |
| **Gateway (POST JSON)** | `https://YOUR-PROJECT.vercel.app/api/request` |
| Search | `https://YOUR-PROJECT.vercel.app/api/search?q=pathaan&type=song` |
| Suggestions | `https://YOUR-PROJECT.vercel.app/api/suggestions?q=path` |
| Album | `https://YOUR-PROJECT.vercel.app/api/album/:browseId` |
| Artist | `https://YOUR-PROJECT.vercel.app/api/artist/:browseId` |
| Playlist | `https://YOUR-PROJECT.vercel.app/api/playlist/:browseId` |

CORS: `Access-Control-Allow-Origin: *` — safe to call from Flutter and browser apps.
