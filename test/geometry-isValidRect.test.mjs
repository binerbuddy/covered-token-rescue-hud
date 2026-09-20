import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isValidRect } from "../scripts/geometry.mjs";

describe("isValidRect", () => {
  test("accepts a normal rect", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: 10, height: 10 }), true);
  });

  test("accepts negative x/y with positive width/height", () => {
    assert.equal(isValidRect({ x: -100, y: -50, width: 5, height: 5 }), true);
  });

  test("accepts very large but finite dimensions", () => {
    assert.equal(
      isValidRect({ x: 0, y: 0, width: Number.MAX_VALUE, height: Number.MAX_VALUE }),
      true,
    );
  });

  test("accepts a vanishingly small positive width/height", () => {
    assert.equal(
      isValidRect({ x: 0, y: 0, width: Number.MIN_VALUE, height: Number.MIN_VALUE }),
      true,
    );
  });

  test("ignores extra unrelated properties", () => {
    assert.equal(
      isValidRect({ x: 0, y: 0, width: 10, height: 10, rotation: 45, foo: "bar" }),
      true,
    );
  });

  test("rejects null", () => {
    assert.equal(isValidRect(null), false);
  });

  test("rejects undefined", () => {
    assert.equal(isValidRect(undefined), false);
  });

  test("rejects a plain string", () => {
    assert.equal(isValidRect("rect"), false);
  });

  test("rejects a number", () => {
    assert.equal(isValidRect(42), false);
  });

  test("rejects a boolean", () => {
    assert.equal(isValidRect(true), false);
  });

  test("rejects a function", () => {
    assert.equal(isValidRect(() => {}), false);
  });

  test("rejects an empty object", () => {
    assert.equal(isValidRect({}), false);
  });

  test("rejects an array (missing named properties)", () => {
    assert.equal(isValidRect([0, 0, 10, 10]), false);
  });

  test("rejects when width is missing", () => {
    assert.equal(isValidRect({ x: 0, y: 0, height: 10 }), false);
  });

  test("rejects when height is missing", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: 10 }), false);
  });

  test("rejects when x is missing", () => {
    assert.equal(isValidRect({ y: 0, width: 10, height: 10 }), false);
  });

  test("rejects when y is missing", () => {
    assert.equal(isValidRect({ x: 0, width: 10, height: 10 }), false);
  });

  test("rejects width of exactly zero", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: 0, height: 10 }), false);
  });

  test("rejects height of exactly zero", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: 10, height: 0 }), false);
  });

  test("rejects negative width", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: -10, height: 10 }), false);
  });

  test("rejects negative height", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: 10, height: -10 }), false);
  });

  test("rejects negative-zero width (not > 0)", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: -0, height: 10 }), false);
  });

  test("rejects NaN width", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: NaN, height: 10 }), false);
  });

  test("rejects NaN x", () => {
    assert.equal(isValidRect({ x: NaN, y: 0, width: 10, height: 10 }), false);
  });

  test("rejects Infinity width", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: Infinity, height: 10 }), false);
  });

  test("rejects -Infinity x", () => {
    assert.equal(isValidRect({ x: -Infinity, y: 0, width: 10, height: 10 }), false);
  });

  test("rejects a numeric string for width, even though it looks numeric", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: "10", height: 10 }), false);
  });

  test("rejects a numeric string for x", () => {
    assert.equal(isValidRect({ x: "0", y: 0, width: 10, height: 10 }), false);
  });

  test("rejects null for width", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: null, height: 10 }), false);
  });

  test("rejects undefined for x explicitly set", () => {
    assert.equal(isValidRect({ x: undefined, y: 0, width: 10, height: 10 }), false);
  });

  test("rejects a width that is itself an object", () => {
    assert.equal(isValidRect({ x: 0, y: 0, width: { valueOf: () => 10 }, height: 10 }), false);
  });
});
