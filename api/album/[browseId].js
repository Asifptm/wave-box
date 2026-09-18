const { createHandler } = require("../../lib/vercel-handler");
const { handleAlbum } = require("../../lib/api-handlers");

module.exports = createHandler(async (req, res) => {
  await handleAlbum(req, res, req.query.browseId);
});
