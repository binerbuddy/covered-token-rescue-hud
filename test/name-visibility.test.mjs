/**
 * Tests for name-visibility: does `isNameVisible`/`visibleName` follow the
 * same ownership and display-mode rules as the canvas nameplate, and does the
 * bar's DOM output actually withhold a hidden name rather than merely hiding
 * it with CSS?
 *
 * The first block imports the module before any Foundry globals exist, since
 * `scripts/rescue-bar.mjs` is also loaded by test files (e.g.
 * `rescue-bar-isVideoSource.test.mjs`) that never call `installFoundry`.
 */

import {test, describe, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";

import {installFoundry, makeToken} from "./helpers/foundry-stub.mjs";

const MODES = {NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50};

describe("surviving a plain Node context (no CONST or game global)", () => {
  test("importing the module does not throw when CONST and game are undefined", async () => {
    assert.equal(Object.prototype.hasOwnProperty.call(globalThis, "CONST"), false,
      "test setup invariant: CONST must not already be defined");
    assert.equal(Object.prototype.hasOwnProperty.call(globalThis, "game"), false,
      "test setup invariant: game must not already be defined");
    await assert.doesNotReject(() => import("../scripts/rescue-bar.mjs"));
  });

  test("isNameVisible(owner) does not throw for a ReferenceError on CONST or game", async () => {
    const {isNameVisible} = await import("../scripts/rescue-bar.mjs");
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: true, displayName: MODES.NONE});
    let result;
    assert.doesNotThrow(() => { result = isNameVisible(token); });
    assert.equal(result, true, "an owner sees the name even with displayName NONE");
  });

  test("visibleName(owner) does not throw and returns the name", async () => {
    const {visibleName} = await import("../scripts/rescue-bar.mjs");
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: true, displayName: MODES.NONE});
    let result;
    assert.doesNotThrow(() => { result = visibleName(token); });
    assert.equal(result, "Paladin");
  });
});

describe("isNameVisible: ownership and GM overrides", () => {
  let env;
  let isNameVisible;

  beforeEach(async () => {
    env = installFoundry({tokens: []});
    ({isNameVisible} = await import("../scripts/rescue-bar.mjs"));
  });

  afterEach(() => {
    env?.cleanup();
    env = null;
  });

  test("an owner sees the name regardless of displayName NONE", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: true, displayName: MODES.NONE});
    assert.equal(isNameVisible(token), true);
  });

  test("the GM sees the name regardless of ownership or displayName NONE", () => {
    globalThis.game.user.isGM = true;
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    assert.equal(isNameVisible(token), true);
    globalThis.game.user.isGM = false;
  });
});

describe("isNameVisible: the display-mode matrix for a non-owner, non-GM viewer", () => {
  let env;
  let isNameVisible;

  beforeEach(async () => {
    env = installFoundry({tokens: []});
    ({isNameVisible} = await import("../scripts/rescue-bar.mjs"));
  });

  afterEach(() => {
    env?.cleanup();
    env = null;
  });

  test("NONE is hidden", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    assert.equal(isNameVisible(token), false);
  });

  test("CONTROL is hidden (owner-only mode, and this viewer is not the owner)", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.CONTROL});
    assert.equal(isNameVisible(token), false);
  });

  test("OWNER_HOVER is hidden (owner-only mode)", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.OWNER_HOVER});
    assert.equal(isNameVisible(token), false);
  });

  test("HOVER is visible to anyone", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.HOVER});
    assert.equal(isNameVisible(token), true);
  });

  test("OWNER is hidden for a non-owner: OWNER means always-for-the-owner, not always-for-everyone", () => {
    // This is the trap: OWNER (40) sits numerically between HOVER (30) and
    // ALWAYS (50), so a naive `displayName >= HOVER` comparison would
    // wrongly show the name here. Per CONST.TOKEN_DISPLAY_MODES, OWNER only
    // ever reveals the name to the owning user (or the GM).
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.OWNER});
    assert.equal(isNameVisible(token), false);
  });

  test("ALWAYS is visible to anyone", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.ALWAYS});
    assert.equal(isNameVisible(token), true);
  });
});

describe("isNameVisible: boundary and malformed inputs", () => {
  let env;
  let isNameVisible;

  beforeEach(async () => {
    env = installFoundry({tokens: []});
    ({isNameVisible} = await import("../scripts/rescue-bar.mjs"));
  });

  afterEach(() => {
    env?.cleanup();
    env = null;
  });

  test("a missing displayName defaults to Foundry's own NONE default, hidden for a non-owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false});
    delete token.document.displayName;
    assert.equal(isNameVisible(token), false);
  });

  test("a missing displayName still shows for an owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: true});
    delete token.document.displayName;
    assert.equal(isNameVisible(token), true);
  });

  test("an out-of-range displayName between OWNER_HOVER and HOVER is hidden for a non-owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: 25});
    assert.equal(isNameVisible(token), false);
  });

  test("an out-of-range displayName between HOVER and OWNER is hidden for a non-owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: 35});
    assert.equal(isNameVisible(token), false);
  });

  test("a negative displayName is hidden for a non-owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: -1});
    assert.equal(isNameVisible(token), false);
  });

  test("a displayName above ALWAYS is hidden for a non-owner (not treated as 'more visible than ALWAYS')", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: 999});
    assert.equal(isNameVisible(token), false);
  });

  test("NaN displayName does not throw and is hidden for a non-owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: NaN});
    let result;
    assert.doesNotThrow(() => { result = isNameVisible(token); });
    assert.equal(result, false);
  });

  test("a string displayName (wrong type) does not throw and does not equal HOVER by coercion", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false});
    token.document.displayName = "30";
    let result;
    assert.doesNotThrow(() => { result = isNameVisible(token); });
    assert.equal(result, false, "\"30\" !== 30; a loose implementation might wrongly coerce this to true");
  });

  test("null token does not throw and is treated as not visible", () => {
    let result;
    assert.doesNotThrow(() => { result = isNameVisible(null); });
    assert.equal(result, false);
  });

  test("undefined token does not throw and is treated as not visible", () => {
    let result;
    assert.doesNotThrow(() => { result = isNameVisible(undefined); });
    assert.equal(result, false);
  });

  test("a token with a null document does not throw", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false});
    token.document = null;
    assert.doesNotThrow(() => isNameVisible(token));
  });

  test("a token with isOwner undefined (falsy, not strictly false) is treated as not an owner", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    delete token.isOwner;
    assert.equal(isNameVisible(token), false);
  });
});

