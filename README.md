# Wavebox — YouTube Music API

REST API for searching YouTube Music. Deploy search/docs on **Vercel**; run **local Express** for progressive MP3 streaming, lyrics, and the web player. Call from **Flutter**, web, or any HTTP client.

**Local extras** (not on Vercel): progressive audio stream while converting, 25-minute MP3 cache, lyrics (LRCLIB), debounced search UI.

---

## Base URL (after Vercel deploy)

Replace `YOUR-PROJECT` with your Vercel project name:

```text
https://YOUR-PROJECT.vercel.app
```

All API routes live under **`/api`**. Examples below use this base.

| Environment | Base URL | Audio / lyrics |
|-------------|----------|----------------|
| Production (Vercel) | `https://YOUR-PROJECT.vercel.app` | Search + docs only (`/api/audio` → `501`) |
| Local | `http://localhost:3000` | Full player + progressive MP3 + lyrics |

---

## Deploy to Vercel

```bash
npm install
npx vercel login
npx vercel          # preview deployment
npx vercel --prod   # production
```

More detail: [DEPLOY.md](./DEPLOY.md)

After deploy:

- **`https://YOUR-PROJECT.vercel.app/`** — web demo (search; YouTube embed fallback for play)
- **`https://YOUR-PROJECT.vercel.app/api`** — JSON API documentation

For **real MP3 streaming**, run locally with `ffmpeg` + `yt-dlp` (see [Local development](#local-development)).

---

## Web demo — custom music player

The **`public/index.html`** page talks to this API with a custom player UI (no visible YouTube controls).

### Flow

1. **Search** — debounced live search (`GET /api/search`) — metadata only, no conversion.
2. **Pick a track** — each song includes a **`videoId`**.
3. **Play (local)** — `GET /api/audio?videoId=...` returns **`streamUrl`** immediately. The player opens the progressive stream and starts audio after ~48KB is buffered while conversion continues for the **full** track. Lyrics load in parallel. On failure, falls back to a hidden YouTube player.

### Try it locally

```bash
winget install ffmpeg
pip install -U yt-dlp
npm start
```

Open **`http://localhost:3000/`**, type a search (results appear as you type), click a song.

### Minimal browser example (search → progressive stream)

```html
<script>
  async function searchAndPlay(query) {
    const search = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=song`).then((r) => r.json());
    if (search.status !== 200) throw new Error(search.message);
    const song = search.response.items.find((i) => i.videoId);
    if (!song) throw new Error("No playable songs");

    const audio = await fetch(`/api/audio?videoId=${encodeURIComponent(song.videoId)}`).then((r) => r.json());
    if (audio.status !== 200) throw new Error(audio.message);

    // Prefer streamUrl — plays while converting; audioUrl is the 25-min cache file
    const url = audio.response.streamUrl || audio.response.audioUrl;
    const el = new Audio(url);
    await el.play();
  }
</script>
```

See **`public/index.html`** for the full player (queue, converting spinner, lyrics, seek, YouTube fallback).

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
| `audio` | `videoId` or `id` (**local Express only** — returns `streamUrl` + `audioUrl`) |
| `lyrics` | `title`, `artist` (optional `q`, `durationSec`) |

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

### 9. Progressive MP3 audio (local Express only)

Converts a selected YouTube `videoId` to MP3 with **progressive streaming**: playback can start while conversion continues. Requires **ffmpeg** + **yt-dlp** on PATH.

| | |
|---|---|
| **Status / URLs** | `GET/POST http://localhost:3000/api/audio?videoId=AU9AdGIdWZs` |
| **Progressive stream** | `GET http://localhost:3000/api/audio/stream/AU9AdGIdWZs` |
| **Cached file** | `GET http://localhost:3000/audio/AU9AdGIdWZs.mp3` |
| **Also** | `POST /api/request` with `{ "action": "audio", "videoId": "..." }` |

**Prerequisite**

