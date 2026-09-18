const { withYtm } = require("./ytm");
const { applyCors } = require("./http");
const { getApiDocs } = require("./api-docs");
const { getInput } = require("./parse-input");
const { sendSuccess, sendError } = require("./response");
const { normalizeSearchResult, normalizeAlbum } = require("./normalize");

async function handleRoot(req, res) {
  applyCors(res);
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const baseUrl = `${proto}://${host}`;
  sendSuccess(res, getApiDocs(baseUrl), { message: "Wavebox API documentation" });
}

async function handleHealth(_req, res) {
  applyCors(res);
  try {
    const { initYtm } = require("./ytm");
    await initYtm();
    sendSuccess(res, { ok: true, service: "wavebox-api" });
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
    const suggestions = await withYtm((api) => api.getSearchSuggestions(q));
    sendSuccess(res, { suggestions, query: q }, { meta: { action: "suggestions" } });
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
    const raw = await withYtm((api) => api.search(q, type));
    const normalized = normalizeSearchResult(raw, type);
    sendSuccess(
      res,
      {
        ...normalized,
        query: q,
      },
      { meta: { action: "search", type } }
    );
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
  handleRequest,
};
