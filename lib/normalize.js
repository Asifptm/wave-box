function formatArtists(artist) {
  if (Array.isArray(artist)) {
    return artist.map((a) => a?.name).filter(Boolean);
  }
  if (typeof artist === "string") return artist ? [artist] : [];
  if (artist?.name) return [artist.name];
  return [];
}

function bestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return null;
  const t = thumbnails[thumbnails.length - 1];
  return t?.url ? { url: t.url, width: t.width, height: t.height } : null;
}

function formatDurationMs(ms) {
  const n = Number(ms);
  if (!n || !Number.isFinite(n)) return null;
  const total = Math.floor(n / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return {
    ms: n,
    seconds: total,
    label: `${m}:${s.toString().padStart(2, "0")}`,
  };
}

/** @param {Record<string, unknown>} item */
function normalizeSearchItem(item) {
  const type = item.type || "unknown";
  const base = {
    type,
    title: item.name || item.title || null,
    thumbnail: bestThumbnail(item.thumbnails),
  };

  if (type === "song" || type === "video") {
    return {
      ...base,
      id: item.videoId || null,
      videoId: item.videoId || null,
      artists: formatArtists(item.artist),
      artist: formatArtists(item.artist).join(", ") || item.author || null,
      album: item.album?.name || null,
      albumId: item.album?.browseId || null,
      duration: formatDurationMs(item.duration),
      playlistId: item.playlistId || null,
    };
  }

  if (type === "album" || type === "single") {
    return {
      ...base,
      browseId: item.browseId || null,
      artists: formatArtists(item.artist),
      year: item.year || null,
    };
  }

  if (type === "artist") {
    return {
      ...base,
      browseId: item.browseId || null,
    };
  }

  if (type === "playlist") {
    return {
      ...base,
      browseId: item.browseId || null,
      author: item.author || null,
      trackCount: item.count ?? null,
    };
  }

  return { ...base, raw: item };
}

function normalizeSearchResult(result, type) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const items = content.map(normalizeSearchItem);
  const songsOnly =
    type === "song" ? items.filter((i) => i.type === "song") : items;

  return {
    items: songsOnly,
    count: songsOnly.length,
    type,
  };
}

function normalizeAlbum(album) {
  if (!album) return album;
  return {
    title: album.title,
    description: album.description,
    trackCount: album.trackCount,
    date: album.date,
    duration: formatDurationMs(album.duration),
    artists: (album.artist || []).map((a) => ({
      name: a.name,
      browseId: a.browseId,
    })),
    tracks: (album.tracks || []).map((t) => ({
      id: t.videoId,
      videoId: t.videoId,
      title: t.name,
      artists: t.artistNames,
      duration: formatDurationMs(t.duration),
      thumbnail: bestThumbnail(t.thumbnails),
    })),
    thumbnail: bestThumbnail(album.thumbnails),
  };
}

module.exports = {
  normalizeSearchResult,
  normalizeSearchItem,
  normalizeAlbum,
  formatDurationMs,
};
