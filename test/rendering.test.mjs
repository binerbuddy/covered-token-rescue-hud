/**
 * Integration tests for the rescue bar: does it actually build the DOM, place
 * it correctly and wire up its interactions?
 *
 * These run against jsdom with stubbed Foundry globals, so they verify the
 * module's own behaviour rather than Foundry's.
 */

import {test, describe, beforeEach, afterEach} from "node:test";
import assert from "node:assert/strict";

import {installFoundry, makeToken} from "./helpers/foundry-stub.mjs";

let env;
let RescueBar;
let invalidateConfig;

/** Import the modules under test after globals exist. */
async function load() {
  ({RescueBar} = await import("../scripts/rescue-bar.mjs"));
  ({invalidateConfig} = await import("../scripts/settings.mjs"));
}

/**
 * A big token sitting on top of a small one, plus a bystander well clear of both.
 * @returns {{cover: object, buried: object, bystander: object}}
 */
function stack() {
  return {
    cover: makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200}),
    buried: makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100}),
    bystander: makeToken({id: "bystander", name: "Archer", x: 900, y: 900})
  };
}

afterEach(() => {
  env?.cleanup();
  env = null;
});

describe("rescue bar rendering", () => {
  beforeEach(() => {
    invalidateConfig?.();
  });

  test("renders one button per buried token, attached to the HUD layer", async () => {
    const {cover, buried, bystander} = stack();
    env = installFoundry({tokens: [cover, buried, bystander]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const buttons = env.hud.querySelectorAll("button.ctrh-token");
    assert.equal(buttons.length, 1, "only the buried token should be listed");
    assert.equal(buttons[0].dataset.tokenId, "buried");
    assert.equal(buttons[0].dataset.tooltipText, "Paladin");
    assert.equal(env.hud.querySelector(".ctrh-layer")?.isConnected, true);
  });

  test("hides itself when nothing is buried", async () => {
    const {cover, bystander} = stack();
    env = installFoundry({tokens: [cover, bystander]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
    assert.equal(bar.visible, false);
  });

  test("places the bar below the token and counter-scales the canvas zoom", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried], zoom: 0.5});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const element = env.hud.querySelector(".ctrh-bar");
    // Anchor spans y 0..200, so the bar sits just below at 200 plus the gap.
    assert.match(element.style.top, /^2\d\d(\.\d+)?px$/);
    assert.equal(element.style.left, "100px", "centred on the anchor");
    assert.match(element.style.transform, /scale\(2\)/, "0.5 zoom is cancelled by a 2x scale");
  });

  test("flips above the token near the bottom edge of the scene", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 2900, width: 200, height: 100});
    const buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 2930, width: 100, height: 40});
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const element = env.hud.querySelector(".ctrh-bar");
    assert.match(element.style.transform, /translate\(-50%, -100%\)/);
  });

  test("does not rebuild its buttons when the line-up is unchanged", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const first = env.hud.querySelector("button.ctrh-token");
    bar.show(cover);
    const second = env.hud.querySelector("button.ctrh-token");

    assert.equal(first, second, "the same button element should be reused");
  });

  test("omits unowned tokens when configured to", async () => {
    const {cover, buried} = stack();
    buried.isOwner = false;
    env = installFoundry({tokens: [cover, buried], settings: {showUnowned: false}});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
  });

  test("skips invisible and preview tokens", async () => {
    const {cover, buried} = stack();
    const preview = makeToken({id: "preview", name: "Ghost", x: 50, y: 50});
    preview.isPreview = true;
    buried.visible = false;
    env = installFoundry({tokens: [cover, buried, preview]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
  });

  test("uses a video element for animated token art", async () => {
    const {cover, buried} = stack();
    buried.document.texture.src = "tokens/slime.webm";
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const media = env.hud.querySelector(".ctrh-portrait");
    assert.equal(media.tagName, "VIDEO");
    assert.equal(media.muted, true, "must be muted or the browser blocks playback");
    assert.equal(media.loop, true);
  });

  test("renders a token named with markup as text, not HTML", async () => {
    const {cover, buried} = stack();
    buried.document.name = "<img src=x onerror=alert(1)>";
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const button = env.hud.querySelector("button.ctrh-token");
    // The name is carried as an attribute value, which is never parsed as
    // markup, and Foundry renders data-tooltip-text via textContent. The name
    // must therefore never become an element of its own.
    assert.equal(button.dataset.tooltipText, "<img src=x onerror=alert(1)>");
    assert.equal(button.children.length, 1, "only the portrait element");
    assert.equal(button.children[0].classList.contains("ctrh-portrait"), true);
    assert.equal(button.querySelector("img[onerror]"), null, "no element built from the name");
  });

  test("sorts buried tokens by name, numerically", async () => {
    const cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 400, height: 400});
    const tokens = [
      cover,
      makeToken({id: "g10", name: "Goblin 10", x: 10, y: 10, width: 50, height: 50}),
      makeToken({id: "g2", name: "Goblin 2", x: 80, y: 10, width: 50, height: 50}),
      makeToken({id: "a", name: "Acolyte", x: 150, y: 10, width: 50, height: 50})
    ];
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);

    const names = [...env.hud.querySelectorAll("button.ctrh-token")].map(b => b.dataset.tooltipText);
    assert.deepEqual(names, ["Acolyte", "Goblin 2", "Goblin 10"]);
  });
});

