FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# install dependencies first so they are cached between code changes
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend && npm cache clean --force

COPY backend/src ./backend/src
COPY frontend ./frontend

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "backend/src/server.js"]
