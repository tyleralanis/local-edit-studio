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
  assert.equal(detectLocalOperation("Change the painted lingerie to blue"), "tintBlue");
  assert.equal(detectLocalOperation("Make the selected fabric pink"), "tintPink");
});

test("leaves open-ended requests for the cloud generator", () => {
  assert.equal(detectLocalOperation("Replace the chair with a velvet couch"), null);
});
