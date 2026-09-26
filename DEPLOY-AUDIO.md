# Deploy Wavebox with MP3 conversion (production)

Vercel cannot run ffmpeg/yt-dlp. Use **Docker** on Railway, Render, Fly.io, or any VPS.

## Quick start (Docker)

```bash
docker compose up --build
```

Open **http://localhost:3000/** — search + progressive conversion work on this host.

```bash
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/audio?videoId=AU9AdGIdWZs"
```

Health should show `"conversion": true`.

## Deploy to Railway / Render / Fly

1. Push this repo to GitHub.
2. Create a new service from the repo.
3. Set **Dockerfile** builder (not Nixpacks-only without ffmpeg).
4. Expose port **3000**.
5. Optional env:

| Variable | Purpose |
|----------|---------|
| `PORT` | Default `3000` (platform may set this) |
| `PUBLIC_BASE_URL` | Public https URL of this service (fixes `streamUrl` / `audioUrl` behind proxies) |
| `WAVEBOX_CONVERSION` | Set `1` (Dockerfile already sets this) |

6. After deploy, test:

```bash
curl "https://YOUR-AUDIO-HOST/api/health"
curl "https://YOUR-AUDIO-HOST/api/audio?videoId=AU9AdGIdWZs"
```

## Hybrid: Vercel UI + Railway conversion

**Your hosts**

| Role | URL |
|------|-----|
| UI + search (Vercel) | `https://wave-box-iota.vercel.app` |
| Conversion (Railway) | `https://wave-box-production.up.railway.app` |

### 1. Vercel environment variable

Vercel dashboard → your project → **Settings** → **Environment Variables**:

```text
WAVEBOX_AUDIO_URL=https://wave-box-production.up.railway.app
```

Apply to Production (and Preview if you want). Then **Redeploy**.

### 2. Config file (already set in repo)

`public/config.js` points the web demo at Railway:

```js
window.WAVEBOX_CONFIG = {
  audioBaseUrl: "https://wave-box-production.up.railway.app",
};
```

### 3. Railway variable (recommended)

Railway → service → **Variables**:

```text
PUBLIC_BASE_URL=https://wave-box-production.up.railway.app
```

### 4. Verify

1. Open `https://wave-box-iota.vercel.app/` — status should mention the Railway audio host.
2. Search → play — conversion runs on Railway (not 501).
3. `https://wave-box-iota.vercel.app/api/health` should include `"audioBaseUrl":"https://wave-box-production.up.railway.app"` after the env var is set.

Flutter: search via Vercel `baseUrl`; play via Railway `baseUrl` / `streamUrl`.

---

## Hybrid: Vercel UI + Docker conversion (generic)

1. Keep search/docs on Vercel
2. Run conversion on Docker host
3. On **Vercel** → Environment Variables:

```text
WAVEBOX_AUDIO_URL=https://YOUR-AUDIO-HOST
```

4. Redeploy Vercel. The web demo reads `audioBaseUrl` from `/api/health` and/or `public/config.js`.
5. Or set it in `public/config.js`:

```js
window.WAVEBOX_CONFIG = {
  audioBaseUrl: "https://YOUR-AUDIO-HOST",
};
```

Flutter: use the Docker host `baseUrl` for `getAudio` / play; use Vercel for search if you prefer.

## Local without Docker

```bash
winget install ffmpeg
pip install -U yt-dlp
npm start
```

## Vercel-only reminder

`/api/audio` on Vercel returns **501**. See [DEPLOY.md](./DEPLOY.md) for search-only deploy.
