const YoutubeMusicApi = require("youtube-music-api");

/** @type {YoutubeMusicApi | null} */
let client = null;
/** @type {Promise<void> | null} */
let ready = null;

function getClient() {
  if (!client) client = new YoutubeMusicApi();
  return client;
}

async function initYtm() {
  if (!ready) {
    ready = getClient()
      .initalize()
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  await ready;
}

/**
 * @param {(api: YoutubeMusicApi) => Promise<unknown>} fn
 */
async function withYtm(fn) {
  await initYtm();
  return fn(getClient());
}

module.exports = { withYtm, initYtm };
