FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app/tools/portal-proof
COPY tools/portal-proof/package.json tools/portal-proof/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY tools/portal-proof/*.mjs ./
COPY tools/portal-proof/ui ./ui
COPY src/assets/brand/horizontal-logo.png /app/src/assets/brand/horizontal-logo.png
COPY tools/booking-runtime/wvd-development.candidate.json /app/runtime.json
USER node
EXPOSE 8080
CMD ["node", "booking-main.mjs", "/app/runtime.json"]
