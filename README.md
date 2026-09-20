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

After deploy:

- **`https://YOUR-PROJECT.vercel.app/`** — web demo (search + custom music player)
- **`https://YOUR-PROJECT.vercel.app/api`** — JSON API documentation

---

## Web demo — custom music player

The **`public/index.html`** page is a small client that talks to this API and plays songs with **your own UI** (no visible YouTube controls).

### Flow

1. **Search** — `GET /api/search?q=lofi&type=song` (or POST `/api/request` with `action: search`).
2. **Pick a track** — each song in `response.items` includes a **`videoId`** (YouTube video ID).
3. **Play** — the page loads the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) in a **hidden** iframe (`controls: 0`) and drives playback from custom buttons (play/pause, seek, prev/next, volume).

The API does **not** return a direct MP3/stream URL. Playback uses **`videoId`** with YouTube’s embed player behind your controls (same idea as the built-in demo).

### Try it locally

```bash
npm start
```

Open **`http://localhost:3000/`**, search for a song, click a result. The bottom bar is the custom player.

### Minimal browser example (search → play one track)

```html
<script>
  const API = "/api/search";

  async function searchAndPlay(query) {
    const res = await fetch(`${API}?q=${encodeURIComponent(query)}&type=song`);
    const data = await res.json();
    if (data.status !== 200) throw new Error(data.message);

    const song = data.response.items.find((i) => i.videoId);
    if (!song) throw new Error("No playable songs");

    // Use videoId with YouTube IFrame API (hidden player + your own UI)
    console.log("Now playing:", song.title, song.videoId);
    loadHiddenYoutubePlayer(song.videoId); // see public/index.html for full implementation
  }
</script>
```

See **`public/index.html`** for the full player (queue, errors, suggestions, seek bar).

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

## Flutter — call API and play in a custom player

Copy the client from [`flutter/wavebox_api.dart`](./flutter/wavebox_api.dart). More notes: [`flutter/README.md`](./flutter/README.md).

### What the API gives you

| Field | Use in UI |
|-------|-----------|
| `title`, `artist`, `artists` | Labels in your player |
| `thumbnail.url` | Album art |
| `duration.label` | Total time (before YouTube reports duration) |
| **`videoId`** | **Required for playback** (YouTube embed / iframe player) |

