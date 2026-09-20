import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { compareNames } from "../scripts/geometry.mjs";

let hadGame;
let originalGame;

beforeEach(() => {
  hadGame = Object.prototype.hasOwnProperty.call(globalThis, "game");
  originalGame = globalThis.game;
  delete globalThis.game;
});

afterEach(() => {
  if (hadGame) {
    globalThis.game = originalGame;
  } else {
    delete globalThis.game;
  }
});

describe("compareNames", () => {
  test("does not throw when the global `game` is undefined", () => {
    assert.doesNotThrow(() => compareNames("Goblin 2", "Goblin 10"));
  });

  test("numeric-aware sort: 'Goblin 2' sorts before 'Goblin 10'", () => {
    assert.ok(compareNames("Goblin 2", "Goblin 10") < 0);
  });

  test("numeric-aware sort is consistent in reverse", () => {
    assert.ok(compareNames("Goblin 10", "Goblin 2") > 0);
  });

  test("case-insensitive: 'apple' vs 'Banana' orders by letter, not case", () => {
    assert.ok(compareNames("apple", "Banana") < 0);
  });

  test("case-insensitive: identical names differing only in case compare equal", () => {
    assert.equal(compareNames("Goblin", "goblin"), 0);
  });

  test("actually sorts a mixed array into numeric order", () => {
    const names = ["Goblin 10", "Goblin 2", "Goblin 1"];
    names.sort(compareNames);
    assert.deepEqual(names, ["Goblin 1", "Goblin 2", "Goblin 10"]);
  });

  test("null sorts after a real name", () => {
    assert.ok(compareNames(null, "Goblin") > 0);
  });

  test("real name sorts before null", () => {
    assert.ok(compareNames("Goblin", null) < 0);
  });

  test("undefined sorts after a real name", () => {
    assert.ok(compareNames(undefined, "Goblin") > 0);
  });

  test("a number sorts after a real name", () => {
    assert.ok(compareNames(123, "Goblin") > 0);
  });

  test("empty string sorts after a real name", () => {
    assert.ok(compareNames("", "Goblin") > 0);
  });

  test("real name sorts before empty string", () => {
    assert.ok(compareNames("Goblin", "") < 0);
  });

  test("two empty strings compare equal", () => {
    assert.equal(compareNames("", ""), 0);
  });

  test("two undefined values compare equal", () => {
    assert.equal(compareNames(undefined, undefined), 0);
  });

  test("two null values compare equal", () => {
    assert.equal(compareNames(null, null), 0);
  });

  test("does not throw for exotic non-string inputs (object, array, symbol-free)", () => {
    assert.doesNotThrow(() => compareNames({}, []));
    assert.doesNotThrow(() => compareNames(NaN, "Goblin"));
  });

  test("sign is reversed when arguments are swapped, for a simple ASCII pair", () => {
    const forward = compareNames("Apple", "Banana");
    const backward = compareNames("Banana", "Apple");
    assert.ok(forward < 0);
    assert.ok(backward > 0);
  });

  test("still works when a `game` global is present (does not throw, returns a number)", () => {
    globalThis.game = { i18n: { lang: "en" }, settings: { get: () => "en" } };
    const result = compareNames("Alpha", "Beta");
    assert.equal(typeof result, "number");
    assert.ok(!Number.isNaN(result));
  });

  test("whitespace-only name is treated as a real (non-empty) string, not thrown on", () => {
    assert.doesNotThrow(() => compareNames("   ", "Goblin"));
  });

  test("large numeric suffixes stay in numeric order beyond double digits", () => {
    assert.ok(compareNames("Zombie 9", "Zombie 100") < 0);
  });
});
