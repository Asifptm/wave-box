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

## 2. Add to your Flutter app

**pubspec.yaml**

```yaml
dependencies:
  http: ^1.2.0
```

Copy [`wavebox_api.dart`](./wavebox_api.dart) into your project, e.g. `lib/services/wavebox_api.dart`.

## 3. Usage

```dart
import 'package:your_app/services/wavebox_api.dart';

final api = WaveboxApi(
  baseUrl: 'https://YOUR-PROJECT.vercel.app',
);

Future<void> loadMusic() async {
  try {
    final ok = await api.health();
    if (!ok) return;

    final songs = await api.searchSongs('pathaan');
    for (final song in songs) {
      debugPrint('${song.title} — ${song.artist} (${song.duration.label})');
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

## 4. Base URL per environment (optional)

```dart
const baseUrl = String.fromEnvironment(
  'WAVBOX_API_URL',
  defaultValue: 'https://YOUR-PROJECT.vercel.app',
);
```

Run:

```bash
flutter run --dart-define=WAVBOX_API_URL=https://YOUR-PROJECT.vercel.app
```

## Endpoints used by this client

| Call | HTTP | Path |
|------|------|------|
| `health()` | GET | `/api/health` |
| `searchSongs()` | POST | `/api/request` |
| `suggestions()` | POST | `/api/request` |
| `searchSongsGet()` | GET | `/api/search?q=&type=song` |

All responses: `{ "status", "message", "response" }`.
