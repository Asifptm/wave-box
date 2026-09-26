const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const TTL_MS = 25 * 60 * 1000;
const TTL_MINUTES = 25;
const CLEANUP_EVERY_MS = 5 * 60 * 1000;
const MAX_LIVE_STREAMS = 3;
const MAX_ERRORS = 32;
/** Start HTTP streaming once this many bytes exist (fast first audio). */
const MIN_STREAM_BYTES = 48 * 1024;
const AUDIO_DIR = path.join(__dirname, "..", "tmp", "audio");

/** @type {Map<string, { promise: Promise<void>, partPath: string, dest: string, done: boolean, error: string|null, bytes: number }>} */
const convertJobs = new Map();
/** @type {Map<string, string>} */
const lastError = new Map();

let cleanupStarted = false;
let cachedFfmpeg = null;
let cachedYtDlp = null;
let dirReady = false;

function ensureAudioDir() {
  if (dirReady) return;
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  dirReady = true;
}

function validateVideoId(videoId) {
  if (!videoId || typeof videoId !== "string") {
    throw Object.assign(new Error("videoId is required."), { status: 400 });
  }
  const id = videoId.trim();
  if (!VIDEO_ID_RE.test(id)) {
    throw Object.assign(new Error("Invalid videoId. Expected 11-character YouTube id."), {
      status: 400,
    });
  }
  return id;
}

function filePathFor(videoId) {
  return path.join(AUDIO_DIR, `${videoId}.mp3`);
}

function partPathFor(videoId) {
  return path.join(AUDIO_DIR, `${videoId}.mp3.part`);
}

function expiresAtFromMtime(mtimeMs) {
  return new Date(mtimeMs + TTL_MS);
}

function isFresh(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size < 1024) return false;
    return Date.now() - st.mtimeMs < TTL_MS;
  } catch {
    return false;
  }
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function rememberError(id, message) {
  lastError.set(id, message);
  while (lastError.size > MAX_ERRORS) {
    lastError.delete(lastError.keys().next().value);
  }
}

function checkBinaryOnce(kind, cmd, args) {
  return new Promise((resolve) => {
    if (kind === "ffmpeg" && cachedFfmpeg !== null) return resolve(cachedFfmpeg);
    if (kind === "yt-dlp" && cachedYtDlp !== null) return resolve(cachedYtDlp);

    const proc = spawn(cmd, args, { windowsHide: true });
    let ok = false;
    proc.on("error", () => {
      if (kind === "ffmpeg") cachedFfmpeg = false;
      else cachedYtDlp = false;
      resolve(false);
    });
    proc.stdout?.on("data", () => {
      ok = true;
    });
    proc.on("close", (code) => {
      const result = ok || code === 0;
      if (kind === "ffmpeg") cachedFfmpeg = result;
      else cachedYtDlp = result;
      resolve(result);
    });
  });
}

function checkFfmpegAvailable() {
  return checkBinaryOnce("ffmpeg", "ffmpeg", ["-version"]);
}

function checkYtDlpAvailable() {
  return checkBinaryOnce("yt-dlp", "yt-dlp", ["--version"]);
}

/** @type {{ path: string|null, bytes: number, looksValid: boolean, reason: string|null }} */
let cookiesInfoCache = null;

function inspectCookiesFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const sample = fs.readFileSync(filePath, { encoding: "utf8" }).slice(0, 4000);
    const hasYoutube = /youtube\.com/i.test(sample);
    const hasTabs = sample.includes("\t");
    const hasHeader =
      /#\s*Netscape/i.test(sample) || /#\s*HTTP Cookie File/i.test(sample) || hasTabs;
    const looksValid = st.size > 80 && hasYoutube && hasHeader;
    return {
      path: filePath,
      bytes: st.size,
      looksValid,
      reason: looksValid
        ? null
        : !hasYoutube
          ? "cookies file missing youtube.com entries"
          : st.size <= 80
            ? "cookies file too small"
            : "cookies file does not look like Netscape cookies.txt",
    };
  } catch (err) {
    return {
      path: filePath,
      bytes: 0,
      looksValid: false,
      reason: err.message || "cannot read cookies file",
    };
  }
}

