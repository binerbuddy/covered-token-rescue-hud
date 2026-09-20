import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coverageRatio } from "../scripts/geometry.mjs";

describe("coverageRatio", () => {
  test("full containment gives a ratio of exactly 1", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: -5, y: -5, width: 20, height: 20 };
    assert.equal(coverageRatio(target, cover), 1);
  });

  test("half overlap gives a ratio of 0.5", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 5, y: 0, width: 20, height: 10 };
    assert.equal(coverageRatio(target, cover), 0.5);
  });

  test("no overlap gives a ratio of 0", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 1000, y: 1000, width: 10, height: 10 };
    assert.equal(coverageRatio(target, cover), 0);
  });

  test("an enormous but finite cover still caps the ratio at exactly 1", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: -1e12, y: -1e12, width: 2e12, height: 2e12 };
    const ratio = coverageRatio(target, cover);
    assert.ok(ratio <= 1, `ratio must never exceed 1, got ${ratio}`);
    assert.equal(ratio, 1);
  });

  test("an infinite-sized cover is an invalid rect and yields ratio 0, not 1", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: -Infinity, y: -Infinity, width: Infinity, height: Infinity };
    assert.equal(coverageRatio(target, cover), 0);
  });

  test("invalid target returns 0", () => {
    const target = { x: 0, y: 0, width: -1, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(coverageRatio(target, cover), 0);
  });

  test("invalid cover returns 0", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: NaN, height: 10 };
    assert.equal(coverageRatio(target, cover), 0);
  });

  test("null target returns 0 and does not throw", () => {
    assert.doesNotThrow(() => coverageRatio(null, { x: 0, y: 0, width: 10, height: 10 }));
    assert.equal(coverageRatio(null, { x: 0, y: 0, width: 10, height: 10 }), 0);
  });

  test("null cover returns 0 and does not throw", () => {
    assert.equal(coverageRatio({ x: 0, y: 0, width: 10, height: 10 }, null), 0);
  });

  test("is not symmetric: swapping target and cover changes the result", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 }; // area 100
    const cover = { x: 0, y: 0, width: 5, height: 5 }; // area 25, fully inside target
    const forward = coverageRatio(target, cover); // 25/100
    const backward = coverageRatio(cover, target); // 25/25
    assert.equal(forward, 0.25);
    assert.equal(backward, 1);
    assert.notEqual(forward, backward);
  });

  test("ratio never goes negative for disjoint degenerate combos", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 10, y: 10, width: 10, height: 10 }; // corner touch only
    const ratio = coverageRatio(target, cover);
    assert.equal(ratio, 0);
    assert.ok(!Object.is(ratio, -0), "should not be negative zero either");
  });

  test("tiny target fully covered by a normal-sized cover approaches 1", () => {
    const target = { x: 0, y: 0, width: 0.0001, height: 0.0001 };
    const cover = { x: -10, y: -10, width: 20, height: 20 };
    assert.equal(coverageRatio(target, cover), 1);
  });

  test("negative coordinates behave the same as positive ones", () => {
    const target = { x: -20, y: -20, width: 10, height: 10 };
    const cover = { x: -25, y: -25, width: 10, height: 10 };
    // overlap: x [-20,-15] width5, y likewise -> area 25; target area 100
    assert.equal(coverageRatio(target, cover), 0.25);
  });
});
