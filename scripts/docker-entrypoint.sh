#!/bin/sh
set -e
# Prefer nightly yt-dlp for YouTube JS / challenge fixes.
yt-dlp --update-to nightly >/tmp/yt-dlp-update.log 2>&1 || yt-dlp -U >/tmp/yt-dlp-update.log 2>&1 || true
yt-dlp --version || true
exec node local-server.js