/** Optional Netscape cookies.txt — required when YouTube blocks datacenter IPs. */
function resolveCookiesPath() {
  const tryWrite = (bufOrText, isBuf) => {
    const p = path.join(require("os").tmpdir(), "wavebox-youtube-cookies.txt");
    fs.writeFileSync(p, bufOrText, isBuf ? { mode: 0o600 } : { encoding: "utf8", mode: 0o600 });
    cookiesInfoCache = inspectCookiesFile(p);
    return cookiesInfoCache.looksValid ? p : null;
  };

  const b64 = process.env.YOUTUBE_COOKIES_B64;
  if (b64 && String(b64).trim()) {
    try {
      const buf = Buffer.from(String(b64).replace(/\s+/g, ""), "base64");
      const p = tryWrite(buf, true);
      if (p) return p;
      // Keep file for diagnostics even if looks invalid — still try yt-dlp
      return path.join(require("os").tmpdir(), "wavebox-youtube-cookies.txt");
    } catch {
      cookiesInfoCache = {
        path: null,
        bytes: 0,
        looksValid: false,
        reason: "YOUTUBE_COOKIES_B64 is not valid base64",
      };
    }
  }

  const fromEnv = process.env.YOUTUBE_COOKIES;
  if (fromEnv && String(fromEnv).trim()) {
    try {
      const text = String(fromEnv).includes("\n")
        ? String(fromEnv)
        : String(fromEnv).replace(/\\n/g, "\n");
      const p = tryWrite(text, false);
      if (p) return p;
      return path.join(require("os").tmpdir(), "wavebox-youtube-cookies.txt");
    } catch {
      /* fall through */
    }
  }
  const candidates = [
    process.env.YOUTUBE_COOKIES_FILE,
    path.join(__dirname, "..", "cookies.txt"),
    "/app/cookies.txt",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        cookiesInfoCache = inspectCookiesFile(c);
        return c;
      }
    } catch {
      /* ignore */
    }
  }
  if (!cookiesInfoCache) {
    cookiesInfoCache = {
      path: null,
      bytes: 0,
      looksValid: false,
      reason: "no YOUTUBE_COOKIES_B64 / YOUTUBE_COOKIES set",
    };
  }
  return null;
}

function getCookiesDiagnostics() {
  resolveCookiesPath();
  return cookiesInfoCache || {
    path: null,
    bytes: 0,
    looksValid: false,
    reason: "unknown",
  };
}

function buildYtDlpArgs(watchUrl) {
  const args = [
    "-o",
    "-",
    "--no-playlist",
    "--no-warnings",
    "--no-part",
    "--retries",
    "5",
    "--fragment-retries",
    "5",
    // YouTube often needs a JS runtime to solve challenges and list formats
    "--js-runtimes",
    `node:${process.execPath}`,
    "--remote-components",
    "ejs:github",
    "--extractor-args",
    "youtube:player_client=web,android,ios",
    "--user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "--add-header",
    "Accept-Language:en-US,en;q=0.9",
  ];
  const cookies = resolveCookiesPath();
  if (cookies) {
    args.push("--cookies", cookies);
  }
  args.push(watchUrl);
  return args;
}

function friendlyYtDlpError(stderrTail) {
  const raw = String(stderrTail || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("sign in to confirm") || lower.includes("not a bot")) {
    return (
      "YouTube blocked this server (bot check). Add cookies on Railway: set YOUTUBE_COOKIES " +
      "from a cookies.txt export. See DEPLOY-AUDIO.md."
    );
  }
  if (lower.includes("no video formats found") || lower.includes("requested format is not available")) {
    return (
      "YouTube returned no playable formats. Re-export cookies (use YOUTUBE_COOKIES_B64) " +
      "and redeploy so yt-dlp is up to date. See DEPLOY-AUDIO.md."
    );
  }
  if (lower.includes("private video") || lower.includes("login required")) {
    return "This video is private or requires login.";
  }
  if (raw.length > 280) return `yt-dlp failed: ${raw.slice(-280)}`;
  return raw ? `yt-dlp failed: ${raw}` : "yt-dlp failed.";
}

