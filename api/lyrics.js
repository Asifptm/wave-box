const { createHandler } = require("../lib/vercel-handler");
const { handleLyrics } = require("../lib/api-handlers");

module.exports = createHandler(handleLyrics);
