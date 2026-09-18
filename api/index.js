const { createHandler } = require("../lib/vercel-handler");
const { handleRoot } = require("../lib/api-handlers");

module.exports = createHandler(handleRoot);
