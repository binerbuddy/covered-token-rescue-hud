# Covered Token Rescue HUD

A [Foundry Virtual Tabletop](https://foundryvtt.com/) module for getting at tokens that are buried underneath other tokens.

Hover a token that is sitting on top of others and a small row of portraits appears beside it. Click one to select the token underneath. No more dragging the dragon off the paladin to find out who is standing there.

![demo](https://i.imgur.com/1doIOSO.gif)

> This is a fork of [xaukael/covered-token-rescue-hud](https://github.com/xaukael/covered-token-rescue-hud), rewritten for Foundry v13 and v14. The original stopped working when Foundry moved its interface to Application V2.

## Requirements

Foundry VTT version 13 or 14. It is system agnostic and has no dependencies.

For Foundry v10 to v12, use [the original module](https://github.com/xaukael/covered-token-rescue-hud) instead.

## Installation

In Foundry, open **Add-on Modules**, choose **Install Module**, and paste this manifest URL:

```
https://github.com/binerbuddy/covered-token-rescue-hud/releases/latest/download/module.json
```

## Using it

Hover any token that covers another one.

| Action | Result |
| --- | --- |
| Left click a portrait | Select that token |
| Shift and left click | Add that token to the current selection |
| Right click a portrait you own | Open that token's HUD |
| Right click a portrait you do not own | Toggle targeting on that token |
| Point at a portrait | Outline that token on the canvas |

An orange border means the token is selected. A red inner glow means you are targeting it.

The bar stays put while your pointer moves onto it, and follows the token if it walks away mid-hover.

## Settings

All settings are per client, so each player can tune the bar to their own screen without affecting the table.

| Setting | Default | What it does |
| --- | --- | --- |
| Enable rescue bar | On | Master switch |
| Coverage threshold | 0.75 | How much of a token must be hidden before it counts as covered. Set it to 1.00 to require total burial |
| Portrait size | 48px | On-screen size of each portrait |
| Scale with canvas zoom | Off | On restores the old behaviour where the bar shrinks as you zoom out. Off keeps it a constant readable size |
| Include tokens you do not own | On | Off shows only tokens you can control |
| Outline token on hover | On | Draws a dashed outline on the canvas over the token a portrait refers to |
| Bar placement | Automatic | Draw the bar below the token, above it, or flip automatically near the bottom edge of the scene |

## What changed in version 2

The module was rebuilt rather than patched. The original targeted Foundry v10 and v11 and broke on v13.

- Rewritten against the Application V2 canvas HUD, with no jQuery.
- Covered tokens are now found by measuring how much of each token is hidden, rather than three separate rules for square, hex and gridless scenes. One threshold setting replaces all of it, and it works on every grid type.
- The bar no longer stacks duplicate copies of itself when you stop hovering a token. That was a long standing bug in the original.
- The bar survives the trip from the token to your pointer, instead of vanishing on the way.
- Portraits keep a constant size on screen by default, so the bar is still usable zoomed out, which is exactly when tokens pile up.
- Token names go through Foundry's text-safe tooltip, so a token named with stray markup can no longer inject HTML.
- Video tokens actually play, instead of showing a black frame.
- Added settings, English localization, and keyboard-focusable buttons with labels for screen readers.
- The bar now tracks tokens through movement animations rather than jumping to the destination.

See [CHANGELOG.md](CHANGELOG.md) for the full list.

## Development

```bash
npm install
npm test        # unit tests, Node built-in runner
npm run lint    # eslint
npm run build   # package dist/module.zip and dist/module.json
```

The geometry that decides what counts as covered lives in `scripts/geometry.mjs` and is pure, so it is tested without a running Foundry instance.

## Credits

Original module by [Xaukael](https://github.com/xaukael). Released under the MIT license, as was the original.
