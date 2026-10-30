# sudokuGameWeb
 The classic Sudoku game, made in JavaScript.

## Project structure

```
backend/           Node.js (Express) server
  src/server.js      entry point
  src/app.js         API routes + static file serving
  src/levelGenerator.js
  src/sudoku/        level generation logic (SudokuGrid, Possibilities, ...)
  test/              tests (node:test)
frontend/          static page served by the backend
Dockerfile
docker-compose.yml
```

The backend generates the levels and also serves the frontend, so the whole game runs from a single process / container.

## Running with Docker

```sh
docker compose up --build
```

Then open http://localhost:3000. Set `PORT` to use a different host port, e.g. `PORT=8080 docker compose up --build`.

Without compose:

```sh
docker build -t sudoku-game-web .
docker run --rm -p 3000:3000 sudoku-game-web
```

## Running locally

Requires Node.js 20 or newer.

```sh
cd backend
npm install
npm start        # or `npm run dev` to restart on file changes
npm test
```

The frontend must be opened through the backend (http://localhost:3000), not as a file or through a separate static server, because it fetches its levels from the API.

## API

### `GET /api/level?difficulty=<0-9>`

Generates a new level. `difficulty` is how many numbers are removed from each row, column and quadrant (default `6`).

```json
{
  "difficulty": 6,
  "puzzle":   [[null, 4, null, ...], ...],
  "solution": [[8, 4, 1, ...], ...]
}
```

Both grids are indexed as `grid[y][x]`; empty cells in `puzzle` are `null`. An invalid `difficulty` returns `400`.

### `GET /api/health`

Returns `{"status": "ok"}`; used by the Docker health check.

## Configuration

| Variable       | Default       | Description                          |
|----------------|---------------|--------------------------------------|
| `PORT`         | `3000`        | Port the server listens on           |
| `HOST`         | `0.0.0.0`     | Interface the server binds to        |
| `FRONTEND_DIR` | `../frontend` | Folder with the static frontend files |
