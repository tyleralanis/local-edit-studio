import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";

import { renderMaskPng } from "../src/lib/mask.server";

test("paint makes the selected region transparent", async () => {
  const bytes = await renderMaskPng(64, 64, [
    { id: "paint", erase: false, width: 0.2, points: [{ x: 0.5, y: 0.5 }] },
  ]);
  const png = PNG.sync.read(Buffer.from(bytes));
  const center = (32 * 64 + 32) * 4;
  const corner = 0;
  assert.equal(png.data[center + 3], 0);
  assert.equal(png.data[corner + 3], 255);
});

test("eraser restores opacity inside a painted region", async () => {
  const bytes = await renderMaskPng(64, 64, [
    { id: "paint", erase: false, width: 0.4, points: [{ x: 0.5, y: 0.5 }] },
    { id: "erase", erase: true, width: 0.1, points: [{ x: 0.5, y: 0.5 }] },
  ]);
  const png = PNG.sync.read(Buffer.from(bytes));
  const center = (32 * 64 + 32) * 4;
  assert.equal(png.data[center + 3], 255);
});