There is **no** `/api/stream` endpoint. Build a custom player UI in Flutter and play each `videoId` with a hidden or chromeless YouTube player (recommended package: [`youtube_player_iframe`](https://pub.dev/packages/youtube_player_iframe)).

### 1. Dependencies

```yaml
dependencies:
  http: ^1.2.0
  youtube_player_iframe: ^5.2.1
```

### 2. Search via Wavebox API

```dart
import 'package:your_app/services/wavebox_api.dart';

final api = WaveboxApi(baseUrl: 'https://YOUR-PROJECT.vercel.app');

Future<List<SongItem>> fetchSongs(String query) async {
  try {
    final songs = await api.searchSongs(query);
    return songs.where((s) => s.videoId != null && s.videoId!.isNotEmpty).toList();
  } on WaveboxApiException catch (e) {
    throw Exception('Search failed: ${e.message}');
  }
}
```

Equivalent **GET** (no POST body):

```dart
final songs = await api.searchSongsGet('lofi', type: 'song');
```

Equivalent **curl**:

```bash
curl "https://YOUR-PROJECT.vercel.app/api/search?q=lofi&type=song"
```

### 3. Custom player widget (hidden YouTube + your controls)

```dart
import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import 'package:your_app/services/wavebox_api.dart';

class WaveboxPlayerScreen extends StatefulWidget {
  const WaveboxPlayerScreen({super.key, required this.api});

  final WaveboxApi api;

  @override
  State<WaveboxPlayerScreen> createState() => _WaveboxPlayerScreenState();
}

class _WaveboxPlayerScreenState extends State<WaveboxPlayerScreen> {
  final _query = TextEditingController(text: 'lofi');
  List<SongItem> _queue = [];
  int _index = 0;
  String? _error;
  YoutubePlayerController? _yt;

  @override
  void dispose() {
    _query.dispose();
    _yt?.close();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() => _error = null);
    try {
      final songs = await widget.api.searchSongs(_query.text.trim());
      if (songs.isEmpty) {
        setState(() => _error = 'No songs found.');
        return;
      }
      setState(() {
        _queue = songs;
        _index = 0;
      });
      await _playCurrent();
    } on WaveboxApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _playCurrent() async {
    final song = _queue[_index];
    final videoId = song.videoId;
    if (videoId == null) {
      setState(() => _error = 'Missing videoId for this track.');
      return;
    }

    _yt?.close();
    _yt = YoutubePlayerController.fromVideoId(
      videoId: videoId,
      autoPlay: true,
      params: const YoutubePlayerParams(
        showControls: false,
        showFullscreenButton: false,
        strictRelatedVideos: true,
        mute: false,
      ),
    );

    setState(() {});
  }

  SongItem get _now => _queue[_index];

  @override
  Widget build(BuildContext context) {
    final song = _queue.isEmpty ? null : _now;

    return Scaffold(
      appBar: AppBar(title: const Text('Wavebox')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _query,
                    decoration: const InputDecoration(labelText: 'Search'),
                    onSubmitted: (_) => _search(),
                  ),
                ),
                IconButton(onPressed: _search, icon: const Icon(Icons.search)),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: ListView.builder(
              itemCount: _queue.length,
              itemBuilder: (_, i) {
                final s = _queue[i];
                return ListTile(
                  selected: i == _index,
                  title: Text(s.title ?? 'Untitled'),
                  subtitle: Text(s.artist ?? ''),
                  onTap: () async {
                    setState(() => _index = i);
                    await _playCurrent();
                  },
                );
              },
            ),
          ),
          if (song != null && _yt != null) ...[
            // Hidden iframe — audio/video plays here; UI is yours below
            SizedBox(
              height: 0,
              child: YoutubePlayer(controller: _yt!, aspectRatio: 16 / 9),
            ),
            _CustomPlayerBar(
              title: song.title ?? '',
              artist: song.artist ?? '',
              artUrl: song.thumbnail.url,
              onPrev: _index > 0
                  ? () async {
                      setState(() => _index--);
                      await _playCurrent();
                    }
                  : null,
              onNext: _index < _queue.length - 1
                  ? () async {
                      setState(() => _index++);
                      await _playCurrent();
                    }
                  : null,
              onPlayPause: () => _yt!.playVideo(),
            ),
          ],
        ],
      ),
    );
  }
}

class _CustomPlayerBar extends StatelessWidget {
  const _CustomPlayerBar({
    required this.title,
    required this.artist,
    required this.artUrl,
    required this.onPlayPause,
    this.onPrev,
    this.onNext,
  });

  final String title;
  final String artist;
  final String? artUrl;
  final VoidCallback onPlayPause;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            if (artUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(artUrl!, width: 56, height: 56, fit: BoxFit.cover),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(artist, maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            IconButton(onPressed: onPrev, icon: const Icon(Icons.skip_previous)),
            IconButton(onPressed: onPlayPause, icon: const Icon(Icons.play_arrow)),
            IconButton(onPressed: onNext, icon: const Icon(Icons.skip_next)),
          ],
        ),
      ),
    );
  }
}
```

**Error handling tips**

- Wrap API calls in `try/on WaveboxApiException` (network, 4xx/5xx, envelope `status != 200`).
- Skip items without `videoId`.
- Some videos block embedding — catch player errors and offer “Open in YouTube” using `https://www.youtube.com/watch?v=$videoId`.

**App entry**

```dart
void main() {
  runApp(MaterialApp(
    home: WaveboxPlayerScreen(
      api: WaveboxApi(baseUrl: 'https://YOUR-PROJECT.vercel.app'),
    ),
  ));
}
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
http://localhost:3000/                              # web demo + custom player
http://localhost:3000/api/health
http://localhost:3000/api/request
http://localhost:3000/api/search?q=pathaan&type=song
```

---


---

## Quick reference

| Endpoint | Example URL |
|----------|-------------|
| Web demo (custom player) | `https://YOUR-PROJECT.vercel.app/` |
| API docs (JSON) | `https://YOUR-PROJECT.vercel.app/api` |
| Health | `https://YOUR-PROJECT.vercel.app/api/health` |
| **Gateway (POST JSON)** | `https://YOUR-PROJECT.vercel.app/api/request` |
| Search | `https://YOUR-PROJECT.vercel.app/api/search?q=pathaan&type=song` |
| Suggestions | `https://YOUR-PROJECT.vercel.app/api/suggestions?q=path` |
| Album | `https://YOUR-PROJECT.vercel.app/api/album/:browseId` |
| Artist | `https://YOUR-PROJECT.vercel.app/api/artist/:browseId` |
| Playlist | `https://YOUR-PROJECT.vercel.app/api/playlist/:browseId` |

CORS: `Access-Control-Allow-Origin: *` — safe to call from Flutter and browser apps.
