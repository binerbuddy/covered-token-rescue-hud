/**
 * Raising a rescued token above the pile that buried it.
 *
 * Selecting a token does not change its render order, so every pointer event
 * over that square still goes to whatever is drawn on top. The token is
 * selected but cannot be dragged or clicked. Raising it writes `sort` on the
 * token document, which every client sees, so these tests care as much about
 * when the module declines to write as about when it does.
 */

import {test, describe, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";

import {installFoundry, makeToken} from "./helpers/foundry-stub.mjs";

let env;
let RescueBar;
let bringToFront;
let frontSort;
let invalidateConfig;

/** Import the modules under test after globals exist. */
async function load() {
  ({RescueBar, bringToFront, frontSort} = await import("../scripts/rescue-bar.mjs"));
  ({invalidateConfig} = await import("../scripts/settings.mjs"));
}

/** Let the click handler's un-awaited update settle. */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  env?.cleanup();
  env = null;
});

describe("choosing a sort that clears the pile", () => {
  beforeEach(() => {
    invalidateConfig?.();
  });

  test("picks one above the highest token overlapping it", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 7, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    assert.deepEqual(frontSort(mine), {sort: 8, blockedByElevation: false});
  });

  test("raises out of a pile where nothing has ever set sort", async () => {
    // The state every real scene is in: nothing sets sort, so the whole pile
    // sits at 0 and a tie is not a win. This is the case that matters.
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 0, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    assert.deepEqual(frontSort(mine), {sort: 1, blockedByElevation: false});
  });

  test("raises when tied against the highest of several", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 4});
    const a = makeToken({id: "a", name: "Dragon", x: 0, y: 0, sort: 4, isOwner: false});
    const b = makeToken({id: "b", name: "Kobold", x: 0, y: 0, sort: 2, isOwner: false});
    env = installFoundry({tokens: [mine, a, b]});
    await load();

    assert.equal(frontSort(mine).sort, 5, "a tie with the top token still needs breaking");
  });

  test("ignores tokens that do not overlap", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const far = makeToken({id: "far", name: "Archer", x: 900, y: 900, sort: 99, isOwner: false});
    env = installFoundry({tokens: [mine, far]});
    await load();

    assert.equal(frontSort(mine).sort, null, "a token elsewhere cannot bury this one");
  });

  test("returns null when the token is already on top", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 9});
    const under = makeToken({id: "under", name: "Dragon", x: 0, y: 0, sort: 2, isOwner: false});
    env = installFoundry({tokens: [mine, under]});
    await load();

    assert.equal(frontSort(mine).sort, null);
  });

  test("a token standing lower down does not drag the sort up", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0, elevation: 5});
    const below = makeToken({
      id: "below", name: "Kobold", x: 0, y: 0, sort: 50, elevation: 0, isOwner: false
    });
    env = installFoundry({tokens: [mine, below]});
    await load();

    assert.equal(frontSort(mine).sort, null, "elevation already puts it in front");
  });

  test("reports a token buried by something standing higher up", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0, elevation: 0});
    const flyer = makeToken({
      id: "flyer", name: "Wyvern", x: 0, y: 0, sort: 0, elevation: 20, isOwner: false
    });
    env = installFoundry({tokens: [mine, flyer]});
    await load();

    assert.deepEqual(frontSort(mine), {sort: null, blockedByElevation: true});
  });

  test("survives a canvas with nothing on it", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0});
    env = installFoundry({tokens: [mine]});
    await load();

    assert.deepEqual(frontSort(mine), {sort: null, blockedByElevation: false});
    assert.deepEqual(frontSort(null), {sort: null, blockedByElevation: false});
    assert.deepEqual(frontSort(undefined), {sort: null, blockedByElevation: false});
  });
});