describe("rescue bar interaction", () => {
  test("clicking a portrait controls that token", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const button = env.hud.querySelector("button.ctrh-token");
    button.dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));

    assert.equal(buried.calls.control.length, 1);
    assert.equal(buried.calls.control[0].releaseOthers, true);
    assert.equal(button.classList.contains("controlled"), true);
  });

  test("shift clicking adds to the selection instead of replacing it", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector("button.ctrh-token")
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true, shiftKey: true}));

    assert.equal(buried.calls.control[0].releaseOthers, false);
  });

  test("right clicking an owned token opens the core token HUD", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    env.hud.querySelector("button.ctrh-token")
      .dispatchEvent(new env.window.MouseEvent("contextmenu", {bubbles: true}));

    assert.deepEqual(env.hudCalls.bind, ["buried"]);
  });

  test("right clicking an unowned token toggles targeting", async () => {
    const {cover, buried} = stack();
    buried.isOwner = false;
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const button = env.hud.querySelector("button.ctrh-token");
    button.dispatchEvent(new env.window.MouseEvent("contextmenu", {bubbles: true}));

    assert.equal(buried.calls.setTarget.length, 1);
    assert.equal(buried.calls.setTarget[0].state, true);
    assert.deepEqual(env.hudCalls.bind, [], "must not open the HUD for a token you cannot edit");
  });

  test("pointing at a portrait outlines the token on the canvas", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const button = env.hud.querySelector("button.ctrh-token");

    button.dispatchEvent(new env.window.Event("pointerenter"));
    const marker = env.hud.querySelector(".ctrh-marker");
    assert.ok(marker, "an outline should appear");
    assert.equal(marker.style.left, "50px");
    assert.equal(marker.style.width, "100px");

    button.dispatchEvent(new env.window.Event("pointerleave"));
    assert.equal(env.hud.querySelector(".ctrh-marker"), null, "and disappear again");
  });

  test("the bar survives the pointer moving onto it", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    const element = env.hud.querySelector(".ctrh-bar");

    // The token is un-hovered, then the pointer lands on the bar before the
    // grace period elapses.
    bar.scheduleHide();
    element.dispatchEvent(new env.window.Event("pointerenter"));
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.equal(bar.visible, true, "the bar must still be there to click");
  });

  test("the bar goes away when the pointer never arrives", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(cover);
    bar.scheduleHide();
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.equal(bar.visible, false);
  });

  test("hiding and showing again does not leave a second bar behind", async () => {
    const {cover, buried} = stack();
    env = installFoundry({tokens: [cover, buried]});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    for ( let i = 0; i < 5; i++ ) {
      bar.show(cover);
      bar.hide();
    }
    bar.show(cover);

    assert.equal(env.hud.querySelectorAll(".ctrh-bar").length, 1);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 1);
  });
});
