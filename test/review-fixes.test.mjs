/**
 * Regression tests for defects found in code review.
 *
 * Each test here failed against the implementation as first written, so they
 * are the evidence that those defects are actually fixed rather than merely
 * described.
 */

import {test, describe, afterEach} from "node:test";
import assert from "node:assert/strict";

import {installFoundry, makeToken} from "./helpers/foundry-stub.mjs";

let env;
let RescueBar;
let invalidateConfig;

/** Import the modules under test after the globals exist. */
async function load() {
  ({RescueBar} = await import("../scripts/rescue-bar.mjs"));
  ({invalidateConfig} = await import("../scripts/settings.mjs"));
  invalidateConfig();
}

/** Let a queued animation frame run. */
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 20));

afterEach(() => {
  env?.cleanup();
  env = null;
});

describe("tracking a hovered token that covers nothing yet", () => {
  test("a token moving underneath brings the bar into being", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const walker = makeToken({id: "walker", name: "Goblin", x: 2000, y: 2000});
    env = installFoundry({tokens: [cover, walker]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0, "nothing buried yet");
    assert.equal(bar.anchor, cover, "but the hovered token stays tracked");

    walker.bounds = {x: 50, y: 50, width: 100, height: 100};
    bar.refreshSoon();
    await nextFrame();

    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 1);
  });

  test("a momentary dip below the threshold does not kill the bar for good", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(bar.visible, true);

    // The token slides right out from under the anchor for a moment.
    buried.bounds = {x: 900, y: 900, width: 100, height: 100};
    bar.refreshSoon();
    await nextFrame();
    assert.equal(bar.visible, false, "nothing is buried, so nothing is drawn");

    // And slides back.
    buried.bounds = {x: 50, y: 50, width: 100, height: 100};
    bar.refreshSoon();
    await nextFrame();
    assert.equal(bar.visible, true, "the bar must come back without a fresh hover");
  });

  test("hysteresis holds a token on the boundary instead of flickering", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 0, y: 0, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried], settings: {coverageThreshold: 0.8}});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(bar.visible, true, "fully covered to begin with");

    // Slide it partly past the cover's bottom edge at y=200, leaving 78%
    // covered: below the 0.8 threshold but inside the 0.05 margin.
    buried.bounds = {x: 0, y: 122, width: 100, height: 100};
    bar.show(cover);
    assert.equal(bar.visible, true, "held, because it was already listed");

    // Slide it further out, to 60% covered, well past the margin.
    buried.bounds = {x: 0, y: 140, width: 100, height: 100};
    bar.show(cover);
    assert.equal(bar.visible, false, "dropped once it is clearly uncovered");
  });
});

describe("placement against the viewport", () => {
  test("flips above when the token is low on screen but mid-scene", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 1500, width: 200, height: 100});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 1520, width: 100, height: 60});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    // Pan so the token sits near the bottom of an 768px tall viewport, while
    // remaining only halfway down a 3000px scene.
    env.window.canvas = null;
    globalThis.canvas.stage.position.y = -800;

    const bar = new RescueBar();
    bar.show(cover);

    const element = env.hud.querySelector(".ctrh-bar");
    assert.match(element.style.transform, /translate\(-50%, -100%\)/,
      "the bar would be off the bottom of the window if drawn below");
  });

  test("stays below when there is room on screen", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 1500, width: 200, height: 100});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 1520, width: 100, height: 60});
    env = installFoundry({tokens: [cover, buried]});
    await load();
    globalThis.canvas.stage.position.y = -1400;

    const bar = new RescueBar();
    bar.show(cover);

    const element = env.hud.querySelector(".ctrh-bar");
    assert.match(element.style.transform, /translate\(-50%, 0\)/);
  });

  test("caps its width against the viewport, not the scene", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried], zoom: 2, settings: {scaleWithZoom: true}});
    await load();

    const bar = new RescueBar();
    bar.show(cover);

    const element = env.hud.querySelector(".ctrh-bar");
    const cap = element.style.getPropertyValue("--ctrh-max-width");
    // At zoom 2 with no counter-scale, the layout cap must be half of the 60%
    // viewport share so the drawn width still lands on 60%.
    const expected = (env.window.innerWidth * 0.6) / 2;
    assert.equal(cap, `${expected}px`);
  });
});

describe("keeping the drawn bar in step with its tokens", () => {
  test("new artwork replaces the old portrait", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.match(env.hud.querySelector(".ctrh-portrait").getAttribute("src"), /goblin\.webp$/);

    buried.document.texture.src = "tokens/lich.webp";
    bar.show(cover);
    assert.match(env.hud.querySelector(".ctrh-portrait").getAttribute("src"), /lich\.webp$/);
  });

  test("a renamed token updates its tooltip", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    buried.document.name = "Sir Roland";
    bar.show(cover);

    assert.equal(env.hud.querySelector("button.ctrh-token").dataset.tooltipText, "Sir Roland");
  });

  test("a token revealed underneath the anchor appears in the bar", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const hidden = makeToken({id: "hidden", name: "Assassin", x: 50, y: 50, width: 100, height: 100});
    hidden.visible = false;
    env = installFoundry({tokens: [cover, hidden]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(bar.visible, false);

    hidden.visible = true;
    bar.show(cover);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 1);
  });

  test("granting ownership clears the unowned styling", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    buried.isOwner = false;
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(env.hud.querySelector("button.ctrh-token").classList.contains("unowned"), true);

    buried.isOwner = true;
    bar.show(cover);
    assert.equal(env.hud.querySelector("button.ctrh-token").classList.contains("unowned"), false);
  });
});