```bash
# Windows
winget install ffmpeg
pip install -U yt-dlp

npm start
```

**Example**

```bash
curl "http://localhost:3000/api/audio?videoId=AU9AdGIdWZs"
```

```bash
curl -X POST "http://localhost:3000/api/request" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"audio\",\"videoId\":\"AU9AdGIdWZs\"}"
```

Example response (immediate — does not wait for full conversion):

```json
{
  "status": 200,
  "message": "success",
  "response": {
    "videoId": "AU9AdGIdWZs",
    "status": "streaming",
    "converting": true,
    "streamUrl": "http://localhost:3000/api/audio/stream/AU9AdGIdWZs",
    "audioUrl": "http://localhost:3000/audio/AU9AdGIdWZs.mp3",
    "contentType": "audio/mpeg",
    "expiresAt": null,
    "cached": false,
    "ttlMinutes": 25
  },
  "meta": { "action": "audio", "videoId": "AU9AdGIdWZs", "status": "streaming" }
}
```

**How progressive streaming works**

1. One convert job per `videoId` writes a growing `tmp/audio/{id}.mp3.part` file (yt-dlp → ffmpeg).
2. When ~48KB is ready, `GET /api/audio/stream/:videoId` starts chunked HTTP streaming to the client.
3. The server keeps reading new bytes until the **full** track is converted, then renames to `{id}.mp3`.
4. Later plays within **25 minutes** get `cached: true` and can use `audioUrl` (static file, better for seeking).

**Efficient client flow**

1. **Search** — metadata only (no convert). Results capped (~30). Short server-side cache.
2. **Click play** — `GET /api/audio?videoId=...` → use `streamUrl` right away.
3. **Play** — `new Audio(streamUrl)` / `just_audio` with `streamUrl`.
4. **Optional** — when `status` is `ready` / `cached: true`, switch to `audioUrl`.

Notes:

- Search / lyrics never start conversion — only `/api/audio` + `/api/audio/stream` for the **selected** track.
- Max **3** concurrent conversions (HTTP `503` if busy).
- Temp files under `tmp/audio/` are deleted after **25 minutes**.
- **Not supported on Vercel** (`501`).
- Personal / development use only; respect YouTube ToS and copyright.

### 10. Lyrics

| | |
|---|---|
| **URL** | `http://localhost:3000/api/lyrics?title=Tum%20Mile&artist=Arijit%20Singh` |
| **Method** | `GET` or `POST` |
| **Also** | `POST /api/request` with `{ "action": "lyrics", "title": "...", "artist": "..." }` |

```bash
curl "http://localhost:3000/api/lyrics?title=Tum%20Mile&artist=Arijit%20Singh"
```

