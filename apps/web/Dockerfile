# Development image for the web app (Vite + React) with HMR.
# Build context is the repo root (see docker-compose.yml).
FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# Copy manifests first for cached dependency installs.
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN yarn install --immutable

COPY . .

EXPOSE 5173

CMD ["yarn", "workspace", "@carma/web", "dev"]
