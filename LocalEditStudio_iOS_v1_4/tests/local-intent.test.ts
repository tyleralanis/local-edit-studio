import assert from "node:assert/strict";
import test from "node:test";

import { detectLocalOperation } from "../src/lib/localIntent";

test("maps common requests to credential-free local edits", () => {
  assert.equal(detectLocalOperation("Improve the lighting and keep the face unchanged"), "brighten");
  assert.equal(detectLocalOperation("Create a cinematic boudoir color grade"), "cinematic");
  assert.equal(detectLocalOperation("Retouch skin tone and natural texture"), "smooth");
  assert.equal(detectLocalOperation("Remove the painted object"), "remove");
});

test("maps painted color changes", () => {
  assert.equal(detectLocalOperation("Change the painted shirt to blue"), "recolor:#3979d2");
  assert.equal(detectLocalOperation("Make the selected fabric forest green"), "recolor:#28704b");
  assert.equal(detectLocalOperation("Recolor the jacket #32a852"), "recolor:#32a852");
  assert.equal(detectLocalOperation("Make the selected dress black"), "recolor:#171717");
});

test("leaves context-aware replacements for a generative engine", () => {
  assert.equal(detectLocalOperation("Replace the chair with a velvet couch"), null);
});
