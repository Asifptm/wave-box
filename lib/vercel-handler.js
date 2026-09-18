const { preflight } = require("./http");

/**
 * Wrap a handler for Vercel serverless export.
 * @param {(req: import('@vercel/node').VercelRequest, res: import('@vercel/node').VercelResponse) => Promise<void>} handler
 */
function createHandler(handler) {
  return async (req, res) => {
    if (preflight(req, res)) return;
    await handler(req, res);
  };
}

module.exports = { createHandler };
