/**
 * The on-canvas bar of covered-token portraits.
 *
 * The bar lives inside Foundry's canvas HUD layer (`#hud`), which the core
 * software sizes to the scene and transforms to match the current pan and zoom.
 * Anything positioned inside it therefore uses scene pixel coordinates, the
 * same space that `Token#bounds` reports.
 *
 * @module rescue-bar
 */

import {HIDE_DELAY_MS, MODULE_ID, PLACEMENT} from "./constants.mjs";
import {compareNames, insetRect, isCovered} from "./geometry.mjs";
import {readConfig} from "./settings.mjs";

/** File extensions Foundry treats as video textures. @type {ReadonlySet<string>} */
const VIDEO_EXTENSIONS = new Set(["webm", "mp4", "m4v", "ogv"]);

/** Fraction trimmed from each side of a hex token's bounding box. @type {number} */
const HEX_INSET = 0.125;

/**
 * How far coverage may fall below the threshold before an already-listed token
 * is dropped. Without this, a token drifting across the threshold during a
 * movement animation would add and remove its own portrait every frame.
 * @type {number}
 */
const HYSTERESIS = 0.05;

/** Fraction of the viewport width the bar may occupy before wrapping. @type {number} */
const MAX_WIDTH_FRACTION = 0.6;

/**
 * Determine whether a texture path points at a video rather than an image.
 *
 * @param {string} src  The texture path, which may carry a query string.
 * @returns {boolean}   True when the extension is a known video format.
 */
export function isVideoSource(src) {
  if ( typeof src !== "string" ) return false;
  const withoutQuery = src.split("?")[0].split("#")[0];
  const extension = withoutQuery.split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.has(extension);
}

/**
 * Choose the artwork to show for a token, preferring the dynamic ring subject
 * texture when one is configured.
 *
 * @param {Token} token  The token to portray.
 * @returns {string}     A texture path, or an empty string when none is set.
 */
export function portraitSource(token) {
  const doc = token?.document;
  if ( !doc ) return "";
  // Foundry models this as a boolean field, so the strict comparison is
  // defensive rather than load bearing.
  const ringSubject = doc.ring?.enabled === true ? doc.ring?.subject?.texture : null;
  return ringSubject || doc.texture?.src || doc.actor?.img || "";
}

/**
 * Convert a token's live bounds into a plain rectangle, applying the hex inset
 * when the scene uses a hexagonal grid.
 *
 * `Token#bounds` follows the document position, which Foundry updates as a
 * movement animation plays, so this reflects where the token is right now
 * rather than where it started.
 *
 * @param {Token} token  The token to measure.
 * @returns {import("./geometry.mjs").Rect}  The token's rectangle in scene pixels.
 */
export function tokenRect(token) {
  const {x, y, width, height} = token.bounds;
  const rect = {x, y, width, height};
  return canvas?.grid?.isHexagonal ? insetRect(rect, HEX_INSET) : rect;
}

/**
 * Build a string that changes whenever anything the bar draws for a token
 * changes. Comparing these detects a renamed token, new artwork or a change of
 * ownership, none of which alter the list of token ids.
 *
 * @param {Token} token  The token to describe.
 * @returns {string}     An opaque signature.
 */
function tokenSignature(token) {
  return [
    token.id,
    portraitSource(token),
    token.document?.name ?? "",
    token.isOwner ? "1" : "0",
    token.visible ? "1" : "0"
  ].join("\u0000");
}

/**
 * Project a point from scene coordinates into screen coordinates.
 *
 * @param {number} x  Scene x.
 * @param {number} y  Scene y.
 * @returns {{x: number, y: number}}  The same point in screen pixels.
 */
function toScreen(x, y) {
  const transform = canvas?.stage?.worldTransform;
  if ( typeof transform?.apply === "function" ) return transform.apply({x, y});
  // Foundry's stage is a plain scale plus translation, so this reproduces the
  // transform exactly when PIXI is not available, as in tests.
  const zoom = canvas?.stage?.scale?.x || 1;
  return {
    x: (x * zoom) + (canvas?.stage?.position?.x ?? 0),
    y: (y * zoom) + (canvas?.stage?.position?.y ?? 0)
  };
}