describe("writing the raise", () => {
  beforeEach(() => {
    invalidateConfig?.();
  });

  test("updates the document and reports that it did", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 3, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    assert.equal(await bringToFront(mine), true);
    assert.deepEqual(mine.calls.update, [{sort: 4}]);
  });

  test("refuses to touch a token you do not own", async () => {
    const theirs = makeToken({id: "theirs", name: "Cleric", x: 0, y: 0, sort: 0, isOwner: false});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 3, isOwner: false});
    env = installFoundry({tokens: [theirs, over]});
    await load();

    assert.equal(await bringToFront(theirs), false);
    assert.deepEqual(theirs.calls.update, [], "the server would reject this anyway");
  });

  test("raises a default pile through the click path", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200,
      sort: 0, isOwner: false});
    const mine = makeToken({id: "mine", name: "Rogue", x: 50, y: 50, sort: 0});
    env = installFoundry({tokens: [cover, mine], settings: {raiseOnSelect: true}});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector('button[data-token-id="mine"]')
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));
    await settle();

    assert.deepEqual(mine.calls.update, [{sort: 1}], "an all-zero pile must still raise");
  });

  test("clicking twice does not ratchet the sort upwards, from a default pile", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 0, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    await bringToFront(mine);
    await bringToFront(mine);
    await bringToFront(mine);

    assert.deepEqual(mine.calls.update, [{sort: 1}], "one write, then it is genuinely on top");
  });

  test("clicking twice does not ratchet the sort upwards", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 3, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    await bringToFront(mine);
    await bringToFront(mine);
    await bringToFront(mine);

    assert.deepEqual(mine.calls.update, [{sort: 4}], "only the first click has work to do");
  });

  test("a rejected update is swallowed rather than thrown", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, sort: 0, updateFails: true});
    const over = makeToken({id: "over", name: "Dragon", x: 0, y: 0, sort: 3, isOwner: false});
    env = installFoundry({tokens: [mine, over]});
    await load();

    assert.equal(await bringToFront(mine), false, "must not reject into the click handler");
    assert.deepEqual(mine.calls.update, [{sort: 4}], "it did try");
  });

  test("tells the user when sorting cannot help", async () => {
    const mine = makeToken({id: "mine", name: "Rogue", x: 0, y: 0, elevation: 0});
    const flyer = makeToken({
      id: "flyer", name: "Wyvern", x: 0, y: 0, elevation: 20, isOwner: false
    });
    env = installFoundry({tokens: [mine, flyer]});
    await load();

    assert.equal(await bringToFront(mine), false);
    assert.deepEqual(mine.calls.update, []);
    assert.deepEqual(env.uiCalls.info, ["CTRH.RaiseBlockedByElevation"]);
  });
});

describe("the setting gates the whole thing", () => {
  beforeEach(() => {
    invalidateConfig?.();
  });

  test("clicking a portrait raises the token when the setting is on", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200,
      sort: 5, isOwner: false});
    const mine = makeToken({id: "mine", name: "Rogue", x: 50, y: 50, sort: 0});
    env = installFoundry({tokens: [cover, mine], settings: {raiseOnSelect: true}});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector('button[data-token-id="mine"]')
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));
    await settle();

    assert.deepEqual(mine.calls.control, [{releaseOthers: true}], "it still selects");
    assert.deepEqual(mine.calls.update, [{sort: 6}], "and now it also raises");
  });

  test("clicking changes nothing on the document by default", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200,
      sort: 5, isOwner: false});
    const mine = makeToken({id: "mine", name: "Rogue", x: 50, y: 50, sort: 0});
    env = installFoundry({tokens: [cover, mine]});
    await load();
    invalidateConfig();

    assert.equal(env.settings.raiseOnSelect, false, "opt in, because it is a shared write");

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector('button[data-token-id="mine"]')
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));
    await settle();

    assert.deepEqual(mine.calls.control, [{releaseOthers: true}]);
    assert.deepEqual(mine.calls.update, []);
  });

  test("right click raises too, since it also selects", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200,
      sort: 5, isOwner: false});
    const mine = makeToken({id: "mine", name: "Rogue", x: 50, y: 50, sort: 0});
    env = installFoundry({tokens: [cover, mine], settings: {raiseOnSelect: true}});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector('button[data-token-id="mine"]')
      .dispatchEvent(new env.window.MouseEvent("contextmenu", {bubbles: true}));
    await settle();

    assert.deepEqual(env.hudCalls.bind, ["mine"], "the HUD still opens");
    assert.deepEqual(mine.calls.update, [{sort: 6}]);
  });

  test("a portrait you do not own is never raised, setting or not", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200,
      sort: 5, isOwner: false});
    const theirs = makeToken({id: "theirs", name: "Cleric", x: 50, y: 50, sort: 0, isOwner: false});
    env = installFoundry({tokens: [cover, theirs], settings: {raiseOnSelect: true}});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const button = env.hud.querySelector('button[data-token-id="theirs"]');
    button.dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));
    button.dispatchEvent(new env.window.MouseEvent("contextmenu", {bubbles: true}));
    await settle();

    assert.deepEqual(theirs.calls.update, []);
    assert.equal(theirs.calls.setTarget.length, 1, "right click still targets it");
  });
});
