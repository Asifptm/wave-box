const { createHandler } = require("../lib/vercel-handler");
const { handleHealth } = require("../lib/api-handlers");

module.exports = createHandler(handleHealth);
