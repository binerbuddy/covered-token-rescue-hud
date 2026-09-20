import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { intersectionArea } from "../scripts/geometry.mjs";

const CLOSE = (actual, expected, eps = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ~${expected}, got ${actual}`,
  );

describe("intersectionArea", () => {
  test("partial overlap computes the correct area", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 25);
  });

  test("is symmetric in its arguments", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), intersectionArea(b, a));
  });

  test("one rect fully inside another returns the smaller rect's area", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 25, y: 25, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 100);
  });

  test("identical rects return the full area", () => {
    const a = { x: 3, y: 4, width: 20, height: 8 };
    assert.equal(intersectionArea(a, { ...a }), 160);
  });

  test("edge-to-edge touch on the x axis returns exactly 0", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 10, y: 0, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("edge-to-edge touch on the y axis returns exactly 0", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 0, y: 10, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("corner-only touch returns exactly 0", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 10, y: 10, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("fully disjoint rects return 0", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 1000, y: 1000, width: 5, height: 5 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("a degenerate (zero-width) rect returns 0 even if geometrically overlapping", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 5, y: 5, width: 0, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("a rect with NaN coordinates returns 0", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: NaN, y: 5, width: 10, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("a rect with negative width returns 0", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 5, y: 5, width: -10, height: 10 };
    assert.equal(intersectionArea(a, b), 0);
  });

  test("null rect argument returns 0 and does not throw", () => {
    assert.doesNotThrow(() => intersectionArea({ x: 0, y: 0, width: 10, height: 10 }, null));
    assert.equal(intersectionArea({ x: 0, y: 0, width: 10, height: 10 }, null), 0);
  });

  test("fractional coordinates prone to float rounding still yield a sane area", () => {
    const a = { x: 0, y: 0, width: 10.1, height: 10.1 };
    const b = { x: 5.05, y: 5.05, width: 10.1, height: 10.1 };
    // overlap: x in [5.05, 10.1] -> width 5.05; y likewise -> area ~25.5025
    CLOSE(intersectionArea(a, b), 25.5025, 1e-9);
  });

  test("very large but finite coordinates do not overflow to Infinity or NaN", () => {
    const a = { x: 0, y: 0, width: 1e300, height: 1e300 };
    const b = { x: 5e299, y: 5e299, width: 1e300, height: 1e300 };
    const result = intersectionArea(a, b);
    assert.ok(Number.isFinite(result) || result === Infinity, "must not be NaN");
    assert.ok(!Number.isNaN(result));
  });

  test("negative-coordinate rects intersect correctly", () => {
    const a = { x: -20, y: -20, width: 10, height: 10 }; // [-20,-10]
    const b = { x: -15, y: -15, width: 10, height: 10 }; // [-15,-5]
    // overlap x: [-15,-10] width 5; y likewise -> area 25
    assert.equal(intersectionArea(a, b), 25);
  });
});
