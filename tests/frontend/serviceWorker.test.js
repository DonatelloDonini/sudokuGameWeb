import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");
const AVATAR_MODULE= path.resolve(FRONTEND, "../backend/node_modules/pixel-avatar/src");

/** The files the service worker downloads when it's installed. */
const precached= ()=> {
  const source= readFileSync(path.join(FRONTEND, "sw.js"), "utf8");
  const list= /const PRECACHE= \[([\s\S]*?)\];/.exec(source)[1];
  return new Set([...list.matchAll(/"([^"]+)"/g)].map(match=> match[1]));
};

/**
 * Follows the imports from a module, the way the browser does with the game's import map.
 * @returns {Set<string>} The URLs of every module the game loads.
 */
const importedModules= (entry)=> {
  const seen= new Set();
  const visit= (url)=> {
    if (seen.has(url)) return;
    seen.add(url);

    const file= url.startsWith("/vendor/pixel-avatar/")
      ? path.join(AVATAR_MODULE, url.slice("/vendor/pixel-avatar/".length))
      : path.join(FRONTEND, url);
    const source= readFileSync(file, "utf8");
    for (const [, specifier] of source.matchAll(/^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm)){
      if (specifier=== "pixel-avatar") visit("/vendor/pixel-avatar/index.js");
      else if (specifier=== "pixel-avatar/editor") visit("/vendor/pixel-avatar/editor.js");
      else visit(new URL(specifier, `http://game${url}`).pathname);
    }
  };
  visit(entry);
  return seen;
};

test("the service worker keeps every module of the game, so it opens offline", ()=> {
  const missing= [...importedModules("/js/main.js")].filter(url=> ! precached().has(url));
  assert.deepEqual(missing, [], "add these files to PRECACHE in frontend/sw.js");
});

test("the game page and its assets are kept", ()=> {
  const list= precached();
  for (const url of ["/play/", "/style.css", "/manifest.webmanifest", "/icon.svg"]) assert.ok(list.has(url), url);

  const page= readFileSync(path.join(FRONTEND, "play/index.html"), "utf8");
  for (const [, href] of page.matchAll(/(?:href|src)="(\/[^"]+)"/g)){
    if (href!== "/") assert.ok(list.has(href), `${href}, used by the game page`);
  }
});

test("every precached file exists", ()=> {
  for (const url of precached()){
    if (url.endsWith("/")) continue;
    const file= url.startsWith("/vendor/pixel-avatar/") ? path.join(AVATAR_MODULE, url.slice(21)) : path.join(FRONTEND, url);
    assert.doesNotThrow(()=> readFileSync(file), url);
  }
});