describe("visibleName", () => {
  let env;
  let visibleName;

  beforeEach(async () => {
    env = installFoundry({tokens: []});
    ({visibleName} = await import("../scripts/rescue-bar.mjs"));
  });

  afterEach(() => {
    env?.cleanup();
    env = null;
  });

  test("returns '' rather than null/undefined/false when the name is hidden", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    const result = visibleName(token);
    assert.equal(result, "");
    assert.equal(typeof result, "string");
  });

  test("an empty token name stays an empty string when visible, not 'undefined' or similar", () => {
    const token = makeToken({id: "t", name: "", x: 0, y: 0, isOwner: true, displayName: MODES.NONE});
    assert.equal(visibleName(token), "");
  });

  test("does not leak any part of the hidden name, even via whitespace-padding tricks", () => {
    const token = makeToken({id: "t", name: "   Secret Name   ", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    assert.equal(visibleName(token), "");
  });

  test("null token returns '' without throwing", () => {
    let result;
    assert.doesNotThrow(() => { result = visibleName(null); });
    assert.equal(result, "");
  });

  test("undefined token returns '' without throwing", () => {
    let result;
    assert.doesNotThrow(() => { result = visibleName(undefined); });
    assert.equal(result, "");
  });

  test("a numeric or otherwise non-string token.document.name does not throw", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: true, displayName: MODES.NONE});
    token.document.name = 12345;
    assert.doesNotThrow(() => visibleName(token));
  });

  test("does not mutate the token object", () => {
    const token = makeToken({id: "t", name: "Paladin", x: 0, y: 0, isOwner: false, displayName: MODES.NONE});
    const before = JSON.stringify(token.document);
    visibleName(token);
    assert.equal(JSON.stringify(token.document), before);
  });
});

describe("integration: the rescue bar never leaks a hidden name into the DOM", () => {
  let env;
  let RescueBar;
  let invalidateConfig;

  /** Import the modules under test after globals exist. */
  async function load() {
    ({RescueBar} = await import("../scripts/rescue-bar.mjs"));
    ({invalidateConfig} = await import("../scripts/settings.mjs"));
    invalidateConfig();
  }

  afterEach(() => {
    env?.cleanup();
    env = null;
  });

  test("a hidden name sets neither dataset.tooltipText nor a leaking aria-label", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({
      id: "buried", name: "Undercover Agent", x: 50, y: 50, width: 100, height: 100,
      isOwner: false, displayName: MODES.NONE
    });
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);

    const button = env.hud.querySelector("button.ctrh-token");
    assert.ok(button, "the buried token is still listed, just anonymised");
    assert.equal(button.dataset.tooltipText, undefined,
      "dataset.tooltipText must be entirely absent, not set to ''");
    assert.equal(button.getAttribute("aria-label"), "CTRH.UnknownToken",
      "falls back to the localized unknown-token key");
    assert.equal(button.outerHTML.includes("Undercover Agent"), false,
      "the hidden name must not appear anywhere in the rendered markup");
  });

  test("a visible name is used for both the tooltip and the aria-label", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({
      id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100,
      isOwner: true
    });
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);

    const button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, "Paladin");
    assert.equal(button.getAttribute("aria-label"), "Paladin");
  });

  test("a later show() picks up a displayName change instead of caching the first visibility check", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({
      id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100,
      isOwner: false, displayName: MODES.NONE
    });
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    let button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, undefined, "hidden at first");

    buried.document.displayName = MODES.ALWAYS;
    bar.show(cover);
    button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, "Paladin", "revealed once displayName allows it");
  });

  test("a later show() picks up a lost ownership change and re-hides the name", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({
      id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100,
      isOwner: true, displayName: MODES.NONE
    });
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    let button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, "Paladin", "visible while owned");

    buried.isOwner = false;
    bar.show(cover);
    button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, undefined, "hidden once ownership is lost");
    assert.equal(button.getAttribute("aria-label"), "CTRH.UnknownToken");
  });

  test("granting the GM role after the first show() reveals the name on the next show()", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({
      id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100,
      isOwner: false, displayName: MODES.NONE
    });
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    let button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, undefined);

    globalThis.game.user.isGM = true;
    bar.show(cover);
    button = env.hud.querySelector("button.ctrh-token");
    assert.equal(button.dataset.tooltipText, "Paladin", "the GM override applies on the next show()");
  });
});
