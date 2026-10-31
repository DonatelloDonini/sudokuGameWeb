import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The port of the server the browser tests run against. */
export const E2E_PORT= 3999;

/** The database of the browser tests, deleted every time the server starts. */
export const E2E_DATABASE= path.join(ROOT, ".e2e-data", "sudoku.db");

export const CLI= path.join(ROOT, "backend", "src", "cli.js");
