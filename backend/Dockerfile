FROM node:24-bookworm-slim


RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .


EXPOSE 3000


CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]