# Flutter client for Wavebox API

## 1. Deploy API to Vercel

From the project root (parent folder):

```bash
npm install
npx vercel --prod
```

Copy your production URL, e.g. `https://wavebox-api.vercel.app`.

Test:

```bash
curl https://YOUR-URL.vercel.app/api/health
```

For **progressive MP3** (`streamUrl` / `audioUrl`), run local Express with ffmpeg + yt-dlp (`npm start`) — audio is not available on Vercel.

## 2. Add to your Flutter app

**pubspec.yaml**

```yaml
dependencies:
  http: ^1.2.0
  just_audio: ^0.9.40   # local progressive MP3 playback
```

Copy [`wavebox_api.dart`](./wavebox_api.dart) into your project, e.g. `lib/services/wavebox_api.dart`.

## 3. Usage

```dart
import 'package:your_app/services/wavebox_api.dart';

final api = WaveboxApi(
  baseUrl: 'https://YOUR-PROJECT.vercel.app', // or http://10.0.2.2:3000 for local audio
);

Future<void> loadMusic() async {
  try {
    final ok = await api.health();
    if (!ok) return;

    final songs = await api.searchSongs('pathaan');
    for (final song in songs) {
      debugPrint('${song.title} — ${song.artist} (${song.duration.label})');
      debugPrint('videoId: ${song.videoId}'); // pass to /api/audio
      debugPrint(song.thumbnail.url ?? '');
    }

    final hints = await api.suggestions('path');
  } on WaveboxApiException catch (e) {
    debugPrint(e.message);
  } finally {
    api.close();
  }
}
```

## 4. Custom player (search → progressive MP3)

**Local + ffmpeg + yt-dlp:** POST `/api/request` with `action: audio`, then prefer **`streamUrl`** (plays while converting). Use **`audioUrl`** when `cached: true` / `status: "ready"` (25-min cache). See [`just_audio`](https://pub.dev/packages/just_audio).

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';

final player = AudioPlayer();

Future<void> playSong(String baseUrl, String videoId) async {
  final res = await http.post(
    Uri.parse('$baseUrl/api/request'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'action': 'audio', 'videoId': videoId}),
  );
  final json = jsonDecode(res.body) as Map<String, dynamic>;
  if (json['status'] != 200) {
    throw Exception(json['message'] ?? 'audio failed');
  }
  final audio = json['response'] as Map<String, dynamic>;
  final url = (audio['cached'] == true || audio['status'] == 'ready')
      ? audio['audioUrl'] as String
      : (audio['streamUrl'] ?? audio['audioUrl']) as String;
  await player.setUrl(url);
  await player.play();
}
```

**Vercel / no ffmpeg:** use a hidden YouTube iframe player and your own UI (`videoId` only).

Full Flutter examples: see **[root README](../README.md#flutter--call-api-and-play-in-a-custom-player)**.

## 5. Base URL per environment (optional)

```dart
const baseUrl = String.fromEnvironment(
  'WAVBOX_API_URL',
  defaultValue: 'https://YOUR-PROJECT.vercel.app',
);
```

Run:

```bash
flutter run --dart-define=WAVBOX_API_URL=https://YOUR-PROJECT.vercel.app
# local audio:
# flutter run --dart-define=WAVBOX_API_URL=http://10.0.2.2:3000
```

## Endpoints used by this client

| Call | HTTP | Path |
|------|------|------|
| `health()` | GET | `/api/health` |
| `searchSongs()` | POST | `/api/request` |
| `suggestions()` | POST | `/api/request` |
| `searchSongsGet()` | GET | `/api/search?q=&type=song` |
| `getAudio()` | POST | `/api/request` action `audio` (local + ffmpeg/yt-dlp) |

Prefer `streamUrl` from the audio response for immediate playback; `audioUrl` is the finished cache file.

All responses: `{ "status", "message", "response" }`.
