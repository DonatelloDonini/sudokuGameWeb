/**
 * The service worker of the game: it keeps the game's files on the device, so the game opens without a connection
 * (the levels for offline play are kept by js/OfflineLevels.js).
 *
 * - Pages and files: the network first, so updates arrive as soon as they are online; the copy on the device otherwise.
 * - The API: never cached (scores, battles and accounts need the server), except the avatar images, which never change.
 */

const CACHE= "sudoku-game-v1";

/** Everything the game needs to open offline. tests/frontend/serviceWorker.test.js checks nothing is missing. */
const PRECACHE= [
  "/play/",
  "/style.css",
  "/manifest.webmanifest",
  "/icon.svg",
  "/js/main.js",
  "/js/AccountDialog.js",
  "/js/AvatarDialog.js",
  "/js/BattleClient.js",
  "/js/Leaderboard.js",
  "/js/Modal.js",
  "/js/OfflineLevels.js",
  "/js/Palette.js",
  "/js/ReportDialog.js",
  "/js/RulesButton.js",
  "/js/SudokuBoard.js",
  "/js/SudokuGame.js",
  "/js/api.js",
  "/js/offlineGame.js",
  "/js/avatars.js",
  "/js/utils.js",
  "/vendor/pixel-avatar/index.js",
  "/vendor/pixel-avatar/editor.js",
  "/vendor/pixel-avatar/avatar.js",
  "/vendor/pixel-avatar/colors.js",
  "/vendor/pixel-avatar/parts.js",
  "/vendor/pixel-avatar/render.js",
];

self.addEventListener("install", (event)=> {
  event.waitUntil(caches.open(CACHE).then(cache=> cache.addAll(PRECACHE)).then(()=> self.skipWaiting()));
});

self.addEventListener("activate", (event)=> {
  event.waitUntil(
    caches.keys()
      .then(keys=> Promise.all(keys.filter(key=> key!== CACHE).map(key=> caches.delete(key))))
      .then(()=> self.clients.claim()),
  );
});

const isAvatarImage= (url)=> url.pathname.startsWith("/api/avatars/");

/** The pages and the files the device may keep (not the admin dashboard, not the API). */
const isCacheable= (url)=> url.origin=== self.location.origin
  && ! url.pathname.startsWith("/api/")
  && ! url.pathname.startsWith("/admin")
  && ! url.pathname.startsWith("/js/admin/")
  && url.pathname!== "/sw.js";

self.addEventListener("fetch", (event)=> {
  const {request}= event;
  if (request.method!== "GET") return;
  const url= new URL(request.url);

  if (isAvatarImage(url)){
    event.respondWith(cacheFirst(request));
  }
  else if (isCacheable(url)){
    event.respondWith(networkFirst(request));
  }
});

const cacheFirst= async (request)=> {
  const cached= await caches.match(request);
  if (cached) return cached;

  const response= await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
};

const networkFirst= async (request)=> {
  try {
    const response= await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  }
  catch (error) {
    const cached= await caches.match(request, {ignoreSearch: request.mode=== "navigate"});
    if (cached) return cached;
    // a page of the game that was never visited: the game itself
    if (request.mode=== "navigate") return (await caches.match("/play/")) ?? Response.error();
    throw error;
  }
};