function cleanupExpired() {
  ensureAudioDir();
  let files;
  try {
    files = fs.readdirSync(AUDIO_DIR);
  } catch {
    return;
  }
  const now = Date.now();
  for (let i = 0; i < files.length; i++) {
    const name = files[i];
    if (
      !name.endsWith(".mp3") &&
      !name.endsWith(".part") &&
      !name.endsWith(".webm") &&
      !name.endsWith(".m4a") &&
      !name.endsWith(".opus")
    ) {
      continue;
    }
    const full = path.join(AUDIO_DIR, name);
    try {
      const st = fs.statSync(full);
      if (now - st.mtimeMs > TTL_MS) fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }
}

function startCleanupInterval() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  cleanupExpired();
  setInterval(cleanupExpired, CLEANUP_EVERY_MS).unref?.();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * One conversion job per videoId — writes growing .part then renames to .mp3.
 * Readers stream the growing file (no tee backpressure).
 */
function ensureConvertJob(videoId) {
  const id = validateVideoId(videoId);
  ensureAudioDir();
  startCleanupInterval();

  const dest = filePathFor(id);
  if (isFresh(dest)) return convertJobs.get(id) || null;

  const existing = convertJobs.get(id);
  if (existing && !existing.done) return existing;

  if (convertJobs.size >= MAX_LIVE_STREAMS && !convertJobs.has(id)) {
    throw Object.assign(new Error("Too many concurrent conversions. Try again shortly."), {
      status: 503,
    });
  }

  const partPath = partPathFor(id);
  try {
    if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
  } catch {
    /* ignore */
  }

  const job = {
    partPath,
    dest,
    done: false,
    error: null,
    bytes: 0,
    promise: null,
  };

  job.promise = (async () => {
    const [hasFfmpeg, hasYtDlp] = await Promise.all([
      checkFfmpegAvailable(),
      checkYtDlpAvailable(),
    ]);
    if (!hasFfmpeg) throw new Error("ffmpeg is not installed or not on PATH.");
    if (!hasYtDlp) throw new Error("yt-dlp is not installed or not on PATH.");

    const url = `https://www.youtube.com/watch?v=${id}`;
    await new Promise((resolve, reject) => {
      const ytdlp = spawn("yt-dlp", buildYtDlpArgs(url), {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-fflags",
          "+nobuffer",
          "-flags",
          "low_delay",
          "-probesize",
          "32768",
          "-analyzeduration",
          "0",
          "-i",
          "pipe:0",
          "-vn",
          "-acodec",
          "libmp3lame",
          "-b:a",
          "128k",
          "-f",
          "mp3",
          "pipe:1",
        ],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
      );

      let stderrTail = "";
      const onErr = (c) => {
        stderrTail = (stderrTail + c.toString()).slice(-800);
      };
      ytdlp.stderr.on("data", onErr);
      ffmpeg.stderr.on("data", onErr);

      const fileOut = fs.createWriteStream(partPath, { highWaterMark: 64 * 1024 });

      ytdlp.stdout.pipe(ffmpeg.stdin);
      ffmpeg.stdout.on("data", (chunk) => {
        job.bytes += chunk.length;
        if (!fileOut.write(chunk)) {
          ffmpeg.stdout.pause();
          fileOut.once("drain", () => ffmpeg.stdout.resume());
        }
      });

      let settled = false;
      const fail = (msg) => {
        if (settled) return;
        settled = true;
        try {
          ytdlp.kill("SIGTERM");
        } catch {
          /* ignore */
        }
        try {
          ffmpeg.kill("SIGTERM");
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      };

      ytdlp.on("error", (e) => fail(e.message || "yt-dlp failed"));
      ffmpeg.on("error", (e) => fail(e.message || "ffmpeg failed"));

      ytdlp.on("close", (code) => {
        if (code !== 0 && job.bytes === 0) {
          fail(friendlyYtDlpError(stderrTail));
          return;
        }
        try {
          ffmpeg.stdin.end();
        } catch {
          /* ignore */
        }
      });

      ffmpeg.on("close", (code) => {
        fileOut.end(() => {
          if (settled) return;
          settled = true;
          if (code === 0 && job.bytes > 1024) {
            try {
              fs.renameSync(partPath, dest);
              resolve();
            } catch (err) {
              reject(err);
            }
          } else {
            try {
              if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
            } catch {
              /* ignore */
            }
            reject(
              new Error(
                `Conversion failed${stderrTail ? `: ${stderrTail.trim()}` : ` (exit ${code})`}`
              )
            );
          }
        });
      });
    });
  })()
    .then(() => {
      job.done = true;
      job.error = null;
      lastError.delete(id);
    })
    .catch((err) => {
      job.done = true;
      job.error = err.message || String(err);
      rememberError(id, job.error);
    })
    .finally(() => {
      // Keep job entry briefly so streamers can finish reading the final file.
      setTimeout(() => {
        const cur = convertJobs.get(id);
        if (cur === job && cur.done) convertJobs.delete(id);
      }, 30_000);
    });

  convertJobs.set(id, job);
  return job;
}

function getAudioStatus(videoId, opts = {}) {
  const startIfNeeded = opts.startIfNeeded !== false;
  const id = validateVideoId(videoId);
  ensureAudioDir();
  startCleanupInterval();

  const dest = filePathFor(id);
  if (isFresh(dest)) {
    const st = fs.statSync(dest);
    lastError.delete(id);
    return {
      videoId: id,
      status: "ready",
      filePath: dest,
      expiresAt: expiresAtFromMtime(st.mtimeMs),
      cached: true,
      converting: false,
      error: null,
    };
  }

  const job = convertJobs.get(id);
  if (job && !job.done) {
    return {
      videoId: id,
      status: "streaming",
      filePath: null,
      expiresAt: null,
      cached: false,
      converting: true,
      bytes: job.bytes,
      error: null,
    };
  }

  if (lastError.has(id) && (!job || job.done)) {
    // Allow a fresh convert attempt when the client asks to start again.
    if (startIfNeeded) {
      lastError.delete(id);
    } else {
      return {
        videoId: id,
        status: "error",
        filePath: null,
        expiresAt: null,
        cached: false,
        converting: false,
        error: lastError.get(id),
      };
    }
  }

  if (startIfNeeded) {
    try {
      ensureConvertJob(id);
    } catch (err) {
      return {
        videoId: id,
        status: "error",
        filePath: null,
        expiresAt: null,
        cached: false,
        converting: false,
        error: err.message,
      };
    }
  }

  return {
    videoId: id,
    status: startIfNeeded ? "streaming" : "idle",
    filePath: null,
    expiresAt: null,
    cached: false,
    converting: !!startIfNeeded,
    error: null,
  };
}

/**
 * Efficient progressive stream:
 * 1) Start/reuse one convert job (writes growing .part)
 * 2) Wait until MIN_STREAM_BYTES
 * 3) Chunk-read the growing file to the client until conversion finishes
 */
async function pipeAudioStream(videoId, res) {
  const id = validateVideoId(videoId);
  ensureAudioDir();
  startCleanupInterval();

  const dest = filePathFor(id);

  if (isFresh(dest)) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=600");
    const st = fs.statSync(dest);
    res.setHeader("Content-Length", String(st.size));
    fs.createReadStream(dest, { highWaterMark: 64 * 1024 }).pipe(res);
    return;
  }

  let job;
  try {
    job = ensureConvertJob(id);
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        status: err.status || 500,
        message: err.message,
        response: null,
      });
    }
    return;
  }

  // Wait for enough bytes to start playback (or job failure).
  const waitStart = Date.now();
  while (true) {
    if (isFresh(dest)) break;
    if (job.error) {
      if (!res.headersSent) {
        res.status(500).json({
          status: 500,
          message: job.error,
          response: null,
        });
      }
      return;
    }
    const size = Math.max(job.bytes, fileSize(job.partPath), fileSize(dest));
    if (size >= MIN_STREAM_BYTES) break;
    if (Date.now() - waitStart > 90_000) {
      if (!res.headersSent) {
        res.status(504).json({
          status: 504,
          message: "Timed out waiting for audio buffer.",
          response: null,
        });
      }
      return;
    }
    await sleep(120);
  }

  if (isFresh(dest) && !res.headersSent) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=600");
    const st = fs.statSync(dest);
    res.setHeader("Content-Length", String(st.size));
    fs.createReadStream(dest, { highWaterMark: 64 * 1024 }).pipe(res);
    return;
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Wavebox-Stream", "progressive");
  res.flushHeaders?.();

  let offset = 0;
  let closed = false;
  res.on("close", () => {
    closed = true;
  });

  const readPath = () => (isFresh(dest) ? dest : job.partPath);

  while (!closed) {
    if (job.error && offset === 0) {
      if (!res.writableEnded) res.end();
      return;
    }

    const p = readPath();
    const size = fileSize(p);
    if (size > offset) {
      await new Promise((resolve, reject) => {
        const rs = fs.createReadStream(p, {
          start: offset,
          end: size - 1,
          highWaterMark: 64 * 1024,
        });
        rs.on("data", (chunk) => {
          offset += chunk.length;
          if (!res.write(chunk)) {
            rs.pause();
            res.once("drain", () => rs.resume());
          }
        });
        rs.on("end", resolve);
        rs.on("error", reject);
      }).catch(() => {});
      continue;
    }

    if (job.done || isFresh(dest)) {
      // Final catch-up from finished file
      if (isFresh(dest)) {
        const finalSize = fileSize(dest);
        if (finalSize > offset) {
          await new Promise((resolve) => {
            const rs = fs.createReadStream(dest, {
              start: offset,
              end: finalSize - 1,
              highWaterMark: 64 * 1024,
            });
            rs.on("data", (chunk) => {
              offset += chunk.length;
              res.write(chunk);
            });
            rs.on("end", resolve);
            rs.on("error", resolve);
          });
        }
      }
      if (!res.writableEnded) res.end();
      return;
    }

    await sleep(100);
  }
}

