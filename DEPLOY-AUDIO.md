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

## Hybrid: Vercel UI + Docker conversion

1. Keep search/docs on Vercel: `https://wave-box-iota.vercel.app`
2. Run conversion on Docker host: `https://YOUR-AUDIO-HOST`
3. On **Vercel** → Project → Environment Variables:

```text
WAVEBOX_AUDIO_URL=https://YOUR-AUDIO-HOST
```

4. Redeploy Vercel. The web demo reads `audioBaseUrl` from `/api/health` and sends `/api/audio` calls to the Docker host.
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
