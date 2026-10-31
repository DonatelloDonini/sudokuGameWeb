import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../../frontend/js/api.js";

const originalFetch= globalThis.fetch;

afterEach(()=> {
  globalThis.fetch= originalFetch;
});

/** Replaces fetch, recording the requests. */
const mockFetch= (respond)=> {
  const calls= [];
  globalThis.fetch= async (url, options)=> {
    calls.push({url, options});
    return respond(url, options);
  };
  return calls;
};

const jsonResponse= (status, body)=> new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});

describe("api", ()=> {
  test("GET requests return the JSON answer", async ()=> {
    const calls= mockFetch(()=> jsonResponse(200, {user: null}));
    assert.deepEqual(await api.me(), {user: null});
    assert.equal(calls[0].url, "/api/auth/me");
    assert.equal(calls[0].options.method, undefined);
  });

  test("POST requests send JSON", async ()=> {
    const calls= mockFetch(()=> jsonResponse(201, {id: "game"}));
    await api.newGame("hard");

    assert.equal(calls[0].url, "/api/games");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].options.body), {difficulty: "hard"});
  });

  test("reports send who, why and the battle", async ()=> {
    const calls= mockFetch(()=> jsonResponse(201, {id: 1}));
    await api.report({username: "bob", battleId: "b1", reason: "solver", comment: "fast"});
    assert.deepEqual(JSON.parse(calls[0].options.body), {username: "bob", battleId: "b1", reason: "solver", comment: "fast"});
  });

  test("errors carry the status and the server's message", async ()=> {
    mockFetch(()=> jsonResponse(409, {error: "This username is already taken."}));
    await assert.rejects(api.register("bob", "secret1"), (error)=> (
      error instanceof ApiError && error.status=== 409 && error.message=== "This username is already taken."
    ));
  });

  test("errors without a JSON body get a generic message", async ()=> {
    mockFetch(()=> new Response("Bad gateway", {status: 502}));
    await assert.rejects(api.me(), (error)=> error.status=== 502 && /HTTP 502/.test(error.message));
  });

  test("a network failure is an ApiError with status 0", async ()=> {
    mockFetch(()=> {
      throw new TypeError("Failed to fetch");
    });
    await assert.rejects(api.me(), (error)=> error instanceof ApiError && error.status=== 0 && /connection/.test(error.message));
  });
});
