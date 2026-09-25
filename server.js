const path = require("path");
const express = require("express");
const {
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
} = require("./lib/api-handlers");
const { AUDIO_DIR, ensureAudioDir, startCleanupInterval } = require("./lib/audio");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");
ensureAudioDir();
startCleanupInterval();

const route = (routePath, handler) => {
  app.get(routePath, (req, res) => handler(req, res));
  app.post(routePath, (req, res) => handler(req, res));
};

route("/api", handleRoot);
route("/api/request", handleRequest);
route("/api/health", handleHealth);
route("/api/suggestions", handleSuggestions);
route("/api/search", handleSearch);
route("/api/audio", handleAudio);
route("/api/lyrics", handleLyrics);

app.get("/api/audio/stream/:videoId", (req, res) =>
  handleAudioStream(req, res, req.params.videoId)
);

app.get("/api/album/:browseId", (req, res) =>
  handleAlbum(req, res, req.params.browseId)
);
app.post("/api/album/:browseId", (req, res) =>
  handleAlbum(req, res, req.params.browseId)
);
app.get("/api/artist/:browseId", (req, res) =>
  handleArtist(req, res, req.params.browseId)
);
app.post("/api/artist/:browseId", (req, res) =>
  handleArtist(req, res, req.params.browseId)
);
app.get("/api/playlist/:browseId", (req, res) =>
  handlePlaylist(req, res, req.params.browseId)
);
app.post("/api/playlist/:browseId", (req, res) =>
  handlePlaylist(req, res, req.params.browseId)
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use(
  "/audio",
  express.static(AUDIO_DIR, {
    maxAge: "1h",
    setHeaders(res) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");
    },
  })
);

app.use(express.static(publicDir));

app.use((_req, res) => {
  res.status(404).json({
    status: 404,
    message: "Not found. GET / for the home page or /api for API documentation.",
    response: null,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    status: 500,
    message: err.message || "Unexpected server error.",
    response: null,
  });
});

const server = app.listen(PORT, () => {
  console.log(`Wavebox at http://localhost:${PORT}/  (API: /api)`);
});

// Keep sockets alive for long progressive streams without holding excess memory.
server.keepAliveTimeout = 75_000;
server.headersTimeout = 80_000;
server.requestTimeout = 0;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Try: set PORT=3001&& npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
