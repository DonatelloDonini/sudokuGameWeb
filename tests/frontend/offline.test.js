import { test, describe } from "node:test";
import assert from "node:assert/strict";
import OfflineLevels from "../../frontend/js/OfflineLevels.js";
import { localHint, isSolved } from "../../frontend/js/offlineGame.js";

const fakeStorage= ()=> {
  const values= new Map();
  return {
    getItem: (key)=> values.get(key) ?? null,
    setItem: (key, value)=> values.set(key, String(value)),
  };
};

/** A download that returns numbered levels and records the requests. */
const fakeDownload= ()=> {
  const requests= [];
  let next= 0;
  const fetchLevels= async (difficulty, count)=> {
    requests.push({difficulty, count});
    return Array.from({length: count}, ()=> ({puzzle: [[next]], solution: [[next++]], hardestTechnique: `technique of ${difficulty}`, extra: "dropped"}));
  };
  return {requests, fetchLevels};
};

describe("OfflineLevels", ()=> {
  test(`keeps ${OfflineLevels.PER_DIFFICULTY} levels of every difficulty`, async ()=> {
    const download= fakeDownload();
    const levels= new OfflineLevels({storage: fakeStorage(), fetchLevels: download.fetchLevels});

    assert.equal(await levels.refill(), 4 * OfflineLevels.PER_DIFFICULTY);
    assert.equal(levels.count(), 4 * OfflineLevels.PER_DIFFICULTY);
    for (const difficulty of OfflineLevels.DIFFICULTIES) assert.equal(levels.count(difficulty), OfflineLevels.PER_DIFFICULTY);

    assert.equal(await levels.refill(), 0, "nothing to download when full");
    assert.equal(download.requests.length, 4);
  });

  test("taking a level removes it, and the refill only downloads what's missing", async ()=> {
    const download= fakeDownload();
    const levels= new OfflineLevels({storage: fakeStorage(), fetchLevels: download.fetchLevels});
    await levels.refill();

    const level= levels.take("hard");
    assert.equal(level.difficulty, "hard");
    assert.equal(level.hardestTechnique, "technique of hard");
    assert.equal(level.extra, undefined, "only what's needed is stored");
    assert.equal(levels.count("hard"), OfflineLevels.PER_DIFFICULTY - 1);

    await levels.refill();
    assert.deepEqual(download.requests.at(-1), {difficulty: "hard", count: 1});
  });

  test("when a difficulty runs out, the closest one is played", async ()=> {
    const levels= new OfflineLevels({storage: fakeStorage(), fetchLevels: fakeDownload().fetchLevels});
    await levels.refill();
    for (let i= 0; i<OfflineLevels.PER_DIFFICULTY; i++) levels.take("expert");

    assert.equal(levels.take("expert").difficulty, "hard");
    assert.equal(levels.take("expert", {anyDifficulty: false}), null);
  });

  test("an empty or broken storage means no level, not an error", ()=> {
    const storage= fakeStorage();
    storage.setItem(OfflineLevels.STORAGE_KEY, "{broken");
    const levels= new OfflineLevels({storage, fetchLevels: fakeDownload().fetchLevels});
    assert.equal(levels.count(), 0);
    assert.equal(levels.take("easy"), null);
  });

  test("refills started at the same time download once", async ()=> {
    const download= fakeDownload();
    const levels= new OfflineLevels({storage: fakeStorage(), fetchLevels: download.fetchLevels});
    await Promise.all([levels.refill(), levels.refill(), levels.refill()]);
    assert.equal(download.requests.length, 4);
  });

  test("a failed download keeps the levels already stored", async ()=> {
    const levels= new OfflineLevels({storage: fakeStorage(), fetchLevels: fakeDownload().fetchLevels});
    await levels.refill();
    levels.take("easy");
    levels.fetchLevels= async ()=> {
      throw new Error("offline");
    };
    await assert.rejects(levels.refill());
    assert.equal(levels.count(), 4 * OfflineLevels.PER_DIFFICULTY - 1);
  });
});

describe("offline game", ()=> {
  const solution= [[1, 2], [3, 4]];

  test("a hint fixes a mistake first", ()=> {
    assert.deepEqual(localHint([[1, 9], [null, null]], solution), {x: 1, y: 0, value: 2});
  });

  test("otherwise a hint fills an empty cell", ()=> {
    assert.deepEqual(localHint([[1, 2], [null, 4]], solution), {x: 0, y: 1, value: 3});
    assert.equal(localHint(solution, solution), null);
  });

  test("the board is solved only when it is the solution", ()=> {
    assert.equal(isSolved([[1, 2], [3, 4]], solution), true);
    assert.equal(isSolved([[1, 2], [4, 3]], solution), false);
    assert.equal(isSolved([[1, 2], [3, null]], solution), false);
  });
});
