/**
 * Client setting registration and typed accessors.
 * @module settings
 */

import {MODULE_ID, PLACEMENT, SETTINGS} from "./constants.mjs";

/**
 * Register every setting this module exposes.
 *
 * All settings are client scoped: whether a buried token is worth surfacing is
 * a matter of personal preference and screen size, not table rules.
 *
 * @param {() => void} onChange  Invoked after any setting changes so the active
 *                              bar can be rebuilt with the new configuration.
 * @returns {void}
 */
export function registerSettings(onChange) {
  const register = (key, data) => game.settings.register(MODULE_ID, key, {
    scope: "client",
    config: true,
    onChange: () => {
      invalidateConfig();
      onChange();
    },
    ...data
  });

  register(SETTINGS.ENABLED, {
    name: "CTRH.Settings.Enabled.Name",
    hint: "CTRH.Settings.Enabled.Hint",
    type: Boolean,
    default: true
  });

  register(SETTINGS.THRESHOLD, {
    name: "CTRH.Settings.Threshold.Name",
    hint: "CTRH.Settings.Threshold.Hint",
    type: Number,
    range: {min: 0.25, max: 1, step: 0.05},
    default: 0.75
  });

  register(SETTINGS.ICON_SIZE, {
    name: "CTRH.Settings.IconSize.Name",
    hint: "CTRH.Settings.IconSize.Hint",
    type: Number,
    range: {min: 16, max: 128, step: 4},
    default: 48
  });

  register(SETTINGS.SCALE_WITH_ZOOM, {
    name: "CTRH.Settings.ScaleWithZoom.Name",
    hint: "CTRH.Settings.ScaleWithZoom.Hint",
    type: Boolean,
    default: false
  });

  register(SETTINGS.SHOW_UNOWNED, {
    name: "CTRH.Settings.ShowUnowned.Name",
    hint: "CTRH.Settings.ShowUnowned.Hint",
    type: Boolean,
    default: true
  });

  register(SETTINGS.HIGHLIGHT, {
    name: "CTRH.Settings.Highlight.Name",
    hint: "CTRH.Settings.Highlight.Hint",
    type: Boolean,
    default: true
  });

  register(SETTINGS.PLACEMENT, {
    name: "CTRH.Settings.Placement.Name",
    hint: "CTRH.Settings.Placement.Hint",
    type: String,
    default: PLACEMENT.AUTO,
    choices: {
      [PLACEMENT.AUTO]: "CTRH.Settings.Placement.Auto",
      [PLACEMENT.BELOW]: "CTRH.Settings.Placement.Below",
      [PLACEMENT.ABOVE]: "CTRH.Settings.Placement.Above"
    }
  });
}

/**
 * Read a single setting, falling back to the registered default when the
 * settings system is not yet available.
 *
 * @param {string} key          One of the {@link SETTINGS} keys.
 * @param {*} [fallback=null]   Value to return when the setting cannot be read.
 * @returns {*}                 The stored value, or `fallback`.
 */
export function getSetting(key, fallback = null) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return fallback;
  }
}

/**
 * The most recent settings snapshot, or null when it needs rebuilding.
 * @type {object|null}
 */
let cachedConfig = null;

/**
 * Discard the cached settings snapshot so the next read repopulates it.
 * @returns {void}
 */
export function invalidateConfig() {
  cachedConfig = null;
}

/**
 * Snapshot every setting in one object, for code paths that need several at
 * once without repeated lookups.
 *
 * The result is cached because it is read on every animation frame while the
 * bar tracks a moving token. {@link invalidateConfig} clears it whenever a
 * setting changes.
 *
 * @returns {{enabled: boolean, threshold: number, iconSize: number,
 *            scaleWithZoom: boolean, showUnowned: boolean,
 *            highlight: boolean, placement: string}}
 */
export function readConfig() {
  if ( cachedConfig ) return cachedConfig;
  const snapshot = {
    enabled: getSetting(SETTINGS.ENABLED, true),
    threshold: getSetting(SETTINGS.THRESHOLD, 0.75),
    iconSize: getSetting(SETTINGS.ICON_SIZE, 48),
    scaleWithZoom: getSetting(SETTINGS.SCALE_WITH_ZOOM, false),
    showUnowned: getSetting(SETTINGS.SHOW_UNOWNED, true),
    highlight: getSetting(SETTINGS.HIGHLIGHT, true),
    placement: getSetting(SETTINGS.PLACEMENT, PLACEMENT.AUTO)
  };
  // Only cache once the settings system can actually answer. Caching a
  // snapshot built entirely from fallbacks would pin the defaults for the rest
  // of the session with nothing to invalidate it.
  if ( !game?.settings?.get ) return snapshot;
  cachedConfig = snapshot;
  return cachedConfig;
}
