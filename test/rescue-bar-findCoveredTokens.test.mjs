import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { findCoveredTokens } from "../scripts/rescue-bar.mjs";

let hadCanvas;
let originalCanvas;

beforeEach(() => {
  hadCanvas = Object.prototype.hasOwnProperty.call(globalThis, "canvas");
  originalCanvas = globalThis.canvas;
});

afterEach(() => {
  if (hadCanvas) {
    globalThis.canvas = originalCanvas;
  } else {
    delete globalThis.canvas;
  }
});

function makeToken({
  name,
  bounds,
  isPreview = false,
  visible = true,
  isOwner = true,
}) {
  return {
    document: { name },
    bounds,
    isPreview,
    visible,
    isOwner,
  };
}

function setCanvas({ ready = true, isHexagonal = false, placeables = [] }) {
  globalThis.canvas = {
    ready,
    grid: { isHexagonal },
    tokens: { placeables },
  };
}

describe("findCoveredTokens", () => {
  test("returns [] when canvas.ready is false", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const buried = makeToken({ name: "Buried", bounds: { x: 0, y: 0, width: 50, height: 50 } });
    setCanvas({ ready: false, placeables: [anchor, buried] });
    assert.deepEqual(findCoveredTokens(anchor, { threshold: 0.5, showUnowned: true }), []);
  });

  test("returns [] when anchor is null", () => {
    setCanvas({ ready: true, placeables: [] });
    assert.deepEqual(findCoveredTokens(null, { threshold: 0.5, showUnowned: true }), []);
  });

  test("returns [] when anchor is undefined", () => {
    setCanvas({ ready: true, placeables: [] });
    assert.deepEqual(findCoveredTokens(undefined, { threshold: 0.5, showUnowned: true }), []);
  });

  test("returns [] when placeables is empty", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    setCanvas({ ready: true, placeables: [] });
    assert.deepEqual(findCoveredTokens(anchor, { threshold: 0.5, showUnowned: true }), []);
  });

  test("finds a fully-buried token underneath the anchor", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const buried = makeToken({ name: "Buried", bounds: { x: 10, y: 10, width: 20, height: 20 } });
    setCanvas({ ready: true, placeables: [anchor, buried] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: true });
    assert.equal(result.length, 1);
    assert.equal(result[0], buried);
  });

  test("excludes a candidate whose overlap is below the threshold", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const barelyTouching = makeToken({
      name: "Barely",
      bounds: { x: 90, y: 90, width: 100, height: 100 }, // small corner overlap
    });
    setCanvas({ ready: true, placeables: [anchor, barelyTouching] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("excludes the anchor itself even though it trivially overlaps itself completely", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    setCanvas({ ready: true, placeables: [anchor] });
    const result = findCoveredTokens(anchor, { threshold: 0.5, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("does NOT exclude a different token that merely shares the anchor's exact bounds", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const impostor = makeToken({ name: "Impostor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    setCanvas({ ready: true, placeables: [anchor, impostor] });
    const result = findCoveredTokens(anchor, { threshold: 1, showUnowned: true });
    assert.equal(result.length, 1);
    assert.equal(result[0], impostor);
  });

  test("excludes tokens where isPreview is true", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const preview = makeToken({
      name: "Preview",
      bounds: { x: 10, y: 10, width: 20, height: 20 },
      isPreview: true,
    });
    setCanvas({ ready: true, placeables: [anchor, preview] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("excludes tokens where visible is false", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const hidden = makeToken({
      name: "Hidden",
      bounds: { x: 10, y: 10, width: 20, height: 20 },
      visible: false,
    });
    setCanvas({ ready: true, placeables: [anchor, hidden] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("excludes unowned tokens when showUnowned is false", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const unowned = makeToken({
      name: "Unowned",
      bounds: { x: 10, y: 10, width: 20, height: 20 },
      isOwner: false,
    });
    setCanvas({ ready: true, placeables: [anchor, unowned] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: false });
    assert.equal(result.length, 0);
  });

  test("includes unowned tokens when showUnowned is true", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const unowned = makeToken({
      name: "Unowned",
      bounds: { x: 10, y: 10, width: 20, height: 20 },
      isOwner: false,
    });
    setCanvas({ ready: true, placeables: [anchor, unowned] });
    const result = findCoveredTokens(anchor, { threshold: 0.9, showUnowned: true });
    assert.equal(result.length, 1);
    assert.equal(result[0], unowned);
  });

  test("threshold of 0 (invalid per geometry contract) returns no tokens even with full overlap", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const buried = makeToken({ name: "Buried", bounds: { x: 10, y: 10, width: 20, height: 20 } });
    setCanvas({ ready: true, placeables: [anchor, buried] });
    const result = findCoveredTokens(anchor, { threshold: 0, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("multiple covered tokens are sorted by display name, numeric-aware", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const g10 = makeToken({ name: "Goblin 10", bounds: { x: 10, y: 10, width: 5, height: 5 } });
    const g2 = makeToken({ name: "Goblin 2", bounds: { x: 20, y: 20, width: 5, height: 5 } });
    const g1 = makeToken({ name: "Goblin 1", bounds: { x: 30, y: 30, width: 5, height: 5 } });
    setCanvas({ ready: true, placeables: [anchor, g10, g2, g1] });
    const result = findCoveredTokens(anchor, { threshold: 0.5, showUnowned: true });
    assert.deepEqual(result.map((t) => t.document.name), ["Goblin 1", "Goblin 2", "Goblin 10"]);
  });

  test("anchor with an invalid (degenerate) rect covers nothing", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 0, height: 0 } });
    const candidate = makeToken({ name: "Candidate", bounds: { x: 0, y: 0, width: 10, height: 10 } });
    setCanvas({ ready: true, placeables: [anchor, candidate] });
    const result = findCoveredTokens(anchor, { threshold: 0.01, showUnowned: true });
    assert.equal(result.length, 0);
  });

  test("hexagonal grid insetting can change whether a candidate is considered covered", () => {
    // anchor: [0,100]x[0,100]; candidate shifted right by 50: [50,150]x[0,100]
    // Non-hex overlap: x[50,100] width 50, area 5000; candidate area 10000 -> ratio 0.5
    const anchorBounds = { x: 0, y: 0, width: 100, height: 100 };
    const candidateBounds = { x: 50, y: 0, width: 100, height: 100 };

    const anchorFlat = makeToken({ name: "Anchor", bounds: { ...anchorBounds } });
    const candidateFlat = makeToken({ name: "Buried", bounds: { ...candidateBounds } });
    setCanvas({ ready: true, isHexagonal: false, placeables: [anchorFlat, candidateFlat] });
    const flatResult = findCoveredTokens(anchorFlat, { threshold: 0.5, showUnowned: true });

    const anchorHex = makeToken({ name: "Anchor", bounds: { ...anchorBounds } });
    const candidateHex = makeToken({ name: "Buried", bounds: { ...candidateBounds } });
    setCanvas({ ready: true, isHexagonal: true, placeables: [anchorHex, candidateHex] });
    const hexResult = findCoveredTokens(anchorHex, { threshold: 0.5, showUnowned: true });

    // With both rects inset by 0.125/side before the coverage test:
    // anchor -> [12.5,87.5]x[12.5,87.5] (75x75)
    // candidate -> [62.5,137.5]x[12.5,87.5] (75x75)
    // overlap x[62.5,87.5] width 25, y width 75 -> area 1875
    // candidate(inset) area 5625 -> ratio 0.3333... < 0.5 threshold
    assert.equal(flatResult.length, 1, "without hex insetting, 0.5 ratio meets a 0.5 threshold");
    assert.equal(
      hexResult.length,
      0,
      "with hex insetting applied to both rects, the ratio should drop below the 0.5 threshold",
    );
  });

  test("does not throw when canvas.tokens.placeables contains a token missing optional flags", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const sparse = { document: { name: "Sparse" }, bounds: { x: 10, y: 10, width: 20, height: 20 } };
    setCanvas({ ready: true, placeables: [anchor, sparse] });
    assert.doesNotThrow(() => findCoveredTokens(anchor, { threshold: 0.5, showUnowned: true }));
  });

  test("a candidate token with an invalid bounds rect is simply never covered, not thrown on", () => {
    const anchor = makeToken({ name: "Anchor", bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const broken = makeToken({ name: "Broken", bounds: { x: 10, y: 10, width: NaN, height: 20 } });
    setCanvas({ ready: true, placeables: [anchor, broken] });
    assert.doesNotThrow(() => findCoveredTokens(anchor, { threshold: 0.01, showUnowned: true }));
    const result = findCoveredTokens(anchor, { threshold: 0.01, showUnowned: true });
    assert.equal(result.length, 0);
  });
});
