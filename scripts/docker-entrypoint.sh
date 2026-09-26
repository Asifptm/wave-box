#!/bin/sh
set -e
# Best-effort refresh of yt-dlp on each container start (needs network).
yt-dlp -U >/dev/null 2>&1 || true
exec node local-server.js
