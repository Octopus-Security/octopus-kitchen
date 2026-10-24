FROM node:22-slim

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NPM_TOKEN authenticates @octopus-security/auth-client (GitHub Packages). The
# .npmrc is written and removed in ONE layer — leaving it behind would bake a
# registry credential into the image. Build sqlite3 from source so its native
# binary links against this image's glibc.
ARG NPM_TOKEN
COPY package*.json ./
RUN if [ -n "$NPM_TOKEN" ]; then \
      printf '@octopus-security:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n' "$NPM_TOKEN" > .npmrc; \
    fi && \
    npm install --production --build-from-source=sqlite3 && \
    rm -f .npmrc

COPY . .
RUN mkdir -p data
# Strip npm from the runtime image. Nothing here runs it - the CMD is a bare
# `node` - but Trivy reports what is PRESENT, not what is reachable, and npm
# bundles its own vulnerable tree. Must run as root, so it goes above USER.
# Guarded by octopus-vault/scripts/check-no-npm.mjs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

EXPOSE 3014
CMD ["node", "index.js"]
