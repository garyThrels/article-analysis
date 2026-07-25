# Development image for the API (Express + Drizzle) with hot reload via tsx.
# Build context is the repo root (see docker-compose.yml) so the whole Yarn
# workspace is available for install.
FROM node:22-alpine

# Enable Corepack so the pinned Yarn 4 version is used.
RUN corepack enable

WORKDIR /app

# Copy just the manifests first for better layer caching on dependency installs.
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN yarn install --immutable

# Copy the rest of the source (overridden by the bind mount at runtime).
COPY . .

EXPOSE 3000

CMD ["yarn", "workspace", "@carma/api", "dev"]
