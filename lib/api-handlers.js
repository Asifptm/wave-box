const { withYtm } = require("./ytm");
const { applyCors } = require("./http");
const { getApiDocs } = require("./api-docs");
const { getInput } = require("./parse-input");
const { sendSuccess, sendError } = require("./response");
const { normalizeSearchResult, normalizeAlbum } = require("./normalize");
const { fetchLyrics } = require("./lyrics");
const { getAudioStatus, buildAudioUrl, buildStreamUrl, TTL_MINUTES, pipeAudioStream, validateVideoId, checkFfmpegAvailable, checkYtDlpAvailable } = require("./audio");
const { TtlLruCache } = require("./cache");

/** Short-lived caches — cut repeat YouTube Music round-trips (O(1) hit). */
const searchCache = new TtlLruCache({ max: 48, ttlMs: 90_000 });
const suggestCache = new TtlLruCache({ max: 64, ttlMs: 120_000 });
const lyricsCache = new TtlLruCache({ max: 48, ttlMs: 300_000 });

function cacheKey(parts) {
  return parts.map((p) => String(p || "").toLowerCase().trim()).join("|");
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function conversionEnabled() {
  if (isVercelRuntime()) return false;
  if (process.env.WAVEBOX_CONVERSION === "0" || process.env.WAVEBOX_CONVERSION === "false") {
    return false;
  }
  return true;
}

/** Absolute public origin for streamUrl/audioUrl (Railway/Render proxies). */
function requestBaseUrl(req) {
  const forced = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (forced) return forced;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function configuredAudioBaseUrl() {
  return String(process.env.WAVEBOX_AUDIO_URL || "").trim().replace(/\/$/, "") || null;
}

async function handleRoot(req, res) {
  applyCors(res);
  const baseUrl = requestBaseUrl(req);
  sendSuccess(res, getApiDocs(baseUrl), { message: "Wavebox API documentation" });
}

async function handleHealth(req, res) {
  applyCors(res);
  try {
    const { initYtm } = require("./ytm");
    await initYtm();
    const onVercel = isVercelRuntime();
    const canConvert = conversionEnabled();
    let ffmpeg = false;
    let ytDlp = false;
    if (canConvert) {
      [ffmpeg, ytDlp] = await Promise.all([checkFfmpegAvailable(), checkYtDlpAvailable()]);
    }
    sendSuccess(res, {
      ok: true,
      service: "wavebox-api",
      conversion: canConvert && ffmpeg && ytDlp,
      conversionHost: !onVercel,
      ffmpeg,
      ytDlp,
      cookiesConfigured: Boolean(
        process.env.YOUTUBE_COOKIES_B64 ||
          process.env.YOUTUBE_COOKIES ||
          process.env.YOUTUBE_COOKIES_FILE ||
          require("fs").existsSync(require("path").join(__dirname, "..", "cookies.txt"))
      ),
      /** Set WAVEBOX_AUDIO_URL on Vercel to point the web demo at a Docker audio host */
      audioBaseUrl: configuredAudioBaseUrl(),
    });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handleSuggestions(req, res) {
  applyCors(res);
  const input = await getInput(req);
  const q = input.q;
  if (!q) {
    sendError(res, 400, "Field q or query is required.");
    return;
  }
  try {
    const key = cacheKey(["sug", q]);
    const cached = suggestCache.get(key);
    if (cached) {
      sendSuccess(res, cached, { meta: { action: "suggestions", cached: true } });
      return;
    }
    const suggestions = await withYtm((api) => api.getSearchSuggestions(q));
    const payload = { suggestions, query: q };
    suggestCache.set(key, payload);
    sendSuccess(res, payload, { meta: { action: "suggestions" } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handleSearch(req, res) {
  applyCors(res);
  const input = await getInput(req);
  const q = input.q;
  const type = input.type;
  if (!q) {
    sendError(res, 400, "Field q or query is required.");
    return;
  }
  try {
    const key = cacheKey(["search", q, type]);
    const cached = searchCache.get(key);
    if (cached) {
      sendSuccess(res, cached, { meta: { action: "search", type, cached: true } });
      return;
    }
    const raw = await withYtm((api) => api.search(q, type));
    const normalized = normalizeSearchResult(raw, type);
    const payload = { ...normalized, query: q };
    searchCache.set(key, payload);
    sendSuccess(res, payload, { meta: { action: "search", type } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handleAlbum(req, res, browseId) {
  applyCors(res);
  const input = await getInput(req);
  const id = browseId || input.browseId;
  if (!id) {
    sendError(res, 400, "browseId is required.");
    return;
  }
  try {
    const raw = await withYtm((api) => api.getAlbum(id));
    sendSuccess(res, normalizeAlbum(raw), { meta: { action: "album", browseId: id } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handleArtist(req, res, browseId) {
  applyCors(res);
  const input = await getInput(req);
  const id = browseId || input.browseId;
  if (!id) {
    sendError(res, 400, "browseId is required.");
    return;
  }
  try {
    const result = await withYtm((api) => api.getArtist(id));
    sendSuccess(res, result, { meta: { action: "artist", browseId: id } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handlePlaylist(req, res, browseId) {
  applyCors(res);
  const input = await getInput(req);
  const id = browseId || input.browseId;
  if (!id) {
    sendError(res, 400, "browseId is required.");
    return;
  }
  try {
    const result = await withYtm((api) => api.getPlaylist(id));
    sendSuccess(res, result, { meta: { action: "playlist", browseId: id } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
}

async function handleAudio(req, res) {
  applyCors(res);
  if (isVercelRuntime()) {
    const audioHost = configuredAudioBaseUrl();
    sendError(
      res,
      501,
      audioHost
        ? `Audio conversion is not on Vercel. Use the audio host: ${audioHost}/api/audio?videoId=...`
        : "Audio MP3 conversion needs Docker/local Express (ffmpeg + yt-dlp). See DEPLOY-AUDIO.md or set WAVEBOX_AUDIO_URL."
    );
    return;
  }
  const input = await getInput(req);
  const videoId = input.videoId || input.id;
  if (!videoId) {
    sendError(res, 400, "Field videoId or id is required.");
    return;
  }

  const startRaw = input.raw?.start ?? input.raw?.convert;
  const startIfNeeded =
    startRaw === undefined || startRaw === null || startRaw === ""
      ? true
      : !["0", "false", "no", false, 0].includes(startRaw);

  try {
    const result = getAudioStatus(videoId, { startIfNeeded });
    const baseUrl = requestBaseUrl(req);

    if (result.status === "error") {
      sendError(res, 500, result.error || "Audio conversion failed.");
      return;
    }

    sendSuccess(
      res,
      {
        videoId: result.videoId,
        status: result.status === "ready" ? "ready" : "streaming",
        converting: result.converting,
        /** Progressive MP3 stream — play immediately while conversion continues */
        streamUrl: buildStreamUrl(baseUrl, result.videoId),
        /** Cached file URL once ready (same bytes after stream finishes) */
        audioUrl: buildAudioUrl(baseUrl, result.videoId),
        contentType: "audio/mpeg",
        expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
        cached: result.cached,
        ttlMinutes: TTL_MINUTES,
      },
      { meta: { action: "audio", videoId: result.videoId, status: result.status } }
    );
  } catch (err) {
    sendError(res, err.status || 500, err.message || "Audio conversion failed.");
  }
}

async function handleAudioStream(req, res, videoIdParam) {
  applyCors(res);
  if (isVercelRuntime()) {
    sendError(
      res,
      501,
      "Progressive audio streaming is local-only. Run npm start and use GET /api/audio/stream/:videoId"
    );
    return;
  }
  const input = await getInput(req);
  const videoId = videoIdParam || input.videoId || input.id;
  if (!videoId) {
    sendError(res, 400, "videoId is required.");
    return;
  }
  try {
    validateVideoId(videoId);
    await pipeAudioStream(videoId, res);
  } catch (err) {
    if (!res.headersSent) {
      sendError(res, err.status || 500, err.message || "Audio stream failed.");
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

async function handleLyrics(req, res) {
  applyCors(res);
  const input = await getInput(req);
  const title = input.title || "";
  const artist = input.artist || "";
  const q = input.q || [title, artist].filter(Boolean).join(" ");
  const durationSec =
    input.durationSec ||
    input.duration ||
    (input.raw && (input.raw.durationSec || input.raw.duration)) ||
    null;

  if (!q && !title) {
    sendError(res, 400, "Provide title, artist, or q for lyrics lookup.");
    return;
  }

  try {
    const key = cacheKey(["lyrics", title, artist, q, durationSec]);
    const cached = lyricsCache.get(key);
    if (cached) {
      sendSuccess(res, cached, { meta: { action: "lyrics", cached: true } });
      return;
    }
    const lyrics = await fetchLyrics({
      title: title || input.raw?.title,
      artist: artist || input.raw?.artist,
      q,
      durationSec: durationSec ? Number(durationSec) : undefined,
    });
    lyricsCache.set(key, lyrics);
    sendSuccess(res, lyrics, { meta: { action: "lyrics" } });
  } catch (err) {
    sendError(res, err.status || 500, err.message || "Lyrics lookup failed.");
  }
}

/**
 * Unified POST (or GET) gateway — send JSON body with action + fields.
 */
async function handleRequest(req, res) {
  applyCors(res);
  const input = await getInput(req);
  const action = input.action;

  if (!action) {
    sendError(res, 400, "Field action is required.", {
      allowed: [
        "health",
        "search",
        "suggestions",
        "album",
        "artist",
        "playlist",
        "audio",
        "lyrics",
      ],
    });
    return;
  }

  switch (action) {
    case "health":
      return handleHealth(req, res);
    case "search":
      return handleSearch(req, res);
    case "suggestions":
      return handleSuggestions(req, res);
    case "album":
      return handleAlbum(req, res, input.browseId);
    case "artist":
      return handleArtist(req, res, input.browseId);
    case "playlist":
      return handlePlaylist(req, res, input.browseId);
    case "audio":
      return handleAudio(req, res);
    case "lyrics":
      return handleLyrics(req, res);
    default:
      sendError(res, 400, `Unknown action: ${action}`);
  }
}

module.exports = {
  handleRoot,
  handleHealth,
  handleSuggestions,
  handleSearch,
  handleAlbum,
  handleArtist,
  handlePlaylist,
  handleAudio,
  handleAudioStream,
  handleLyrics,
  handleRequest,
};
