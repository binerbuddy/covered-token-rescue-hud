import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isVideoSource } from "../scripts/rescue-bar.mjs";

describe("isVideoSource", () => {
  test("recognizes webm", () => {
    assert.equal(isVideoSource("token.webm"), true);
  });

  test("recognizes mp4", () => {
    assert.equal(isVideoSource("token.mp4"), true);
  });

  test("recognizes m4v", () => {
    assert.equal(isVideoSource("token.m4v"), true);
  });

  test("recognizes ogv", () => {
    assert.equal(isVideoSource("token.ogv"), true);
  });

  test("is case-insensitive on the extension", () => {
    assert.equal(isVideoSource("token.WEBM"), true);
    assert.equal(isVideoSource("token.Mp4"), true);
  });

  test("ignores a query string after the extension", () => {
    assert.equal(isVideoSource("token.mp4?foo=bar"), true);
  });

  test("ignores a hash fragment after the extension", () => {
    assert.equal(isVideoSource("token.mp4#frag"), true);
  });

  test("ignores both a query string and a hash fragment", () => {
    assert.equal(isVideoSource("token.mp4?x=1#y=2"), true);
  });

  test("a fake extension hidden in the query string does not count", () => {
    assert.equal(isVideoSource("token.png?format=webm"), false);
  });

  test("a fake extension hidden in the hash fragment does not count", () => {
    assert.equal(isVideoSource("token.png#.webm"), false);
  });

  test("rejects a non-video image extension", () => {
    assert.equal(isVideoSource("token.png"), false);
  });

  test("rejects a webp image despite starting with 'we'", () => {
    assert.equal(isVideoSource("token.webp"), false);
  });

  test("rejects no extension at all", () => {
    assert.equal(isVideoSource("token"), false);
  });

  test("rejects an extension that only shares a prefix with a valid one", () => {
    assert.equal(isVideoSource("token.webmx"), false);
  });

  test("rejects a trailing dot with no extension", () => {
    assert.equal(isVideoSource("token."), false);
  });

  test("uses the last extension when there are multiple dots", () => {
    assert.equal(isVideoSource("token.tar.webm"), true);
    assert.equal(isVideoSource("token.webm.png"), false);
  });

  test("works with a full URL including a leading path", () => {
    assert.equal(isVideoSource("https://example.com/assets/creature.webm?v=2"), true);
  });

  test("works with a relative path", () => {
    assert.equal(isVideoSource("assets/tokens/hero.ogv"), true);
  });

  test("empty string returns false", () => {
    assert.equal(isVideoSource(""), false);
  });

  test("null returns false and does not throw", () => {
    assert.doesNotThrow(() => isVideoSource(null));
    assert.equal(isVideoSource(null), false);
  });

  test("undefined returns false and does not throw", () => {
    assert.equal(isVideoSource(undefined), false);
  });

  test("a number returns false and does not throw", () => {
    assert.equal(isVideoSource(123), false);
  });

  test("an object returns false and does not throw", () => {
    assert.equal(isVideoSource({ toString: () => "token.webm" }), false);
  });

  test("an array returns false", () => {
    assert.equal(isVideoSource(["token.webm"]), false);
  });

  test("mixed-case query string does not confuse extension detection", () => {
    assert.equal(isVideoSource("token.MP4?FOO=BAR.webm"), true);
  });

  test("a path with only a query string and no dot before it returns false", () => {
    assert.equal(isVideoSource("token?ext=mp4"), false);
  });
});
