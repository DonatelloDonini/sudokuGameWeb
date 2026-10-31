const {test}= require("node:test");
const assert= require("node:assert/strict");
const {LevelPool}= require("../src/levelPool");
const {DIFFICULTIES}= require("../src/levelGenerator");

const waitFor= async (condition, timeoutMs)=> {
  const start= Date.now();
  while (! condition()){
    if (Date.now() - start> timeoutMs) throw new Error("timed out");
    await new Promise(resolve=> setTimeout(resolve, 20));
  }
};

test("the worker fills the pool with graded levels of every difficulty", {timeout: 60000}, async ()=> {
  const pool= new LevelPool({size: 1});
  pool.start();
  try {
    await waitFor(()=> Object.values(pool.levels).every(levels=> levels.length=== 1), 55000);

    for (const [difficulty, {tier}] of Object.entries(DIFFICULTIES)){
      const level= pool.take(difficulty);
      assert.equal(level.difficulty, difficulty);
      assert.equal(level.grade.tier, tier);
    }
  }
  finally {
    await pool.stop();
  }
});

test("without the worker, levels are generated on demand", ()=> {
  const pool= new LevelPool();
  assert.equal(pool.take("easy").grade.tier, DIFFICULTIES.easy.tier);
});
