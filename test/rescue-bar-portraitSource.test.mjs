import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { portraitSource } from "../scripts/rescue-bar.mjs";

describe("portraitSource", () => {
  test("null token returns empty string without throwing", () => {
    assert.doesNotThrow(() => portraitSource(null));
    assert.equal(portraitSource(null), "");
  });

  test("undefined token returns empty string without throwing", () => {
    assert.equal(portraitSource(undefined), "");
  });

  test("empty object returns empty string", () => {
    assert.equal(portraitSource({}), "");
  });

  test("token with empty document returns empty string", () => {
    assert.equal(portraitSource({ document: {} }), "");
  });

  test("token.document being null does not throw and returns empty string", () => {
    assert.doesNotThrow(() => portraitSource({ document: null }));
    assert.equal(portraitSource({ document: null }), "");
  });

  test("falls back to texture.src when nothing higher priority is present", () => {
    const token = { document: { texture: { src: "a.png" } } };
    assert.equal(portraitSource(token), "a.png");
  });

  test("falls back to actor.img when texture.src is absent", () => {
    const token = { document: { actor: { img: "b.png" } } };
    assert.equal(portraitSource(token), "b.png");
  });

  test("texture.src takes priority over actor.img", () => {
    const token = {
      document: { texture: { src: "a.png" }, actor: { img: "b.png" } },
    };
    assert.equal(portraitSource(token), "a.png");
  });

  test("texture.src being null falls through to actor.img", () => {
    const token = {
      document: { texture: { src: null }, actor: { img: "b.png" } },
    };
    assert.equal(portraitSource(token), "b.png");
  });

  test("ring subject texture wins when ring.enabled is true", () => {
    const token = {
      document: {
        ring: { enabled: true, subject: { texture: "ring.webp" } },
        texture: { src: "a.png" },
        actor: { img: "b.png" },
      },
    };
    assert.equal(portraitSource(token), "ring.webp");
  });

  test("ring subject texture is ignored when ring.enabled is false", () => {
    const token = {
      document: {
        ring: { enabled: false, subject: { texture: "ring.webp" } },
        texture: { src: "a.png" },
      },
    };
    assert.equal(portraitSource(token), "a.png");
  });

  test("ring.enabled truthy but not strictly === true does not activate the ring source", () => {
    // Contract specifies "ONLY when ...enabled is true" - a truthy non-boolean
    // like 1 should not qualify under a strict reading of the spec.
    const token = {
      document: {
        ring: { enabled: 1, subject: { texture: "ring.webp" } },
        texture: { src: "a.png" },
      },
    };
    assert.equal(portraitSource(token), "a.png");
  });

  test("ring enabled true but subject texture missing falls through to texture.src", () => {
    const token = {
      document: {
        ring: { enabled: true, subject: {} },
        texture: { src: "a.png" },
      },
    };
    assert.equal(portraitSource(token), "a.png");
  });

  test("ring enabled true but subject entirely missing does not throw, falls through", () => {
    const token = {
      document: {
        ring: { enabled: true },
        texture: { src: "a.png" },
      },
    };
    assert.doesNotThrow(() => portraitSource(token));
    assert.equal(portraitSource(token), "a.png");
  });

  test("ring present but undefined does not throw", () => {
    const token = {
      document: { ring: undefined, texture: { src: "a.png" } },
    };
    assert.equal(portraitSource(token), "a.png");
  });

  test("all sources absent returns empty string, not null/undefined", () => {
    const token = { document: { ring: undefined, texture: undefined, actor: undefined } };
    const result = portraitSource(token);
    assert.equal(result, "");
    assert.equal(typeof result, "string");
  });

  test("ring enabled true with empty-string subject texture falls through (empty is not a usable source)", () => {
    const token = {
      document: {
        ring: { enabled: true, subject: { texture: "" } },
        texture: { src: "a.png" },
      },
    };
    // This assertion documents an assumption: an empty-string ring texture is
    // treated as "not present" and priority falls through. If the
    // implementation returns "" here instead, that is a defensible reading
    // too - flagged in the report as an inferred expectation, not a hard spec quote.
    assert.equal(portraitSource(token), "a.png");
  });

  test("actor present but img missing falls through to empty string", () => {
    const token = { document: { actor: {} } };
    assert.equal(portraitSource(token), "");
  });

  test("deeply nested null actor does not throw", () => {
    const token = { document: { actor: null } };
    assert.doesNotThrow(() => portraitSource(token));
    assert.equal(portraitSource(token), "");
  });

  test("does not mutate the token object", () => {
    const token = Object.freeze({
      document: Object.freeze({ texture: Object.freeze({ src: "a.png" }) }),
    });
    assert.doesNotThrow(() => portraitSource(token));
  });
});
