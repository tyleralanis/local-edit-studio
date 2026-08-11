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
  | "tintRed"
  | "tintBlue"
  | "tintPink"
  | "tintPurple"
  | "enhance";

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
  if (/\b(?:make|change|turn|color|colour).*\b(?:red|crimson)\b/.test(text)) return "tintRed";
  if (/\b(?:make|change|turn|color|colour).*\b(?:blue|navy|teal)\b/.test(text)) return "tintBlue";
  if (/\b(?:make|change|turn|color|colour).*\b(?:pink|rose)\b/.test(text)) return "tintPink";
  if (/\b(?:make|change|turn|color|colour).*\b(?:purple|violet)\b/.test(text)) return "tintPurple";
  if (/\b(enhance|improve|polish|clean up the photo|professional finish)\b/.test(text)) return "enhance";
  return null;
}

export const LOCAL_EDIT_HELP =
  "Local edits understand brighten, darken, contrast, vibrant, black and white, warm, cool, blur, sharpen, smooth skin, cinematic, enhance, change a painted area to red/blue/pink/purple, and remove a painted area.";
