import type { MaskStroke } from "./types";

export function hasPaintedSelection(strokes: MaskStroke[]) {
  return strokes.some((stroke) => !stroke.erase && stroke.points.length > 0);
}
