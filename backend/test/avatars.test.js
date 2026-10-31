const {test, before, after}= require("node:test");
const assert= require("node:assert/strict");
const {encodeAvatar, decodeAvatar, randomAvatar, updateAvatar}= require("pixel-avatar");
const {startServer, createClient}= require("./helpers");
const {avatarCodeOf, normalizeAvatarCode}= require("../src/avatars");

let server;

before(async ()=> {
  server= await startServer();
});

after(()=> server.close());

test("every player has an avatar: a random face for their name until they make one", async ()=> {
  const client= createClient(server.baseUrl);
  const {body}= await client.post("/api/auth/register", {username: "Painter", password: "secret1"});

  assert.equal(body.user.avatar, encodeAvatar(randomAvatar("painter")));
  assert.equal(avatarCodeOf({username: "PAINTER", avatar: null}), body.user.avatar, "the default ignores the case, like the usernames");
});

test("players change their avatar with a code", async ()=> {
  const client= createClient(server.baseUrl);
  await client.post("/api/auth/register", {username: "stylist", password: "secret1"});

  const avatar= updateAvatar(randomAvatar(7), {parts: {hair: "afro"}, colors: {hair: "#B03A2E"}});
  const {status, body}= await client.post("/api/auth/avatar", {avatar: encodeAvatar(avatar)});
  assert.equal(status, 200);
  assert.equal(decodeAvatar(body.user.avatar).parts.hair, "afro");
  assert.equal((await client.get("/api/auth/me")).body.user.avatar, body.user.avatar);

  assert.equal((await client.post("/api/auth/avatar", {avatar: "not-an-avatar"})).status, 400);
  assert.equal((await client.post("/api/auth/avatar", {avatar: {v: 1}})).status, 400);
  assert.equal((await createClient(server.baseUrl).post("/api/auth/avatar", {avatar: body.user.avatar})).status, 401);
});

test("codes are normalized before being stored", ()=> {
  const code= encodeAvatar(randomAvatar(3));
  assert.equal(normalizeAvatarCode(code.toUpperCase()), code);
  assert.equal(normalizeAvatarCode(42), null);
});

test("any avatar can be fetched as an SVG image, cached forever", async ()=> {
  const code= encodeAvatar(randomAvatar("image"));
  const response= await fetch(`${server.baseUrl}/api/avatars/${code}.svg?size=48`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/svg\+xml/);
  assert.match(response.headers.get("cache-control"), /immutable/);
  assert.match(await response.text(), /^<svg [^>]*width="48"/);

  assert.equal((await fetch(`${server.baseUrl}/api/avatars/nope.svg`)).status, 400);
});

test("the leaderboards show the avatars", async ()=> {
  const client= createClient(server.baseUrl);
  await client.post("/api/auth/register", {username: "speedrunner", password: "secret1"});
  const {body: game}= await client.post("/api/games", {difficulty: "easy"});
  const solution= JSON.parse(server.db.prepare("SELECT solution FROM games WHERE id = ?").get(game.id).solution);
  await client.post(`/api/games/${game.id}/complete`, {board: solution});

  const {body}= await client.get("/api/leaderboard/times/easy");
  const entry= body.players.find(player=> player.username=== "speedrunner");
  assert.equal(entry.avatar, encodeAvatar(randomAvatar("speedrunner")));
});

test("the browser files of the avatar module are served", async ()=> {
  for (const file of ["index.js", "editor.js"]){
    const response= await fetch(`${server.baseUrl}/vendor/pixel-avatar/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get("content-type"), /javascript/);
  }
});
