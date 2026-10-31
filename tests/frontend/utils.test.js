import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, loadFromStorage, saveToStorage } from "../../frontend/js/utils.js";

describe("formatDuration", ()=> {
  test("formats minutes and seconds", ()=> {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(9_999), "0:09");
    assert.equal(formatDuration(61_000), "1:01");
    assert.equal(formatDuration(59 * 60_000 + 59_000), "59:59");
  });

  test("adds the hours past one hour", ()=> {
    assert.equal(formatDuration(3_600_000), "1:00:00");
    assert.equal(formatDuration(3_600_000 + 5 * 60_000 + 7_000), "1:05:07");
  });

  test("never shows negative times", ()=> {
    assert.equal(formatDuration(-5000), "0:00");
  });
});

describe("storage", ()=> {
  afterEach(()=> {
    delete globalThis.localStorage;
  });

  const fakeStorage= ()=> {
    const values= new Map();
    return {
      getItem: (key)=> values.has(key) ? values.get(key) : null,
      setItem: (key, value)=> values.set(key, String(value)),
      removeItem: (key)=> values.delete(key),
    };
  };

  test("saves and loads JSON values", ()=> {
    globalThis.localStorage= fakeStorage();
    saveToStorage("game", {id: "abc", values: [1, null]});
    assert.deepEqual(loadFromStorage("game"), {id: "abc", values: [1, null]});

    saveToStorage("game", null);
    assert.equal(loadFromStorage("game", "fallback"), "fallback");
  });

  test("falls back when the value is invalid", ()=> {
    globalThis.localStorage= fakeStorage();
    localStorage.setItem("broken", "{not json");
    assert.equal(loadFromStorage("broken", 42), 42);
  });

  test("works without storage (private windows, blocked cookies)", ()=> {
    globalThis.localStorage= {
      getItem(){
        throw new Error("blocked");
      },
      setItem(){
        throw new Error("blocked");
      },
    };
    assert.doesNotThrow(()=> saveToStorage("key", 1));
    assert.equal(loadFromStorage("key", "default"), "default");
  });
});
