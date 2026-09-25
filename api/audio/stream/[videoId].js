const { createHandler } = require("../../lib/vercel-handler");
const { applyCors } = require("../../lib/http");
const { sendError } = require("../../lib/response");

async function handleAudioStreamVercel(_req, res) {
  applyCors(res);
  sendError(
    res,
    501,
    "Progressive audio streaming is local-only. Run npm start and use GET /api/audio/stream/:videoId"
  );
}

module.exports = createHandler(handleAudioStreamVercel);