function buildAudioUrl(baseUrl, videoId) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/audio/${videoId}.mp3`;
}

function buildStreamUrl(baseUrl, videoId) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/api/audio/stream/${videoId}`;
}

function startConversion(videoId) {
  try {
    ensureConvertJob(videoId);
  } catch {
    /* ignore */
  }
}

async function getOrCreateMp3(videoId) {
  const id = validateVideoId(videoId);
  const dest = filePathFor(id);
  if (isFresh(dest)) {
    const st = fs.statSync(dest);
    return {
      videoId: id,
      filePath: dest,
      expiresAt: expiresAtFromMtime(st.mtimeMs),
      cached: true,
    };
  }
  throw Object.assign(
    new Error("Use GET /api/audio/stream/:videoId for progressive playback."),
    { status: 409 }
  );
}

module.exports = {
  VIDEO_ID_RE,
  TTL_MS,
  TTL_MINUTES,
  AUDIO_DIR,
  MAX_LIVE_STREAMS,
  MIN_STREAM_BYTES,
  validateVideoId,
  getOrCreateMp3,
  getAudioStatus,
  startConversion,
  ensureConvertJob,
  pipeAudioStream,
  buildAudioUrl,
  buildStreamUrl,
  startCleanupInterval,
  ensureAudioDir,
  isFresh,
  filePathFor,
  checkFfmpegAvailable,
  checkYtDlpAvailable,
  getCookiesDiagnostics,
  resolveCookiesPath,
};
