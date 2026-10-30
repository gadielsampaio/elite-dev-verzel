FROM node:24-bookworm-slim AS development

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 3000
CMD ["sh", "-c", "npx prisma generate --config prisma7.config.ts && npm run start:dev"]

FROM development AS build
# These operations need the schema, not a live database or production secrets.
RUN npx prisma generate --config prisma7.config.ts && npm run build

FROM build AS production
ENV NODE_ENV=production
# Render may override CMD with `npm run start:render`; both start compiled code.
CMD ["node", "dist/main.js"]
