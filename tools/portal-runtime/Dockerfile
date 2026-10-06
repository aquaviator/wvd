FROM node:22.23.3-bookworm-slim AS browser-build
WORKDIR /app/tools/portal-proof
COPY tools/portal-proof/package.json tools/portal-proof/package-lock.json ./
RUN npm ci --ignore-scripts
COPY tools/portal-runtime/build-browser.mjs tools/portal-runtime/firebase-auth-sdk-entry.js /app/tools/portal-runtime/
RUN npm run build:live

FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app/tools/portal-proof
COPY tools/portal-proof/package.json tools/portal-proof/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY tools/portal-proof/*.mjs ./
COPY tools/portal-proof/ui ./ui
COPY --from=browser-build /app/tools/portal-runtime/dist /app/tools/portal-runtime/dist
COPY src/assets/brand/horizontal-logo.png /app/src/assets/brand/horizontal-logo.png
USER node
EXPOSE 8080
CMD ["node", "live-main.mjs"]
