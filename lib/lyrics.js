/**
 * Lyrics via LRCLIB (https://lrclib.net) — no API key.
 */

function pickBest(results, { title, artist, durationSec }) {
  if (!Array.isArray(results) || !results.length) return null;
  const t = (title || "").toLowerCase();
  const a = (artist || "").toLowerCase().split(",")[0].trim();

  let best = results[0];
  let bestScore = -1;

  for (const row of results) {
    let score = 0;
    const rt = String(row.trackName || "").toLowerCase();
    const ra = String(row.artistName || "").toLowerCase();
    if (t && rt.includes(t.slice(0, Math.min(12, t.length)))) score += 3;
    if (t && rt === t) score += 4;
    if (a && ra.includes(a.slice(0, Math.min(10, a.length)))) score += 3;
    if (durationSec && row.duration) {
      const diff = Math.abs(Number(row.duration) - Number(durationSec));
      if (diff <= 2) score += 3;
      else if (diff <= 5) score += 1;
    }
    if (row.syncedLyrics) score += 2;
    if (row.plainLyrics) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

function normalizeLyrics(row, query) {
  if (!row) {
    return {
      found: false,
      title: query.title || null,
      artist: query.artist || null,
      plainLyrics: null,
      syncedLyrics: null,
      source: "lrclib",
    };
  }
  return {
    found: !!(row.plainLyrics || row.syncedLyrics),
    title: row.trackName || query.title || null,
    artist: row.artistName || query.artist || null,
    album: row.albumName || null,
    duration: row.duration ?? null,
    plainLyrics: row.plainLyrics || null,
    syncedLyrics: row.syncedLyrics || null,
    instrumental: !!row.instrumental,
    source: "lrclib",
    lrclibId: row.id ?? null,
  };
}

/**
 * @param {{ title?: string, artist?: string, q?: string, durationSec?: number }} query
 */
async function fetchLyrics(query) {
  const title = String(query.title || "").trim();
  const artist = String(query.artist || "").trim();
  const q = String(query.q || "").trim() || [title, artist].filter(Boolean).join(" ");
  const durationSec = query.durationSec ? Number(query.durationSec) : null;

  if (!q && !title) {
    throw Object.assign(new Error("Provide title, artist, or q to look up lyrics."), {
      status: 400,
    });
  }

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  else if (title) params.set("track_name", title);
  if (artist && !q) params.set("artist_name", artist);

  const url = `https://lrclib.net/api/search?${params.toString()}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "WaveboxAPI/1.2" },
    });
  } catch (err) {
    throw Object.assign(new Error(`Lyrics lookup failed: ${err.message || err}`), {
      status: 502,
    });
  }

  if (!res.ok) {
    throw Object.assign(new Error(`Lyrics service error (${res.status}).`), { status: 502 });
  }

  const results = await res.json();
  const best = pickBest(results, { title, artist, durationSec });
  return normalizeLyrics(best, { title, artist, q });
}

module.exports = { fetchLyrics, pickBest, normalizeLyrics };