/**
 * Find every token buried beneath the given token.
 *
 * @param {Token} anchor         The hovered token doing the covering.
 * @param {object} config        A snapshot from {@link readConfig}.
 * @param {Set<string>} [sticky] Ids already on display. These are held until
 *                               their coverage falls a little below the
 *                               threshold, which stops a token on the boundary
 *                               from flickering in and out during movement.
 * @returns {Token[]}            Covered tokens, sorted by display name.
 */
export function findCoveredTokens(anchor, config, sticky) {
  if ( !anchor || !canvas?.ready ) return [];
  const coverRect = tokenRect(anchor);
  const held = Math.max(config.threshold - HYSTERESIS, Number.MIN_VALUE);
  const covered = [];
  for ( const token of canvas.tokens.placeables ) {
    if ( token === anchor ) continue;
    if ( token.isPreview ) continue;
    if ( !token.visible ) continue;
    if ( !config.showUnowned && !token.isOwner ) continue;
    const threshold = sticky?.has(token.id) ? held : config.threshold;
    if ( isCovered(tokenRect(token), coverRect, threshold) ) covered.push(token);
  }
  covered.sort((a, b) => compareNames(a.document.name, b.document.name));
  return covered;
}

/**
 * Controls the lifetime, contents and placement of the rescue bar.
 *
 * A single instance is created at module init and reused for every scene.
 *
 * The token being tracked and the content being drawn are deliberately
 * separate. A hovered token that covers nothing still holds the anchor, so
 * that a token sliding underneath it afterwards can bring the bar into being
 * without the pointer having to leave and come back.
 */
export class RescueBar {

  /** The root element inserted into the canvas HUD layer. @type {HTMLElement|null} */
  #root = null;

  /** The row of portrait buttons. @type {HTMLElement|null} */
  #bar = null;

  /** The dashed outline drawn over a token being pointed at. @type {HTMLElement|null} */
  #marker = null;

  /** The token being tracked, whether or not anything is drawn. @type {Token|null} */
  #anchor = null;

  /** Signatures of the tokens currently drawn, in display order. @type {string[]} */
  #signatures = [];

  /** Ids of the tokens currently drawn. @type {Set<string>} */
  #shown = new Set();

  /** Pending hide timeout handle. @type {number|null} */
  #hideTimer = null;

  /** True while the pointer rests on the bar itself. @type {boolean} */
  #pointerInside = false;

  /** Pending animation frame handle for a coalesced rebuild. @type {number|null} */
  #frame = null;

  /** The token the bar is presently tracking. @type {Token|null} */
  get anchor() {
    return this.#anchor;
  }

  /** Whether the bar is currently on screen. @type {boolean} */
  get visible() {
    return !!this.#root?.isConnected && (this.#shown.size > 0);
  }

  /* -------------------------------------------- */
  /*  Lifecycle                                   */
  /* -------------------------------------------- */

