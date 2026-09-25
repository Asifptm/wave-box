const { createHandler } = require("../lib/vercel-handler");
const { applyCors } = require("../lib/http");
const { sendError } = require("../lib/response");

/**
 * Audio conversion requires local Express + ffmpeg.
 * Vercel serverless cannot reliably convert or serve temp MP3s.
 */
async function handleAudioVercel(_req, res) {
  applyCors(res);
  sendError(
    res,
    501,
    "Audio MP3 conversion is local-only. Run `npm start` with ffmpeg + yt-dlp installed, then call GET /api/audio?videoId=..."
  );
}

module.exports = createHandler(handleAudioVercel);
