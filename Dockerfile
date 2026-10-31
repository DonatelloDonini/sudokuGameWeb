# syntax=docker/dockerfile:1

# ---------- dependencies ----------
# The full Debian image comes with git, needed to install the pixel-avatar module from its private GitHub repository.
# The dependencies are plain JavaScript: they run as they are in the Alpine image below.
FROM node:22 AS dependencies

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/

# A read-only GitHub token, passed as a build secret: it is only used by this step and never stored in the image.
#   docker build --secret id=github_token,env=GITHUB_TOKEN .
RUN --mount=type=secret,id=github_token \
    if [ -s /run/secrets/github_token ]; then \
      git config --global url."https://x-access-token:$(cat /run/secrets/github_token)@github.com/".insteadOf "ssh://git@github.com/"; \
    fi \
    && npm ci --omit=dev --prefix backend \
    && npm cache clean --force \
    && rm -f ~/.gitconfig

# ---------- server ----------
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/sudoku.db

WORKDIR /app

COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY frontend ./frontend

# the SQLite database lives in a volume owned by the unprivileged user
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
