/**
 * Shared identifiers for the module.
 * @module constants
 */

/** The module id, matching the `id` field of module.json. @type {string} */
export const MODULE_ID = "covered-token-rescue-hud";

/** Setting keys registered by this module. @enum {string} */
export const SETTINGS = {
  ENABLED: "enabled",
  THRESHOLD: "coverageThreshold",
  ICON_SIZE: "iconSize",
  SCALE_WITH_ZOOM: "scaleWithZoom",
  SHOW_UNOWNED: "showUnowned",
  PLACEMENT: "placement",
  HIGHLIGHT: "highlightOnHover",
  RAISE_ON_SELECT: "raiseOnSelect"
};

/** Where the rescue bar is drawn relative to the hovered token. @enum {string} */
export const PLACEMENT = {
  BELOW: "below",
  ABOVE: "above",
  AUTO: "auto"
};

/** Milliseconds the bar lingers after the pointer leaves the hovered token. @type {number} */
export const HIDE_DELAY_MS = 180;
