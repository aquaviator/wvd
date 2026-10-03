# Match package-lock.json's Playwright version. No image is published.
FROM node:22.23.3-bookworm-slim AS node-runtime
FROM mcr.microsoft.com/playwright:v1.62.1-noble
COPY --from=node-runtime /usr/local/ /usr/local/
ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=true
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-21-jre-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools/portal-proof/package.json tools/portal-proof/package-lock.json ./tools/portal-proof/
RUN npm ci --ignore-scripts && npm ci --prefix tools/portal-proof --ignore-scripts
COPY tools/portal-proof/ ./tools/portal-proof/
COPY src/assets/brand/horizontal-logo.png ./src/assets/brand/horizontal-logo.png
COPY tools/development-container/run-tests.mjs ./tools/development-container/run-tests.mjs
# Browser and emulator downloads are build-time only. Test runs have no network.
RUN ./tools/portal-proof/node_modules/.bin/firebase setup:emulators:firestore
CMD ["node", "tools/development-container/run-tests.mjs"]
