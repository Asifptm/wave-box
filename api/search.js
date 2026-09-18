const { createHandler } = require("../lib/vercel-handler");
const { handleSearch } = require("../lib/api-handlers");

module.exports = createHandler(handleSearch);
