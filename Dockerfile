# Production audio host — Node + ffmpeg + yt-dlp (NOT for Vercel)
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates curl \
  && pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" \
  && yt-dlp --version \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY lib ./lib
COPY public ./public
COPY local-server.js ./
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN mkdir -p /app/tmp/audio \
  && sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh \
  && chmod +x /app/scripts/docker-entrypoint.sh \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
ENV WAVEBOX_CONVERSION=1

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]
