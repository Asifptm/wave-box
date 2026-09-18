const { createHandler } = require("../../lib/vercel-handler");
const { handlePlaylist } = require("../../lib/api-handlers");

module.exports = createHandler(async (req, res) => {
  await handlePlaylist(req, res, req.query.browseId);
});
