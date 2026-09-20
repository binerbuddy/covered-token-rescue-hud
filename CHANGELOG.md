# Changelog

## 2.2.0

### Changed

- **Bring the token to the front when selected** now defaults to on. Clicking a portrait and finding the token still pinned under the pile is the surprising behaviour, not the raising, and an off-by-default setting is least likely to be found by the players who most need it. Turn it off for the previous behaviour, where the bar never writes to the canvas.

  The setting stays client scoped, so each player chooses for themselves, and anyone who has already turned it off keeps it off.

## 2.1.1

### Fixed

- Bringing a token to the front did nothing on any ordinary scene. The check for "already on top" treated an equal `sort` as a win, but nothing sets `sort` by default, so every token in a pile sits at 0, every comparison tied, and no update was ever sent. Only a strictly greater `sort` puts a token in front, so a tie is now broken rather than accepted. The 2.1.0 tests all gave the covering token a distinct non-zero `sort` and so missed the one arrangement that actually occurs in play; four regression tests now cover it, each of which fails against 2.1.0.

## 2.1.0

### Added

- **Bring the token to the front when selected**, a new client setting, off by default. Selecting a token has never changed its render order, so a rescued token stayed underneath the pile and Foundry kept handing every click on that square to whatever was drawn on top. The token was selected but could not be dragged or clicked. Turning this on also raises the token by writing its `sort`, which puts it genuinely in front.

  It is opt in because `sort` lives on the token document, so the new order is shared with the whole table rather than being a local view change. It only applies to tokens you own, since Foundry refuses a player's edit to someone else's token, and a token buried by something at a higher elevation cannot be raised by reordering at all. The module reports that case instead of failing silently, and it never rewrites the sort of a token that is already on top, so repeated clicks cannot ratchet the value upwards.

## 2.0.0

Rewritten for Foundry VTT v13 and v14. The original module targeted v10 and v11 and no longer ran after Foundry moved its interface to Application V2.

### Compatibility

- Minimum Foundry version is now 13, verified against 14.
- Replaced all jQuery use with native DOM calls. Foundry's Application V2 no longer hands jQuery objects to hooks.
- The bar attaches through the documented `canvas.hud` accessor rather than a hardcoded element id, and reattaches itself if the HUD container re-renders and wipes its children.
- Shipped as an ES module with a separate stylesheet, instead of a single classic script that injected a `<style>` block on every render.
- Replaced the deprecated `Token#owner` with `isOwner`, and `User#updateTokenTargets` with `Token#setTarget`.

### Fixed

- The bar no longer appends a duplicate copy of itself every time a token is un-hovered. Previously copies accumulated until the scene changed.
- Moving the pointer from the token onto the bar no longer dismisses the bar before you can click it.
- Token movement is animated in current Foundry versions, and the document update fires once at the start. The bar now follows the animation instead of jumping ahead to the destination.
- A token positioned at x or y of exactly 0 no longer fails to trigger an update, which the old falsy check missed.
- Token names are rendered as text rather than HTML, closing an injection path through the tooltip.
- Video tokens play muted and looped rather than rendering as a black rectangle.
- Names now sort with a locale and numeric aware comparison, so "Goblin 2" comes before "Goblin 10".
- The canvas outline drawn when pointing at a portrait is cleaned up reliably rather than leaking when the bar closes underneath the pointer.

### Fixed after live testing on Foundry 14.364

- The bar was unusable whenever it happened to be drawn over another token, which is common, since it renders in the square below the one you are hovering. A few pixels of gap separate the token from the bar, and crossing that gap let the canvas hand the hover to the token underneath, which re-anchored the bar and dismissed it before the pointer arrived. The click then fell through to the wrong token. The gap is now bridged so the pointer never crosses dead space, and a hover arriving while the pointer is on the bar no longer re-anchors it.
- Raised the contrast of the bar's backdrop. It was tuned against empty canvas and read poorly over bright token artwork, which is exactly where it usually lands.

### Fixed after code review

- A hovered token that covered nothing stopped being tracked, so a token moving underneath it afterwards never produced a bar. A single frame of below-threshold coverage during a movement animation also dismissed a bar that was already in use, permanently, until the pointer left the token and came back. The hovered token is now tracked independently of whether anything is drawn.
- Automatic placement compared the token against the height of the scene rather than the visible window, so on any scene taller than the viewport a token low on screen had its bar drawn off the bottom edge. The fit test now runs in screen space and checks the top edge as well.
- A token whose artwork, name, ownership or visibility changed kept its stale portrait, because the redraw check compared only the list of token ids. It now compares a per-token signature. A token revealed underneath the anchor was missed entirely for the same reason and now appears.
- Discarded video portraits were left playing on detached elements, holding a decoder open for every rebuild.
- Coverage hovering on the threshold rebuilt the whole row every frame. Tokens already listed are now held until coverage drops a little further, which stops the churn.
- The bar could commit to a token before confirming the HUD layer existed, leaving it reporting an anchor with nothing on screen.
- The hide timer gave up if it fired while the pointer was on the bar, leaving one event as the only way to dismiss it. It now re-arms.
- The canvas outline could be orphaned over a token when the row rebuilt underneath the pointer.
- Button handlers held on to token objects that a layer redraw could replace, swallowing the first click afterwards. They now resolve by id.
- The width cap was expressed in viewport units inside two nested scaled containers, so it did not bound the drawn width when portraits scaled with zoom. The cap is now computed for the actual on-screen size, and the row wraps instead of scrolling, since a vertical wheel over the bar zooms the canvas rather than scrolling the row.

### Fixed for players who can only select their own token

The bar is the only way such a player can reach their own token once the rest of the party piles onto their square, since clicking the canvas there lands on a token they have no control over. Three things got in the way.

- Covered tokens were sorted by name alone, so a player's own token, the only one they can actually click, was scattered among the others. Tokens you own are now listed first.
- Names were shown only to the owner or the GM, ignoring the token's own **Display Name** setting. A party member whose nameplate was readable on the canvas still appeared as an anonymous portrait in the bar. The display mode is now honoured.
- Portraits for tokens you do not own looked fully clickable but did nothing on a left click. They now show a default cursor and drop the hover lift, while right click still targets them.

### Changed

- Covered tokens are detected by measuring the fraction of each token that is hidden, replacing the three separate overlap rules the original used for square, hexagonal and gridless scenes. Hexagonal scenes inset the bounding boxes to approximate the hex shape.
- Portraits default to a constant on-screen size rather than scaling with canvas zoom. The old behaviour is available as a setting.
- The dynamic token ring subject artwork is preferred over the base texture when a ring is configured.

### Added

- Seven client-scoped settings: enable, coverage threshold, portrait size, scale with zoom, include unowned tokens, hover outline, and bar placement.
- English localization; all user-facing strings are now translatable.
- Placement can flip above the token automatically near the bottom edge of a scene.
- Portraits are real buttons: keyboard focusable, with accessible labels.
- A reduced motion media query honours the operating system setting.
- Unit tests for the coverage geometry, plus lint and build scripts.

## 1.2.0 and earlier

See the [original module](https://github.com/xaukael/covered-token-rescue-hud).
