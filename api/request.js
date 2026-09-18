const { createHandler } = require("../lib/vercel-handler");
const { handleRequest } = require("../lib/api-handlers");

module.exports = createHandler(handleRequest);