  /**
   * Ensure the root and bar elements exist and are attached to the canvas HUD
   * layer.
   *
   * The HUD container rewrites its own `innerHTML` whenever it re-renders,
   * which silently detaches anything a module injected, so the connection is
   * re-checked on every use rather than assumed.
   *
   * @returns {HTMLElement|null}  The attached root, or null if the HUD layer is
   *                              not available yet.
   */
  #ensureRoot() {
    // canvas.hud is the documented accessor; the id lookup is a fallback in
    // case a future release renames the property but keeps the element.
    const hud = canvas?.hud?.element ?? document.getElementById("hud");
    if ( !hud ) return null;
    if ( !this.#root ) {
      this.#root = document.createElement("div");
      this.#root.id = `${MODULE_ID}-layer`;
      this.#root.classList.add("ctrh-layer");
    }
    if ( !this.#bar ) {
      // The bar element is created once and only ever has its children
      // swapped. Replacing the element itself would fire a pointerleave as the
      // old node is removed from under the cursor, dismissing the bar just as
      // the user reaches for it.
      this.#bar = document.createElement("div");
      this.#bar.classList.add("ctrh-bar");
      this.#bar.addEventListener("pointerenter", () => {
        this.#pointerInside = true;
        this.#cancelHide();
      });
      this.#bar.addEventListener("pointerleave", () => {
        this.#pointerInside = false;
        this.#clearMarker();
        this.scheduleHide();
      });
    }
    if ( this.#bar.parentElement !== this.#root ) this.#root.appendChild(this.#bar);
    if ( this.#root.parentElement !== hud ) hud.appendChild(this.#root);
    return this.#root;
  }

  /**
   * Take the bar off screen while continuing to track the hovered token, so
   * that a token moving underneath it can bring the bar back.
   *
   * @returns {void}
   */
  #clearContent() {
    this.#clearMarker();
    this.#releaseVideos();
    this.#signatures = [];
    this.#shown.clear();
    this.#bar?.replaceChildren();
    this.#root?.remove();
  }

  /**
   * Stop and detach any video portraits so their decoders are released rather
   * than left running on an element no longer in the document.
   *
   * @returns {void}
   */
  #releaseVideos() {
    for ( const video of this.#bar?.querySelectorAll("video") ?? [] ) {
      // Media methods are stubs outside a real browser, so failing to stop
      // playback must not abort the rebuild.
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        video.removeAttribute("src");
      }
    }
  }

  /**
   * Remove the bar and stop tracking its token entirely.
   *
   * @returns {void}
   */
  hide() {
    this.#cancelHide();
    this.#clearContent();
    this.#anchor = null;
    this.#pointerInside = false;
  }

  /**
   * Tear down all state, including the cached elements. Called when the canvas
   * is torn down between scenes.
   *
   * @returns {void}
   */
  destroy() {
    this.hide();
    if ( this.#frame !== null ) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#marker = null;
    this.#bar = null;
    this.#root = null;
  }

  /**
   * Begin the grace period before hiding, giving the pointer time to travel
   * from the token to the bar without the bar vanishing underneath it.
   *
   * @returns {void}
   */
  scheduleHide() {
    this.#cancelHide();
    this.#hideTimer = window.setTimeout(() => {
      this.#hideTimer = null;
      // Re-arm rather than give up. Dropping the timer here would leave a
      // pointerleave on the bar as the only remaining way to dismiss it.
      if ( this.#pointerInside ) this.scheduleHide();
      else this.hide();
    }, HIDE_DELAY_MS);
  }

  /**
   * Cancel a pending hide.
   * @returns {void}
   */
  #cancelHide() {
    if ( this.#hideTimer !== null ) window.clearTimeout(this.#hideTimer);
    this.#hideTimer = null;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Track a token and draw the bar for whatever is buried underneath it.
   *
   * When nothing is buried the content is cleared but the token stays tracked,
   * so the bar can appear later if something moves under it.
   *
   * @param {Token} anchor  The hovered token.
   * @returns {void}
   */
  show(anchor) {
    const config = readConfig();
    if ( !config.enabled || !anchor || anchor.destroyed ) return this.hide();
    if ( anchor.scene && canvas?.scene && (anchor.scene !== canvas.scene) ) return this.hide();

    this.#anchor = anchor;

    const covered = findCoveredTokens(anchor, config, this.#shown);
    if ( !covered.length ) return this.#clearContent();

    const signatures = covered.map(tokenSignature);
    const unchanged = !!this.#root?.isConnected
      && (signatures.length === this.#signatures.length)
      && signatures.every((s, i) => s === this.#signatures[i]);

    // Rebuilding the DOM every frame of a movement animation would restart
    // videos and drop the pointer's hover state, so an unchanged line-up is
    // only repositioned.
    if ( unchanged ) {
      this.reposition();
      this.refreshStates();
      return;
    }

    // Commit nothing until the HUD layer is known to be available, so that
    // `anchor` and `visible` cannot disagree about what is on screen.
    const root = this.#ensureRoot();
    if ( !root ) return this.#clearContent();

    this.#clearMarker();
    this.#releaseVideos();
    this.#signatures = signatures;
    this.#shown = new Set(covered.map(t => t.id));
    this.#bar.replaceChildren(...covered.map(token => this.#buildButton(token)));
    this.reposition();
  }

  /**
   * Rebuild on the next animation frame, collapsing bursts of hook activity
   * into a single update.
   *
   * @returns {void}
   */
  refreshSoon() {
    const target = this.#anchor ?? canvas?.tokens?.hover ?? null;
    if ( !target ) return;
    if ( this.#frame !== null ) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      const anchor = this.#anchor ?? canvas?.tokens?.hover ?? null;
      if ( !anchor ) return;
      if ( anchor.destroyed ) return this.hide();
      this.show(anchor);
    });
  }

  /**
   * Update the selection, targeting and ownership outlines without rebuilding
   * the bar.
   *
   * @returns {void}
   */
  refreshStates() {
    if ( !this.#bar ) return;
    for ( const button of this.#bar.querySelectorAll("[data-token-id]") ) {
      const token = canvas?.tokens?.get(button.dataset.tokenId);
      button.classList.toggle("controlled", !!token?.controlled);
      button.classList.toggle("targeted", !!token?.isTargeted);
      button.classList.toggle("unowned", !token?.isOwner);
    }
  }

  /**
   * Build a single portrait button.
   *
   * The name is written to `data-tooltip-text`, which Foundry renders as plain
   * text, so a token named with markup cannot inject HTML into the tooltip.
   *
   * @param {Token} token    The token this button selects.
   * @returns {HTMLElement}  The detached button element.
   */
  #buildButton(token) {
    const id = token.id;
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("ctrh-token");
    button.dataset.tokenId = id;
    button.classList.toggle("controlled", token.controlled);
    button.classList.toggle("targeted", token.isTargeted);
    button.classList.toggle("unowned", !token.isOwner);

    const name = token.isOwner || game.user.isGM ? token.document.name : "";
    if ( name ) {
      button.dataset.tooltipText = name;
      button.setAttribute("aria-label", name);
    } else {
      button.setAttribute("aria-label", game.i18n.localize("CTRH.UnknownToken"));
    }

    const src = portraitSource(token);
    const media = isVideoSource(src) ? document.createElement("video") : document.createElement("img");
    media.classList.add("ctrh-portrait");
    if ( media instanceof HTMLVideoElement ) {
      media.muted = true;
      media.loop = true;
      media.autoplay = true;
      media.playsInline = true;
      media.disablePictureInPicture = true;
    } else {
      media.alt = "";
    }
    if ( src ) media.src = src;
    button.appendChild(media);

    // Handlers resolve the placeable by id rather than closing over it, so a
    // layer redraw that replaces the Token object cannot leave the button
    // holding a destroyed one.
    button.addEventListener("click", event => this.#onClick(event, id));
    button.addEventListener("contextmenu", event => this.#onContextMenu(event, id));
    button.addEventListener("pointerenter", () => {
      if ( readConfig().highlight ) this.#drawMarker(id);
    });
    button.addEventListener("pointerleave", () => this.#clearMarker());
    return button;
  }

  /* -------------------------------------------- */
  /*  Placement                                   */
  /* -------------------------------------------- */

  /**
   * Position the bar against its anchor token, apply the zoom compensation
   * that keeps portraits a constant size on screen, and decide whether the bar
   * fits below the token or has to go above it.
   *
   * The fit test is done in screen space. The scene can be far taller than the
   * window, so comparing against the scene height would place the bar off the
   * bottom of the viewport while still being well inside the scene.
   *
   * @returns {void}
   */
  reposition() {
    if ( !this.#bar || !this.#anchor || this.#anchor.destroyed ) return;
    if ( !this.#shown.size ) return;
    const config = readConfig();
    const bounds = this.#anchor.bounds;
    const zoom = canvas?.stage?.scale?.x || 1;
    const scale = config.scaleWithZoom ? 1 : (1 / zoom);
    const gap = 6 * scale;
    const estimatedHeight = (config.iconSize + 12) * scale;

    let above = config.placement === PLACEMENT.ABOVE;
    if ( config.placement === PLACEMENT.AUTO ) {
      const viewport = globalThis.window?.innerHeight ?? Number.POSITIVE_INFINITY;
      const top = toScreen(bounds.x, bounds.y).y;
      const bottom = toScreen(bounds.x, bounds.y + bounds.height).y;
      const needed = (gap + estimatedHeight) * zoom;
      const fitsBelow = (bottom + needed) <= viewport;
      const fitsAbove = (top - needed) >= 0;
      above = !fitsBelow && fitsAbove;
    }

    // Cap the bar at a fraction of the viewport. The on-screen width is the
    // layout width times this element's scale times the HUD layer's zoom, so
    // the layout cap has to divide both back out.
    const viewportWidth = globalThis.window?.innerWidth ?? 0;
    const maxWidth = viewportWidth
      ? `${(viewportWidth * MAX_WIDTH_FRACTION) / (scale * zoom)}px`
      : "none";

    const style = this.#bar.style;
    style.setProperty("--ctrh-icon-size", `${config.iconSize}px`);
    style.setProperty("--ctrh-scale", String(scale));
    style.setProperty("--ctrh-max-width", maxWidth);
    style.left = `${bounds.x + (bounds.width / 2)}px`;
    if ( above ) {
      style.top = `${bounds.y - gap}px`;
      style.transform = `translate(-50%, -100%) scale(${scale})`;
      style.transformOrigin = "bottom center";
    } else {
      style.top = `${bounds.y + bounds.height + gap}px`;
      style.transform = `translate(-50%, 0) scale(${scale})`;
      style.transformOrigin = "top center";
    }
  }

  /* -------------------------------------------- */
  /*  Canvas marker                               */
  /* -------------------------------------------- */

  /**
   * Draw a dashed outline over a token so the player can see which one a
   * portrait refers to.
   *
   * @param {string} tokenId  The id of the token to outline.
   * @returns {void}
   */
  #drawMarker(tokenId) {
    const token = canvas?.tokens?.get(tokenId);
    const root = this.#ensureRoot();
    if ( !root || !token || token.destroyed ) return;
    if ( !this.#marker ) {
      this.#marker = document.createElement("div");
      this.#marker.classList.add("ctrh-marker");
    }
    const {x, y, width, height} = token.bounds;
    const zoom = canvas?.stage?.scale?.x || 1;
    Object.assign(this.#marker.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      borderWidth: `${2 / zoom}px`
    });
    root.appendChild(this.#marker);
  }

  /**
   * Remove the dashed outline if one is showing.
   * @returns {void}
   */
  #clearMarker() {
    this.#marker?.remove();
  }

  /* -------------------------------------------- */
  /*  Interaction                                 */
  /* -------------------------------------------- */

  /**
   * Select the token a portrait represents. Holding shift adds it to the
   * current selection instead of replacing it.
   *
   * @param {PointerEvent} event  The originating click.
   * @param {string} tokenId      The id of the token to control.
   * @returns {void}
   */
  #onClick(event, tokenId) {
    event.preventDefault();
    event.stopPropagation();
    const token = canvas?.tokens?.get(tokenId);
    if ( !token || token.destroyed ) return this.refreshSoon();
    if ( !token.isOwner ) return;
    token.control({releaseOthers: !event.shiftKey});
    this.refreshStates();
  }

  /**
   * Right click opens the core token HUD for a token you own, and toggles
   * targeting for one you do not.
   *
   * @param {PointerEvent} event  The originating right click.
   * @param {string} tokenId      The id of the token acted upon.
   * @returns {void}
   */
  #onContextMenu(event, tokenId) {
    event.preventDefault();
    event.stopPropagation();
    const token = canvas?.tokens?.get(tokenId);
    if ( !token || token.destroyed ) return this.refreshSoon();

    if ( !token.isOwner ) {
      token.setTarget(!token.isTargeted, {releaseOthers: false});
      this.refreshStates();
      return;
    }

    const hud = canvas.tokens.hud;
    // bind() is async and rejects if the token is not on the viewed scene,
    // which would otherwise surface as an unhandled rejection.
    token.control({releaseOthers: !event.shiftKey});
    Promise.resolve(hud.bind(token)).catch(error => console.error(`${MODULE_ID} |`, error));
  }
}
