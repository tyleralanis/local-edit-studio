export type RecolorOperation = `recolor:#${string}`;

export type LocalOperation =
  | "brighten"
  | "darken"
  | "contrast"
  | "vibrant"
  | "blackAndWhite"
  | "warm"
  | "cool"
  | "blur"
  | "sharpen"
  | "smooth"
  | "cinematic"
  | "remove"
  | "enhance"
  | RecolorOperation;

export const RECOLOR_PRESETS = [
  { name: "black", hex: "#171717" },
  { name: "white", hex: "#ededed" },
  { name: "red", hex: "#d9363e" },
  { name: "orange", hex: "#e9822b" },
  { name: "yellow", hex: "#e1c542" },
  { name: "green", hex: "#369963" },
  { name: "teal", hex: "#248f91" },
  { name: "blue", hex: "#3979d2" },
  { name: "navy", hex: "#273e70" },
  { name: "purple", hex: "#8052c7" },
  { name: "pink", hex: "#d55d9b" },
  { name: "brown", hex: "#79523c" },
] as const;

const NAMED_COLORS: ReadonlyArray<readonly [string, string]> = [
  ["forest green", "#28704b"],
  ["sky blue", "#69a9df"],
  ["royal blue", "#3157b7"],
  ["hot pink", "#e44292"],
  ["rose gold", "#b97872"],
  ["burnt orange", "#b85c2b"],
  ["dark green", "#245b3d"],
  ["light blue", "#81b8df"],
  ["light pink", "#dfa0bb"],
  ["dark red", "#8b2635"],
  ["off white", "#e5dfd2"],
  ["crimson", "#b12643"],
  ["burgundy", "#6d253e"],
  ["maroon", "#6b2938"],
  ["magenta", "#c43f98"],
  ["violet", "#7750c4"],
  ["lavender", "#a68bd4"],
  ["purple", "#8052c7"],
  ["turquoise", "#2da7a3"],
  ["teal", "#248f91"],
  ["cyan", "#35abc4"],
  ["navy", "#273e70"],
  ["blue", "#3979d2"],
  ["emerald", "#2e8d5b"],
  ["olive", "#70783b"],
  ["green", "#369963"],
  ["gold", "#c69b2d"],
  ["yellow", "#e1c542"],
  ["orange", "#e9822b"],
  ["coral", "#df7466"],
  ["scarlet", "#ca343c"],
  ["red", "#d9363e"],
  ["rose", "#c95479"],
  ["pink", "#d55d9b"],
  ["chocolate", "#674332"],
  ["brown", "#79523c"],
  ["camel", "#b78b5d"],
  ["tan", "#bd956c"],
  ["khaki", "#a89b70"],
  ["beige", "#d1bda0"],
  ["cream", "#e8dfca"],
  ["silver", "#b8bdc5"],
  ["charcoal", "#3f4248"],
  ["grey", "#858991"],
  ["gray", "#858991"],
  ["white", "#ededed"],
  ["black", "#171717"],
];

function recolorOperation(text: string): RecolorOperation | null {
  const hasColorIntent = /\b(make|change|turn|recolor|recolour|color|colour|paint|set)\b/.test(text);
  if (!hasColorIntent) return null;

  const customHex = text.match(/#[0-9a-f]{6}\b/i)?.[0];
  if (customHex) return `recolor:${customHex.toLowerCase()}` as RecolorOperation;

  for (const [name, hex] of NAMED_COLORS) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(text)) return `recolor:${hex}` as RecolorOperation;
  }
  return null;
}

export function detectLocalOperation(prompt: string): LocalOperation | null {
  const text = prompt.toLowerCase();
  if (/\b(remove|erase|delete|clean up|clean-up)\b/.test(text)) return "remove";
  if (/\b(black\s*(?:and|&)\s*white|monochrome|noir|grayscale|greyscale)\b/.test(text)) return "blackAndWhite";
  if (/\b(cinematic|film look|movie look|moody grade|boudoir color grade)\b/.test(text)) return "cinematic";
  if (/\b(smooth|retouch skin|skin tone|soften skin|blemish|noise reduction)\b/.test(text)) return "smooth";
  if (/\b(brighten|brighter|increase (?:the )?(?:light|exposure)|improve (?:the )?lighting|lift shadows)\b/.test(text)) return "brighten";
  if (/\b(darken|darker|lower (?:the )?(?:light|exposure)|deepen shadows)\b/.test(text)) return "darken";
  if (/\b(contrast|deeper blacks|more definition)\b/.test(text)) return "contrast";
  if (/\b(vibrant|vivid|saturat(?:e|ion)|richer colors?)\b/.test(text)) return "vibrant";
  if (/\b(warm|warmer|golden)\b/.test(text)) return "warm";
  if (/\b(cool|cooler|blue tone)\b/.test(text)) return "cool";
  if (/\b(blur|soft focus|defocus)\b/.test(text)) return "blur";
  if (/\b(sharpen|sharper|crisper|more detail)\b/.test(text)) return "sharpen";
  const recolor = recolorOperation(text);
  if (recolor) return recolor;
  if (/\b(enhance|improve|polish|clean up the photo|professional finish)\b/.test(text)) return "enhance";
  return null;
}

export function recolorHex(operation: LocalOperation) {
  return operation.startsWith("recolor:#") ? operation.slice("recolor:".length) : null;
}

export const LOCAL_EDIT_HELP =
  "Local edits understand brighten, darken, contrast, vibrant, black and white, warm, cool, blur, sharpen, smooth skin, cinematic, enhance, recolor a painted area using a named color or #hex code, and clean up a painted area.";
