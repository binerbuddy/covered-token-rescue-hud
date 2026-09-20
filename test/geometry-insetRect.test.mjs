import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { insetRect } from "../scripts/geometry.mjs";

describe("insetRect", () => {
  test("shrinks towards centre by the given fraction on each side", () => {
    const result = insetRect({ x: 10, y: 20, width: 100, height: 50 }, 0.1);
    assert.equal(result.x, 20);
    assert.equal(result.y, 25);
    assert.equal(result.width, 80);
    assert.equal(result.height, 40);
  });

  test("inset of 0 returns an equivalent rect", () => {
    const original = { x: 10, y: 20, width: 100, height: 50 };
    const result = insetRect(original, 0);
    assert.equal(result.x, 10);
    assert.equal(result.y, 20);
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
  });

  test("does not mutate the argument", () => {
    const original = { x: 10, y: 20, width: 100, height: 50 };
    const frozen = Object.freeze({ ...original });
    assert.doesNotThrow(() => insetRect(frozen, 0.25));
    assert.equal(frozen.x, 10);
    assert.equal(frozen.y, 20);
    assert.equal(frozen.width, 100);
    assert.equal(frozen.height, 50);
  });

  test("returns a new object, not the same reference", () => {
    const original = { x: 0, y: 0, width: 10, height: 10 };
    const result = insetRect(original, 0.1);
    assert.notEqual(result, original);
  });

  test("negative inset is clamped to 0", () => {
    const result = insetRect({ x: 0, y: 0, width: 10, height: 10 }, -5);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 10);
    assert.equal(result.height, 10);
  });

  test("negative-zero inset behaves like 0", () => {
    const result = insetRect({ x: 0, y: 0, width: 10, height: 10 }, -0);
    assert.equal(result.width, 10);
    assert.equal(result.height, 10);
  });

  // The contract clamps into [0, 0.5] inclusive: an inset of 0.5 collapses the
  // rectangle to zero area at its centre, which downstream reads as "never
  // covered". The requirement is that it stays finite and never goes negative.
  test("inset of exactly 0.5 collapses to zero area at the centre, never negative", () => {
    const result = insetRect({ x: 0, y: 0, width: 100, height: 100 }, 0.5);
    assert.ok(Number.isFinite(result.width), "width must be finite");
    assert.ok(Number.isFinite(result.height), "height must be finite");
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
    assert.equal(result.x, 50, "collapses to the centre");
    assert.equal(result.y, 50);
  });

  test("inset greater than 0.5 is clamped the same as 0.5", () => {
    const atBound = insetRect({ x: 0, y: 0, width: 100, height: 100 }, 0.5);
    const wayOver = insetRect({ x: 0, y: 0, width: 100, height: 100 }, 100);
    assert.equal(wayOver.width, atBound.width);
    assert.equal(wayOver.height, atBound.height);
    assert.ok(wayOver.width >= 0, "clamping must never produce a negative size");
    assert.ok(wayOver.height >= 0);
  });

  test("inset of Infinity does not throw and does not produce a negative size", () => {
    const result = insetRect({ x: 0, y: 0, width: 100, height: 100 }, Infinity);
    assert.ok(Number.isFinite(result.width) && result.width >= 0);
    assert.ok(Number.isFinite(result.height) && result.height >= 0);
  });

  test("inset of NaN does not throw", () => {
    assert.doesNotThrow(() => insetRect({ x: 0, y: 0, width: 100, height: 100 }, NaN));
  });

  test("invalid rect (non-positive width) returns a zero-area rect at its own x/y", () => {
    const result = insetRect({ x: 5, y: 7, width: -1, height: 10 }, 0.1);
    assert.equal(result.x, 5);
    assert.equal(result.y, 7);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("invalid rect missing width/height returns zero-area rect, y defaults to 0 if absent", () => {
    const result = insetRect({ x: 5 }, 0.1);
    assert.equal(result.x, 5);
    assert.equal(result.y, 0);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("empty object returns zero rect at 0,0", () => {
    const result = insetRect({}, 0.1);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("null rect returns zero rect at 0,0 and does not throw", () => {
    const result = insetRect(null, 0.1);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("undefined rect returns zero rect at 0,0 and does not throw", () => {
    const result = insetRect(undefined, 0.1);
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("string rect returns zero rect and does not throw", () => {
    assert.doesNotThrow(() => insetRect("not a rect", 0.1));
    const result = insetRect("not a rect", 0.1);
    assert.equal(result.width, 0);
    assert.equal(result.height, 0);
  });

  test("fractional inset on odd dimensions does not throw and stays finite", () => {
    const result = insetRect({ x: 1, y: 1, width: 7, height: 3 }, 0.3333333333);
    assert.ok(Number.isFinite(result.x));
    assert.ok(Number.isFinite(result.y));
    assert.ok(Number.isFinite(result.width));
    assert.ok(Number.isFinite(result.height));
    assert.ok(result.width >= 0);
    assert.ok(result.height >= 0);
  });
});
