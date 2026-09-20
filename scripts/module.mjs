/**
 * Covered Token Rescue HUD.
 *
 * Hovering a token that sits on top of others draws a small row of portraits
 * beside it, so the buried tokens can still be selected, inspected or targeted.
 *
 * @module covered-token-rescue-hud
 */

import {MODULE_ID} from "./constants.mjs";
import {RescueBar} from "./rescue-bar.mjs";
import {registerSettings} from "./settings.mjs";

/** The single bar instance shared by every scene. @type {RescueBar} */
const bar = new RescueBar();

/**
 * Whether the core token HUD is currently open. While it is, the rescue bar
 * stays out of the way rather than competing with it for the same space.
 *
 * @returns {boolean}
 */
function coreHudOpen() {
  return !!canvas?.tokens?.hud?.rendered;
}

Hooks.once("init", () => {
  registerSettings(() => bar.refreshSoon());
  game.modules.get(MODULE_ID).api = {bar};
});

Hooks.on("hoverToken", (token, hovered) => {
  if ( coreHudOpen() ) return;
  if ( hovered ) {
    // The bar is drawn over the canvas, and the canvas keeps hit testing
    // underneath it. Reaching for a portrait that happens to sit over another
    // token therefore reports that token as hovered, which would otherwise
    // re-anchor the bar to it and dismiss the very thing being reached for.
    if ( (token !== bar.anchor) && bar.containsPointer ) return;
    bar.show(token);
  }
  else if ( bar.anchor === token ) bar.scheduleHide();
});

// Token movement is animated, so the document update fires once at the start
// while the visual position keeps changing. Tracking the refresh flags keeps
// the bar pinned to the token for the whole animation.
//
// Visibility is included because a token revealed underneath the hovered one
// becomes rescuable at that moment, and nothing else would tell us.
// refreshSoon() is cheap when no token is hovered, so it needs no guard here.
Hooks.on("refreshToken", (token, flags) => {
  if ( !flags?.refreshPosition && !flags?.refreshSize && !flags?.refreshVisibility ) return;
  if ( token === bar.anchor ) bar.reposition();
  bar.refreshSoon();
});

Hooks.on("controlToken", () => {
  bar.refreshStates();
  // Controlling a token forces it visible, which can change what is rescuable.
  bar.refreshSoon();
});
Hooks.on("targetToken", () => bar.refreshStates());

Hooks.on("createToken", () => bar.refreshSoon());
Hooks.on("deleteToken", token => {
  if ( bar.anchor?.id === token.id ) bar.hide();
  else bar.refreshSoon();
});

Hooks.on("renderTokenHUD", () => bar.hide());
Hooks.on("canvasPan", () => bar.reposition());
Hooks.on("canvasReady", () => bar.hide());
Hooks.on("canvasTearDown", () => bar.destroy());
