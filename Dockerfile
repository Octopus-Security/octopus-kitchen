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

EXPOSE 3014
CMD ["node", "index.js"]
