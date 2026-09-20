/**
 * Tests for the module entry point: are the hooks registered, and do they
 * drive the bar correctly?
 *
 * `scripts/module.mjs` registers its hooks at import time and ES modules are
 * cached, so this file imports it exactly once and inspects the registry that
 * the stubbed `Hooks` global collected.
 */

import {test, describe, before, after} from "node:test";
import assert from "node:assert/strict";

import {installFoundry, makeToken} from "./helpers/foundry-stub.mjs";

/** Hook name to registered callbacks. @type {Map<string, Function[]>} */
const registry = new Map();

/** Settings registered by the module. @type {Map<string, object>} */
const registered = new Map();

let env;
let cover;
let buried;

/**
 * Invoke every callback registered for a hook.
 * @param {string} name  The hook name.
 * @param {...*} args    Hook arguments.
 */
function fire(name, ...args) {
  for ( const fn of registry.get(name) ?? [] ) fn(...args);
}

before(async () => {
  cover = makeToken({id: "cover", name: "Dragon", x: 0, y: 0, width: 200, height: 200});
  buried = makeToken({id: "buried", name: "Paladin", x: 50, y: 50, width: 100, height: 100});
  env = installFoundry({tokens: [cover, buried]});

  globalThis.Hooks = {
    on(name, fn) {
      if ( !registry.has(name) ) registry.set(name, []);
      registry.get(name).push(fn);
    },
    once(name, fn) {
      this.on(name, fn);
    },
    callAll() {}
  };
  globalThis.game.modules = {get: () => ({})};
  globalThis.game.settings.register = (_module, key, data) => registered.set(key, data);

  await import("../scripts/module.mjs");
  fire("init");
});

after(() => {
  env?.cleanup();
  delete globalThis.Hooks;
});

describe("module registration", () => {
  test("registers every hook the bar depends on", () => {
    for ( const name of [
      "hoverToken", "refreshToken", "controlToken", "targetToken",
      "createToken", "deleteToken", "renderTokenHUD",
      "canvasPan", "canvasReady", "canvasTearDown"
    ] ) {
      assert.ok(registry.has(name), `${name} should be registered`);
    }
  });

  test("registers all eight settings with defaults", () => {
    assert.equal(registered.size, 8);
    assert.ok(registered.has("raiseOnSelect"), "the raise setting must be registered");
    assert.equal(registered.get("raiseOnSelect").default, true,
      "selecting a token you cannot then reach is the surprising behaviour");
    for ( const [key, data] of registered ) {
      assert.equal(data.scope, "client", `${key} should be client scoped`);
      assert.notEqual(data.default, undefined, `${key} needs a default`);
      assert.ok(data.name?.startsWith("CTRH."), `${key} needs a localized name`);
    }
  });
});

describe("hook behaviour", () => {
  test("hovering a covering token shows the bar", () => {
    fire("hoverToken", cover, true);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 1);
  });

  test("opening the core token HUD dismisses the bar", () => {
    fire("hoverToken", cover, true);
    fire("renderTokenHUD", {}, env.hud, {});
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
  });

  test("the bar does not appear while the core token HUD is open", () => {
    env.hudCalls.rendered = true;
    fire("hoverToken", cover, true);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
    env.hudCalls.rendered = false;
  });

  test("deleting the anchor token removes the bar", () => {
    fire("hoverToken", cover, true);
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 1);
    fire("deleteToken", {id: "cover"});
    assert.equal(env.hud.querySelectorAll("button.ctrh-token").length, 0);
  });

  test("a token moving repositions the bar rather than rebuilding it", () => {
    fire("hoverToken", cover, true);
    const before = env.hud.querySelector("button.ctrh-token");
    const top = env.hud.querySelector(".ctrh-bar").style.top;

    cover.bounds = {x: 0, y: 400, width: 200, height: 200};
    fire("refreshToken", cover, {refreshPosition: true});

    const element = env.hud.querySelector(".ctrh-bar");
    assert.notEqual(element.style.top, top, "the bar should follow the token");
    assert.equal(env.hud.querySelector("button.ctrh-token"), before, "without rebuilding");
    cover.bounds = {x: 0, y: 0, width: 200, height: 200};
  });

  test("a refresh with no position or size change is ignored", () => {
    fire("hoverToken", cover, true);
    const top = env.hud.querySelector(".ctrh-bar").style.top;
    cover.bounds = {x: 0, y: 800, width: 200, height: 200};
    fire("refreshToken", cover, {refreshBorder: true});
    assert.equal(env.hud.querySelector(".ctrh-bar").style.top, top);
    cover.bounds = {x: 0, y: 0, width: 200, height: 200};
  });

  test("tearing down the canvas leaves nothing behind", () => {
    fire("hoverToken", cover, true);
    fire("canvasTearDown");
    assert.equal(env.hud.querySelectorAll(".ctrh-layer").length, 0);
    assert.equal(env.hud.innerHTML, "");
  });
});
