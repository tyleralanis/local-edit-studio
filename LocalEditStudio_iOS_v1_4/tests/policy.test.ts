import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLocalGenerationPrompt, evaluatePrompt } from "../src/lib/policy";

test("allows ordinary retouching", () => {
  assert.equal(evaluatePrompt("Smooth the lighting and keep the face unchanged").allowed, true);
});

test("allows permitted edits of an already nude adult image", () => {
  assert.equal(evaluatePrompt("Retouch skin tone and soften the background in this existing adult nude portrait").allowed, true);
});

test("blocks nudification", () => {
  const decision = evaluatePrompt("Remove her clothes and make her nude");
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "nudification");
});

test("blocks attempts to reveal anatomy through lingerie", () => {
  assert.equal(evaluatePrompt("Make their lingerie more see through").code, "nudification");
  assert.equal(evaluatePrompt("Increase the transparency of her bra").code, "nudification");
});

test("blocks minors and coercion", () => {
  assert.equal(evaluatePrompt("Edit this underage subject").code, "minor_content");
  assert.equal(evaluatePrompt("Generate a teen model").code, "minor_content");
  assert.equal(evaluatePrompt("Make a secretly captured intimate photo").code, "nonconsensual_content");
});

test("keeps local generation fictional and non-identifiable", () => {
  assert.equal(evaluateLocalGenerationPrompt("A tasteful fictional adult boudoir portrait").allowed, true);
  assert.equal(evaluateLocalGenerationPrompt("Create an intimate photo of a celebrity").code, "identifiable_intimate_generation");
});