Returns `plainLyrics` / `syncedLyrics` from [LRCLIB](https://lrclib.net) when found (`found: true|false`). Cached briefly on the server.

---

## Flutter — call API and play in a custom player

Copy the client from [`flutter/wavebox_api.dart`](./flutter/wavebox_api.dart). More notes: [`flutter/README.md`](./flutter/README.md).

### What the API gives you

| Field | Use in UI |
|-------|-----------|
| `title`, `artist`, `artists` | Labels in your player |
| `thumbnail.url` | Album art |
| `duration.label` | Total time |
| **`videoId`** | Pass to `/api/audio` (local) or YouTube embed (fallback) |
| **`streamUrl`** | Progressive MP3 — play while converting (preferred) |
| **`audioUrl`** | Cached file URL after conversion (25 min TTL) |

### Preferred: progressive stream + `just_audio`

Point `baseUrl` at your **local** Wavebox server (`http://10.0.2.2:3000` on Android emulator, or your LAN IP).

```yaml
dependencies:
  http: ^1.2.0
  just_audio: ^0.9.40
```

```dart
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'dart:convert';

Future<String> fetchPlayableUrl(String baseUrl, String videoId) async {
  final res = await http.post(
    Uri.parse('$baseUrl/api/request'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'action': 'audio', 'videoId': videoId}),
  );
  final json = jsonDecode(res.body) as Map<String, dynamic>;
  if (json['status'] != 200) {
    throw Exception(json['message'] ?? 'audio failed');
  }
  final response = json['response'] as Map<String, dynamic>;
  // streamUrl starts playback ASAP; audioUrl is the finished cache when ready
  if (response['cached'] == true || response['status'] == 'ready') {
    return response['audioUrl'] as String;
  }
  return (response['streamUrl'] ?? response['audioUrl']) as String;
}

final player = AudioPlayer();

Future<void> playSong(String baseUrl, String videoId) async {
  final url = await fetchPlayableUrl(baseUrl, videoId);
  await player.setUrl(url);
  await player.play();
}
```

### Search via Wavebox API

```dart
import 'package:your_app/services/wavebox_api.dart';

final api = WaveboxApi(baseUrl: 'http://10.0.2.2:3000'); // or Vercel URL for search-only

Future<List<SongItem>> fetchSongs(String query) async {
  try {
    final songs = await api.searchSongs(query);
    return songs.where((s) => s.videoId != null && s.videoId!.isNotEmpty).toList();
  } on WaveboxApiException catch (e) {
    throw Exception('Search failed: ${e.message}');
  }
}
```

Or GET without a POST body: `api.searchSongsGet('lofi', type: 'song')`.

### Fallback: YouTube embed (Vercel / no ffmpeg)

If you only have Vercel, play with `videoId` via [`youtube_player_iframe`](https://pub.dev/packages/youtube_player_iframe) (hidden iframe + your own controls). Skip items without `videoId`; some videos block embedding.

**Error handling**

- Wrap calls in `try / on WaveboxApiException`.
- Prefer `streamUrl` for first play; use `audioUrl` when `cached: true` / `status: "ready"`.
- On stream failure, fall back to YouTube embed or open `https://www.youtube.com/watch?v=$videoId`.

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

1. Install **ffmpeg** and **yt-dlp** (required for progressive audio):

```bash
winget install ffmpeg
pip install -U yt-dlp
```

2. Start the server:

```bash
npm start
```

Use these paths with `http://localhost:3000`:

```text
http://localhost:3000/                                   # web demo + custom player
http://localhost:3000/api                                # JSON docs
http://localhost:3000/api/health
http://localhost:3000/api/request
http://localhost:3000/api/search?q=pathaan&type=song
http://localhost:3000/api/lyrics?title=...&artist=...
http://localhost:3000/api/audio?videoId=AU9AdGIdWZs      # returns streamUrl + audioUrl
http://localhost:3000/api/audio/stream/AU9AdGIdWZs       # progressive MP3 stream
http://localhost:3000/audio/AU9AdGIdWZs.mp3              # cached file (after convert)
```

---

## Quick reference

| Endpoint | Example URL |
|----------|-------------|
| Web demo | `http://localhost:3000/` or `https://YOUR-PROJECT.vercel.app/` |
| API docs (JSON) | `.../api` |
| Health | `.../api/health` |
| **Gateway (POST JSON)** | `.../api/request` |
| Search | `.../api/search?q=pathaan&type=song` |
| Suggestions | `.../api/suggestions?q=path` |
| Lyrics | `.../api/lyrics?title=...&artist=...` |
| **Audio status (local)** | `http://localhost:3000/api/audio?videoId=...` |
| **Audio stream (local)** | `http://localhost:3000/api/audio/stream/:videoId` |
| Cached MP3 (local) | `http://localhost:3000/audio/:videoId.mp3` |
| Album | `.../api/album/:browseId` |
| Artist | `.../api/artist/:browseId` |
| Playlist | `.../api/playlist/:browseId` |

CORS: `Access-Control-Allow-Origin: *` — safe to call from Flutter and browser apps.
