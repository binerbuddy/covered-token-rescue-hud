/**
 * The limited player: someone who owns exactly one token and cannot select
 * anything else on the canvas.
 *
 * When other tokens pile on top of theirs, clicking the canvas is useless to
 * them, because the click lands on a token they have no control over. The bar
 * is their only way back to their own token, so these tests cover that route
 * end to end and the ordering that makes it findable.
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
 * A pile of same-size tokens sharing one square, the shape a party makes when
 * several players drop onto the same space. Only "mine" belongs to this user.
 *
 * @returns {object[]}  The tokens, in canvas order.
 */
function pile() {
  return [
    makeToken({id: "top", name: "Bob's Fighter", x: 0, y: 0, isOwner: false}),
    makeToken({id: "zara", name: "Zara's Wizard", x: 0, y: 0, isOwner: false}),
    makeToken({id: "mine", name: "My Rogue", x: 0, y: 0, isOwner: true}),
    makeToken({id: "cara", name: "Cara's Cleric", x: 0, y: 0, isOwner: false})
  ];
}

afterEach(() => {
  env?.cleanup();
  env = null;
});

describe("selecting your own token out of a pile", () => {
  beforeEach(() => {
    invalidateConfig?.();
  });

  test("the bar appears when a player hovers a token they do not own", async () => {
    const tokens = pile();
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    assert.equal(globalThis.game.user.isGM, false, "this user must not be a GM");

    const bar = new RescueBar();
    bar.show(tokens[0]);

    const buttons = [...env.hud.querySelectorAll("button.ctrh-token")];
    assert.equal(buttons.length, 3, "every other token in the pile is listed");
    assert.ok(buttons.some(b => b.dataset.tokenId === "mine"));
  });

  test("your own token leads, whatever its name sorts as", async () => {
    const tokens = pile();
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(tokens[0]);

    const order = [...env.hud.querySelectorAll("button.ctrh-token")]
      .map(b => b.dataset.tokenId);
    // "Cara" sorts before "My Rogue", but ownership wins.
    assert.deepEqual(order, ["mine", "cara", "zara"]);
  });

  test("tokens you own are still sorted among themselves by name", async () => {
    const anchor = makeToken({id: "top", name: "Bob's Fighter", x: 0, y: 0, isOwner: false});
    const tokens = [
      anchor,
      makeToken({id: "sidekick", name: "Sidekick", x: 0, y: 0, isOwner: true}),
      makeToken({id: "familiar", name: "Familiar", x: 0, y: 0, isOwner: true}),
      makeToken({id: "stranger", name: "Aardvark", x: 0, y: 0, isOwner: false})
    ];
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(anchor);

    const order = [...env.hud.querySelectorAll("button.ctrh-token")]
      .map(b => b.dataset.tokenId);
    assert.deepEqual(order, ["familiar", "sidekick", "stranger"]);
  });

  test("clicking your own portrait selects it and releases nothing else", async () => {
    const tokens = pile();
    const mine = tokens.find(t => t.id === "mine");
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(tokens[0]);
    env.hud.querySelector('button[data-token-id="mine"]')
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));

    assert.deepEqual(mine.calls.control, [{releaseOthers: true}]);
  });

  test("clicking a token you do not own does nothing", async () => {
    const tokens = pile();
    const cara = tokens.find(t => t.id === "cara");
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(tokens[0]);
    env.hud.querySelector('button[data-token-id="cara"]')
      .dispatchEvent(new env.window.MouseEvent("click", {bubbles: true}));

    assert.deepEqual(cara.calls.control, [], "a player cannot control it");
    assert.equal(cara.controlled, false);
  });

  test("gaining ownership moves a token to the front of the bar", async () => {
    const tokens = pile();
    const zara = tokens.find(t => t.id === "zara");
    env = installFoundry({tokens});
    await load();
    invalidateConfig();

    const bar = new RescueBar();
    bar.show(tokens[0]);
    assert.deepEqual(
      [...env.hud.querySelectorAll("button.ctrh-token")].map(b => b.dataset.tokenId),
      ["mine", "cara", "zara"]
    );

    zara.isOwner = true;
    bar.show(tokens[0]);

    assert.deepEqual(
      [...env.hud.querySelectorAll("button.ctrh-token")].map(b => b.dataset.tokenId),
      ["mine", "zara", "cara"],
      "the line-up must re-sort rather than reuse the cached order"
    );
  });
});
