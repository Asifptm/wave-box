const { createHandler } = require("../../lib/vercel-handler");
const { handleArtist } = require("../../lib/api-handlers");

module.exports = createHandler(async (req, res) => {
  await handleArtist(req, res, req.query.browseId);
});
