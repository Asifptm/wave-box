function sendSuccess(res, response, { message = "success", status = 200, meta } = {}) {
  const payload = {
    status,
    message,
    response,
  };
  if (meta && Object.keys(meta).length) payload.meta = meta;
  res.status(status).json(payload);
}

function sendError(res, status, message, details) {
  const payload = {
    status,
    message,
    response: null,
  };
  if (details) payload.error = details;
  res.status(status).json(payload);
}

module.exports = { sendSuccess, sendError };
