/**
 * Merge query string and JSON body (POST). Body wins on conflicts.
 * Works with Express and Vercel serverless.
 * @param {import('express').Request | object} req
 */
async function readRawBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === "string" && req.body.trim()) {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }

  if (req.method === "GET" || req.method === "HEAD") return {};
  if (typeof req.on !== "function") return {};

  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

async function getInput(req) {
  const body = await readRawBody(req);
  const query = req.query || {};
  const data = { ...query, ...body };

  return {
    action: String(data.action || "").trim().toLowerCase(),
    q: String(data.q || data.query || "").trim(),
    type: String(data.type || "song").trim() || "song",
    browseId: String(data.browseId || data.id || "").trim(),
    videoId: String(data.videoId || "").trim(),
    id: String(data.id || "").trim(),
    title: String(data.title || "").trim(),
    artist: String(data.artist || "").trim(),
    durationSec: data.durationSec ?? data.duration ?? "",
    raw: data,
  };
}

module.exports = { readRawBody, getInput };
