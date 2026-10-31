import { rmSync } from "node:fs";
import { E2E_DATABASE, E2E_PORT } from "./config.js";

// every run starts from an empty database
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${E2E_DATABASE}${suffix}`, {force: true});

process.env.DATABASE_PATH= E2E_DATABASE;
process.env.PORT= String(E2E_PORT);
process.env.HOST= "127.0.0.1";
// the tests make many requests from the same IP
process.env.PUBLIC_API_RATE_LIMIT= "100000";

await import("../../backend/src/server.js");
