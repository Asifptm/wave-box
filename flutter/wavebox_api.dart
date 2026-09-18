// Wavebox YouTube Music API — Flutter client
// Add to pubspec.yaml:  http: ^1.2.0
//
//   final api = WaveboxApi(baseUrl: 'https://YOUR-PROJECT.vercel.app');
//   final songs = await api.searchSongs('pathaan');

import 'dart:convert';

import 'package:http/http.dart' as http;

class WaveboxApiException implements Exception {
  WaveboxApiException(this.message, {this.status = 0});
  final String message;
  final int status;

  @override
  String toString() => 'WaveboxApiException($status): $message';
}

class WaveboxEnvelope<T> {
  WaveboxEnvelope({
    required this.status,
    required this.message,
    required this.response,
    this.meta,
  });

  final int status;
  final String message;
  final T response;
  final Map<String, dynamic>? meta;

  factory WaveboxEnvelope.fromJson(
    Map<String, dynamic> json,
    T Function(Object? json) parseResponse,
  ) {
    return WaveboxEnvelope(
      status: json['status'] as int? ?? 0,
      message: json['message'] as String? ?? '',
      response: parseResponse(json['response']),
      meta: json['meta'] is Map<String, dynamic>
          ? json['meta'] as Map<String, dynamic>
          : null,
    );
  }
}

class SongDuration {
  SongDuration({this.ms, this.seconds, this.label});

  final int? ms;
  final int? seconds;
  final String? label;

  factory SongDuration.fromJson(Map<String, dynamic>? json) {
    if (json == null) return SongDuration();
    return SongDuration(
      ms: json['ms'] as int?,
      seconds: json['seconds'] as int?,
      label: json['label'] as String?,
    );
  }
}

class SongThumbnail {
  SongThumbnail({this.url, this.width, this.height});

  final String? url;
  final int? width;
  final int? height;

  factory SongThumbnail.fromJson(Map<String, dynamic>? json) {
    if (json == null) return SongThumbnail();
    return SongThumbnail(
      url: json['url'] as String?,
      width: json['width'] as int?,
      height: json['height'] as int?,
    );
  }
}

class SongItem {
  SongItem({
    required this.id,
    required this.title,
    required this.artist,
    required this.artists,
    required this.album,
    required this.duration,
    required this.thumbnail,
    required this.videoId,
  });

  final String? id;
  final String? title;
  final String? artist;
  final List<String> artists;
  final String? album;
  final SongDuration duration;
  final SongThumbnail thumbnail;
  final String? videoId;

  factory SongItem.fromJson(Map<String, dynamic> json) {
    return SongItem(
      id: json['id'] as String? ?? json['videoId'] as String?,
      videoId: json['videoId'] as String?,
      title: json['title'] as String?,
      artist: json['artist'] as String?,
      artists: (json['artists'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      album: json['album'] as String?,
      duration: SongDuration.fromJson(
        json['duration'] as Map<String, dynamic>?,
      ),
      thumbnail: SongThumbnail.fromJson(
        json['thumbnail'] as Map<String, dynamic>?,
      ),
    );
  }
}

class SearchResult {
  SearchResult({
    required this.items,
    required this.count,
    required this.query,
    required this.type,
  });

  final List<SongItem> items;
  final int count;
  final String? query;
  final String? type;

  factory SearchResult.fromJson(Object? json) {
    final map = json is Map<String, dynamic> ? json : <String, dynamic>{};
    final list = map['items'] as List<dynamic>? ?? [];
    return SearchResult(
      items: list
          .whereType<Map<String, dynamic>>()
          .map(SongItem.fromJson)
          .toList(),
      count: map['count'] as int? ?? list.length,
      query: map['query'] as String?,
      type: map['type'] as String?,
    );
  }
}

class WaveboxApi {
  WaveboxApi({
    required this.baseUrl,
    http.Client? client,
    this.defaultSearchType = 'song',
  }) : _client = client ?? http.Client();

  /// Production: https://your-project.vercel.app (no trailing slash)
  final String baseUrl;
  final String defaultSearchType;
  final http.Client _client;

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path');
  }

  Future<Map<String, dynamic>> _postRequest(Map<String, dynamic> body) async {
    final res = await _client.post(
      _uri('/api/request'),
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: jsonEncode(body),
    );

    Map<String, dynamic> json;
    try {
      json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {
      throw WaveboxApiException(
        'Invalid JSON (${res.statusCode})',
        status: res.statusCode,
      );
    }

    final status = json['status'] as int? ?? res.statusCode;
    if (status != 200) {
      throw WaveboxApiException(
        json['message'] as String? ?? 'Request failed',
        status: status,
      );
    }
    return json;
  }

  /// GET /api/health
  Future<bool> health() async {
    final res = await _client.get(_uri('/api/health'));
    final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    return json['status'] == 200 && (json['response']?['ok'] == true);
  }

  /// POST action: search — normalized songs in response.items
  Future<List<SongItem>> searchSongs(
    String query, {
    String? type,
  }) async {
    final json = await _postRequest({
      'action': 'search',
      'query': query,
      'type': type ?? defaultSearchType,
    });
    final envelope = WaveboxEnvelope.fromJson(
      json,
      (r) => SearchResult.fromJson(r),
    );
    return envelope.response.items;
  }

  /// POST action: suggestions
  Future<List<String>> suggestions(String query) async {
    final json = await _postRequest({
      'action': 'suggestions',
      'query': query,
    });
    final list = json['response']?['suggestions'] as List<dynamic>? ?? [];
    return list.map((e) => e.toString()).toList();
  }

  /// GET /api/search (alternative, no POST body)
  Future<List<SongItem>> searchSongsGet(String query, {String? type}) async {
    final uri = _uri('/api/search').replace(
      queryParameters: {
        'q': query,
        'type': type ?? defaultSearchType,
      },
    );
    final res = await _client.get(uri);
    final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    if (json['status'] != 200) {
      throw WaveboxApiException(
        json['message'] as String? ?? 'Search failed',
        status: json['status'] as int? ?? res.statusCode,
      );
    }
    return SearchResult.fromJson(json['response']).items;
  }

  void close() => _client.close();
}
