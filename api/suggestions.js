const { createHandler } = require("../lib/vercel-handler");
const { handleSuggestions } = require("../lib/api-handlers");

module.exports = createHandler(handleSuggestions);
