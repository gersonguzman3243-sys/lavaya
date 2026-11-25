# Render (y cualquier proxy) inyecta PORT. Si no hay, el arranque usa 7860.
# El proceso escucha en 0.0.0.0 y corre como uid 1000.
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /home/user/app /home/user/data/uploads \
  && chown -R 1000:1000 /home/user

WORKDIR /home/user/app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOME=/home/user \
    LAVAYA_DATA_DIR=/home/user/data

COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/scripts/docker-start.mjs ./docker-start.mjs

USER 1000
EXPOSE 7860
CMD ["node", "docker-start.mjs"]
