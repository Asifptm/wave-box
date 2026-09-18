function getApiDocs(baseUrl = "") {
  const prefix = baseUrl.replace(/\/$/, "");
  const p = (path) => `${prefix}${path}`;

  const envelope = {
    status: 200,
    message: "success",
    response: "{ ... payload ... }",
    meta: "{ optional: action, type, ... }",
  };

  return {
    name: "Wavebox YouTube Music API",
    version: "1.1.0",
    description:
      "REST API powered by youtube-music-api. All routes return { status, message, response }.",
    envelope,
    unifiedRequest: {
      method: "POST",
      path: "/api/request",
      contentType: "application/json",
      body: {
        action:
          "Required. health | search | suggestions | album | artist | playlist",
        query: "Search text (alias: q). Required for search & suggestions.",
        q: "Same as query",
        type: "search only — song | video | album | artist | playlist (default song)",
        browseId: "Required for album, artist, playlist (alias: id)",
      },
      example: {
        action: "search",
        query: "ne deve ne kush",
        type: "song",
      },
    },
    clients: {
      flutter: {
        description: "Copy flutter/wavebox_api.dart into your app. Set baseUrl to your Vercel URL.",
        baseUrlExample: "https://your-app.vercel.app",
        recommendedEndpoint: "POST /api/request",
        pubspec: "dependencies:\n  http: ^1.2.0",
      },
    },
    endpoints: [
      {
        methods: ["GET", "POST"],
        path: "/api/request",
        url: p("/api/request"),
        description: "Unified gateway — send JSON body (recommended for clients).",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/health",
        url: p("/api/health"),
        description: "Health check.",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/search",
        url: p("/api/search?q=pathaan&type=song"),
        bodyOrQuery: {
          q: "Required. Search query (or query).",
          type: "Optional. Default song.",
        },
        description: "Search — response.response.items are normalized tracks.",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/suggestions",
        url: p("/api/suggestions?q=path"),
        bodyOrQuery: { q: "Required." },
        description: "Autocomplete suggestions.",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/album/:browseId",
        url: p("/api/album/MPREb_example"),
        description: "Album + normalized tracks.",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/artist/:browseId",
        description: "Artist profile.",
      },
      {
        methods: ["GET", "POST"],
        path: "/api/playlist/:browseId",
        description: "Playlist tracks.",
      },
    ],
  };
}

module.exports = { getApiDocs };