describe("resource handling", () => {
  test("a discarded video portrait is stopped and detached", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Slime", x: 50, y: 50, width: 100, height: 100});
    buried.document.texture.src = "tokens/slime.webm";
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    const video = env.hud.querySelector("video");
    assert.ok(video, "a video portrait is drawn");

    buried.document.texture.src = "tokens/ooze.webm";
    bar.show(cover);

    assert.equal(video.hasAttribute("src"), false, "the discarded element must release its source");
  });

  test("the canvas outline does not survive a rebuild", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector("button.ctrh-token").dispatchEvent(new env.window.Event("pointerenter"));
    assert.ok(env.hud.querySelector(".ctrh-marker"), "outline is drawn");

    buried.document.name = "Someone Else";
    bar.show(cover);
    assert.equal(env.hud.querySelector(".ctrh-marker"), null, "and cleared when the row is rebuilt");
  });

  test("the hide timer re-arms rather than giving up", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    const element = env.hud.querySelector(".ctrh-bar");

    element.dispatchEvent(new env.window.Event("pointerenter"));
    bar.scheduleHide();
    await new Promise(resolve => setTimeout(resolve, 260));
    assert.equal(bar.visible, true, "held while the pointer is on it");

    element.dispatchEvent(new env.window.Event("pointerleave"));
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(bar.visible, false, "and released once the pointer leaves");
  });

  test("a click resolves the token by id, surviving a layer redraw", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    const button = env.hud.querySelector("button.ctrh-token");

    // The tokens layer redraws and replaces the placeable with a new object.
    const replacement = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    replacement.scene = buried.scene;
    buried.destroyed = true;
    globalThis.canvas.tokens.placeables = [cover, replacement];
    globalThis.canvas.tokens.get = id => [cover, replacement].find(t => t.id === id) ?? null;

    button.dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));

    assert.equal(replacement.calls.control.length, 1, "the live token is controlled");
    assert.equal(buried.calls.control.length, 0, "not the stale one");
  });
});

describe("reaching for the bar when it overlaps another token", () => {
  /**
   * Give the bar a real rectangle. jsdom reports zeros for every element, which
   * would make any geometric hit test meaningless.
   *
   * @param {HTMLElement} el   The element to fix in place.
   * @param {object} rect      The rectangle it should report.
   */
  function pinRect(el, rect) {
    el.getBoundingClientRect = () => ({...rect, toJSON: () => rect});
  }

  test("the pointer counts as on the bar while crossing the gap below the token", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    env = installFoundry({tokens: [cover, buried]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    const element = env.hud.querySelector(".ctrh-bar");
    pinRect(element, {x: 100, y: 200, width: 120, height: 60, left: 100, top: 200, right: 220, bottom: 260});

    const move = (x, y) => {
      const ev = new env.window.MouseEvent("pointermove", {clientX: x, clientY: y, bubbles: true});
      env.window.document.dispatchEvent(ev);
    };

    // Squarely inside.
    move(160, 230);
    assert.equal(bar.containsPointer, true);

    // In the few pixels of gap between the token above and the bar. This is the
    // case that used to read as "pointer has left" and dismissed the bar.
    move(160, 194);
    assert.equal(bar.containsPointer, true, "the gap must not count as leaving");

    // Genuinely well away from it.
    move(160, 120);
    assert.equal(bar.containsPointer, false);
  });

  test("a token under the bar does not steal the anchor while the pointer is on it", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
    // Sits in the square below, exactly where the bar is drawn.
    const neighbour = makeToken({id: "south", name: "South", x: 0, y: 200, width: 200, height: 200});
    env = installFoundry({tokens: [cover, buried, neighbour]});
    await load();

    const bar = new RescueBar();
    bar.show(cover);
    const element = env.hud.querySelector(".ctrh-bar");
    pinRect(element, {x: 100, y: 200, width: 120, height: 60, left: 100, top: 200, right: 220, bottom: 260});
    env.window.document.dispatchEvent(
      new env.window.MouseEvent("pointermove", {clientX: 160, clientY: 230, bubbles: true}));

    assert.equal(bar.containsPointer, true);

    // This is what the entry point checks before re-anchoring.
    const wouldReanchor = (neighbour !== bar.anchor) && !bar.containsPointer;
    assert.equal(wouldReanchor, false, "hovering the token beneath must not re-anchor the bar");
    assert.equal(bar.anchor, cover);
    assert.equal(bar.visible, true);
  });
});
