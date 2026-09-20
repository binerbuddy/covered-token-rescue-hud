/**
 * Minimal stand-ins for the Foundry globals the rescue bar touches, backed by
 * a jsdom document. Enough to exercise rendering and interaction without a
 * running Foundry instance.
 *
 * @module test/helpers/foundry-stub
 */

import {JSDOM} from "jsdom";

/**
 * Build a fake Token good enough for the rescue bar.
 *
 * @param {object} options
 * @param {string} options.id            Token id.
 * @param {string} options.name          Display name.
 * @param {number} options.x             Left edge in scene pixels.
 * @param {number} options.y             Top edge in scene pixels.
 * @param {number} [options.width=100]   Width in scene pixels.
 * @param {number} [options.height=100]  Height in scene pixels.
 * @param {string} [options.src]         Texture path.
 * @param {boolean} [options.isOwner]    Whether the current user owns it.
 * @param {boolean} [options.visible]    Whether it is rendered.
 * @param {boolean} [options.controlled] Whether it is selected.
 * @param {boolean} [options.isTargeted] Whether it is targeted.
 * @param {number} [options.displayName] A CONST.TOKEN_DISPLAY_MODES value.
 *                                       Foundry's own default is NONE.
 * @returns {object}                     The fake token.
 */
export function makeToken({
  id, name, x, y, width = 100, height = 100, src = "tokens/goblin.webp",
  isOwner = true, visible = true, controlled = false, isTargeted = false,
  displayName = 0
}) {
  const token = {
    id,
    bounds: {x, y, width, height},
    isPreview: false,
    destroyed: false,
    visible,
    controlled,
    isTargeted,
    isOwner,
    calls: {control: [], setTarget: []},
    document: {name, texture: {src}, ring: {enabled: false}, displayName},
    control(options) {
      token.calls.control.push(options);
      token.controlled = true;
      return true;
    },
    setTarget(state, options) {
      token.calls.setTarget.push({state, options});
      token.isTargeted = state;
    }
  };
  // installFoundry() re-points this at the shared scene object, matching real
  // Foundry where a placeable's scene IS canvas.scene.
  token.scene = null;
  return token;
}

/**
 * Install a jsdom document plus fake `canvas` and `game` globals.
 *
 * @param {object} options
 * @param {object[]} options.tokens      Tokens on the canvas.
 * @param {object} [options.settings]    Overrides for module settings.
 * @param {number} [options.zoom=1]      Canvas zoom level.
 * @param {boolean} [options.hexagonal]  Whether the grid is hexagonal.
 * @returns {{cleanup: () => void, hud: HTMLElement, hudCalls: object}}
 */
export function installFoundry({tokens, settings = {}, zoom = 1, hexagonal = false}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="hud"></div></body></html>');
  const {window} = dom;
  const hud = window.document.getElementById("hud");

  const values = {
    enabled: true,
    coverageThreshold: 0.75,
    iconSize: 48,
    scaleWithZoom: false,
    showUnowned: true,
    highlightOnHover: true,
    placement: "auto",
    ...settings
  };

  const hudCalls = {bind: [], clear: 0, rendered: false};
  const scene = {isView: true};
  for ( const token of tokens ) token.scene = scene;

  const previous = {};
  const globals = {
    window,
    document: window.document,
    HTMLVideoElement: window.HTMLVideoElement,
    requestAnimationFrame: cb => window.setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: id => window.clearTimeout(id),
    canvas: {
      ready: true,
      scene,
      dimensions: {width: 4000, height: 3000},
      stage: {scale: {x: zoom, y: zoom}, position: {x: 0, y: 0}},
      grid: {size: 100, isHexagonal: hexagonal, isSquare: !hexagonal, isGridless: false},
      hover: null,
      hud: {element: hud},
      tokens: {
        placeables: tokens,
        hover: null,
        get: id => tokens.find(t => t.id === id) ?? null,
        hud: {
          get rendered() {
            return hudCalls.rendered;
          },
          object: null,
          bind(token) {
            hudCalls.bind.push(token.id);
          },
          clear() {
            hudCalls.clear += 1;
          }
        }
      }
    },
    CONST: {
      TOKEN_DISPLAY_MODES: {NONE: 0, CONTROL: 10, OWNER_HOVER: 20, HOVER: 30, OWNER: 40, ALWAYS: 50}
    },
    game: {
      user: {isGM: false},
      i18n: {lang: "en", localize: key => key, has: () => false},
      settings: {
        get: (_module, key) => {
          if ( !(key in values) ) throw new Error(`Unregistered setting: ${key}`);
          return values[key];
        }
      }
    }
  };

  for ( const [key, value] of Object.entries(globals) ) {
    previous[key] = globalThis[key];
    globalThis[key] = value;
  }

  return {
    hud,
    hudCalls,
    settings: values,
    window,
    cleanup() {
      for ( const key of Object.keys(globals) ) globalThis[key] = previous[key];
      window.close();
    }
  };
}
