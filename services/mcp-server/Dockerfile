FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1
CMD ["node", "dist/index.js"]
