# RuntimeCatch — local development image.
# Optimised for `docker compose up`, not for production: bind-mount-friendly,
# carries devDependencies (prisma, tsx) so `prisma migrate dev` and the
# seed/simulate scripts work via `docker compose exec`.

FROM node:24-bookworm-slim

# Prisma's query engine needs openssl + ca-certificates at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# prisma.config.ts throws if DATABASE_URL is unset, and `prisma generate`
# runs in the npm `postinstall` hook. Provide a placeholder so the image
# build succeeds; compose overrides it at runtime with the real value.
ENV DATABASE_URL="postgresql://build:build@build:5432/build?schema=public"

# Install dependencies first so this layer caches across source edits.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the source. `.dockerignore` keeps node_modules, .next,
# prisma/generated, and .env out of this layer.
COPY . .

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

# Bind to 0.0.0.0 so the dev server is reachable from outside the container.
CMD ["npx", "next", "dev", "-H", "0.0.0.0"]
