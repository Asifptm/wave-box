const express = require("express");
const {
  handleRoot,
  handleHealth,
  handleSuggestions,
  handleSearch,
  handleAlbum,
  handleArtist,
  handlePlaylist,
  handleRequest,
} = require("./lib/api-handlers");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const route = (path, handler) => {
  app.get(path, (req, res) => handler(req, res));
  app.post(path, (req, res) => handler(req, res));
};

route("/api", handleRoot);
route("/api/request", handleRequest);
route("/api/health", handleHealth);
route("/api/suggestions", handleSuggestions);
route("/api/search", handleSearch);

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

app.use((_req, res) => {
  res.status(404).json({
    status: 404,
    message: "Not found. GET / for API documentation.",
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
  console.log(`Wavebox API at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Try: set PORT=3001&& npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
