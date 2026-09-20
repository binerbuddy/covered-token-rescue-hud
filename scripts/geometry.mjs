/**
 * Pure geometry helpers for deciding when one token is buried under another.
 *
 * Nothing in this file touches the Foundry API or the DOM, so it can be unit
 * tested in plain Node.
 *
 * @module geometry
 */

/**
 * An axis-aligned rectangle in canvas pixel space.
 *
 * @typedef {object} Rect
 * @property {number} x       Left edge, in canvas pixels.
 * @property {number} y       Top edge, in canvas pixels.
 * @property {number} width   Width in canvas pixels. Never negative for a valid rect.
 * @property {number} height  Height in canvas pixels. Never negative for a valid rect.
 */

/**
 * Test whether a value is a usable, finite rectangle with positive area.
 *
 * @param {Rect} rect  The rectangle to test.
 * @returns {boolean}  True when every field is a finite number and both
 *                     width and height are greater than zero.
 */
export function isValidRect(rect) {
  if ( !rect || (typeof rect !== "object") ) return false;
  const {x, y, width, height} = rect;
  if ( ![x, y, width, height].every(Number.isFinite) ) return false;
  return (width > 0) && (height > 0);
}

/**
 * Shrink a rectangle towards its centre by a proportional inset.
 *
 * Used to approximate the inscribed area of a hexagonal token, whose bounding
 * box substantially overstates the space the token actually occupies.
 *
 * @param {Rect} rect      The rectangle to shrink.
 * @param {number} inset   Fraction to remove from each side. Values outside
 *                         [0, 0.5] are clamped into it, so the result never has
 *                         a negative size. An inset of 0.2 keeps the middle 60%,
 *                         and an inset of 0.5 collapses the rectangle to zero
 *                         area, which downstream reads as "never covered".
 * @returns {Rect}         A new rectangle. The argument is not modified.
 */
export function insetRect(rect, inset) {
  if ( !isValidRect(rect) ) return {x: rect?.x ?? 0, y: rect?.y ?? 0, width: 0, height: 0};
  const clamped = Math.min(Math.max(inset, 0), 0.5);
  const dx = rect.width * clamped;
  const dy = rect.height * clamped;
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: Math.max(rect.width - (2 * dx), 0),
    height: Math.max(rect.height - (2 * dy), 0)
  };
}

/**
 * Compute the area of the overlap between two rectangles.
 *
 * @param {Rect} a  The first rectangle.
 * @param {Rect} b  The second rectangle.
 * @returns {number}  The overlapping area in square canvas pixels. Zero when
 *                    the rectangles merely touch, do not meet, or either one is
 *                    degenerate.
 */
export function intersectionArea(a, b) {
  if ( !isValidRect(a) || !isValidRect(b) ) return 0;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if ( (overlapX <= 0) || (overlapY <= 0) ) return 0;
  return overlapX * overlapY;
}

/**
 * Compute how much of one rectangle is hidden beneath another.
 *
 * @param {Rect} target  The rectangle that may be buried.
 * @param {Rect} cover   The rectangle that may be burying it.
 * @returns {number}     The fraction of `target` that `cover` overlaps, in the
 *                       range [0, 1]. Returns 0 when either rectangle is
 *                       degenerate, so a zero-sized token is never reported as
 *                       covered.
 */
export function coverageRatio(target, cover) {
  if ( !isValidRect(target) ) return 0;
  const area = target.width * target.height;
  if ( area <= 0 ) return 0;
  return Math.min(intersectionArea(target, cover) / area, 1);
}

/**
 * Decide whether a token is buried deeply enough to be worth rescuing.
 *
 * @param {Rect} target        Bounds of the token that may need rescuing.
 * @param {Rect} cover         Bounds of the hovered token on top of it.
 * @param {number} threshold   The minimum fraction of `target` that must be
 *                             covered, in the range (0, 1]. A threshold of 1
 *                             requires total containment.
 * @returns {boolean}          True when the covered fraction meets or exceeds
 *                             the threshold.
 */
export function isCovered(target, cover, threshold) {
  if ( !Number.isFinite(threshold) || (threshold <= 0) ) return false;
  const ratio = coverageRatio(target, cover);
  if ( ratio <= 0 ) return false;
  // Tolerate floating point drift so that an exactly-contained token still
  // satisfies a threshold of 1.
  return ratio >= (Math.min(threshold, 1) - 1e-9);
}

/**
 * Case- and locale-aware comparator for sorting tokens by display name.
 *
 * Tokens without a name sort after named tokens rather than throwing.
 *
 * @param {string} a  The first name.
 * @param {string} b  The second name.
 * @returns {number}  Negative when `a` sorts first, positive when `b` does,
 *                    zero when the two are equivalent.
 */
export function compareNames(a, b) {
  const left = typeof a === "string" ? a : "";
  const right = typeof b === "string" ? b : "";
  if ( !left && !right ) return 0;
  if ( !left ) return 1;
  if ( !right ) return -1;
  // `game?.` would still throw a ReferenceError if the identifier were never
  // declared, which is the case outside a running Foundry client.
  const lang = globalThis.game?.i18n?.lang ?? undefined;
  return left.localeCompare(right, lang, {numeric: true, sensitivity: "base"});
}
