import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isCovered } from "../scripts/geometry.mjs";

describe("isCovered", () => {
  test("clean full containment at threshold 1 is true", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, 1), true);
  });

  test("threshold 1 with floating point drift on the target's own dimension must still be true", () => {
    // 0.1 + 0.1 + 0.1 !== 0.3 in IEEE754 (it's 0.30000000000000004).
    // Same logical rectangle, computed two different ways.
    const target = { x: 0, y: 0, width: 0.1 + 0.1 + 0.1, height: 1 };
    const cover = { x: 0, y: 0, width: 0.3, height: 1 };
    assert.equal(
      isCovered(target, cover, 1),
      true,
      "drift-sized target should still count as fully covered at threshold 1",
    );
  });

  test("threshold 1 with drift on the cover's dimension (target smaller) is trivially true", () => {
    const target = { x: 0, y: 0, width: 0.3, height: 1 };
    const cover = { x: 0, y: 0, width: 0.1 + 0.1 + 0.1, height: 1 };
    assert.equal(isCovered(target, cover, 1), true);
  });

  test("a real gap at threshold 1 must be false (drift tolerance is not a blanket pass)", () => {
    const target = { x: 0, y: 0, width: 1, height: 1 };
    const cover = { x: 0, y: 0, width: 0.9, height: 1 };
    assert.equal(isCovered(target, cover, 1), false);
  });

  test("threshold exactly equal to the ratio is true (>=, not >)", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 5, y: 0, width: 20, height: 10 }; // ratio 0.5 exactly
    assert.equal(isCovered(target, cover, 0.5), true);
  });

  test("threshold just above the actual ratio is false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 5, y: 0, width: 20, height: 10 }; // ratio 0.5 exactly
    assert.equal(isCovered(target, cover, 0.500001), false);
  });

  test("threshold of 0 is always false, even with perfect containment", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, 0), false);
  });

  test("negative threshold is always false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, -1), false);
  });

  test("NaN threshold is false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, NaN), false);
  });

  test("Infinity threshold is false (not finite)", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, Infinity), false);
  });

  test("-Infinity threshold is false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, -Infinity), false);
  });

  test("non-numeric threshold (string) is false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, "1"), false);
  });

  test("zero coverage ratio is false even for a tiny positive threshold", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 1000, y: 1000, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, Number.MIN_VALUE), false);
  });

  test("threshold at the very top of its valid range (1) with no coverage is false", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 1000, y: 1000, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, 1), false);
  });

  test("invalid target is false regardless of threshold", () => {
    const target = { x: 0, y: 0, width: -1, height: 10 };
    const cover = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(isCovered(target, cover, 0.0001), false);
  });

  test("invalid cover is false regardless of threshold", () => {
    const target = { x: 0, y: 0, width: 10, height: 10 };
    const cover = { x: 0, y: 0, width: NaN, height: 10 };
    assert.equal(isCovered(target, cover, 0.0001), false);
  });

  test("null target/cover do not throw and are false", () => {
    assert.doesNotThrow(() => isCovered(null, null, 0.5));
    assert.equal(isCovered(null, null, 0.5), false);
  });

  test("threshold of exactly 1 requires full coverage, not near-full", () => {
    const target = { x: 0, y: 0, width: 100, height: 100 };
    const cover = { x: 0, y: 0, width: 100, height: 99.999 }; // ratio 0.99999
    assert.equal(isCovered(target, cover, 1), false);
  });
});
