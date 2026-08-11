export interface PolicyDecision {
  allowed: boolean;
  code?: string;
  message?: string;
}

const MINOR_PATTERN = /\b(child|children|minor|underage|preteen|pre-teen|schoolgirl|schoolboy|young-looking|looks? (?:very )?young|barely legal)\b/i;
const NONCONSENSUAL_PATTERN = /\b(without (?:their )?consent|non[- ]?consensual|revenge porn|secretly|unaware|unconscious|asleep|drugged|forced|coerced|rape|assault)\b/i;
const NUDIFICATION_PATTERN = /\b(nudify|undress|naked version|make (?:them|him|her|the person|this person) nude|remove (?:all |the )?(?:clothes|clothing|underwear|bra|lingerie)|see[- ]?through (?:clothes|clothing|lingerie|underwear|bra)|x[- ]?ray (?:clothes|clothing)|(?:make|turn|render|increase).*?(?:lingerie|underwear|bra).*?(?:see[- ]?through|transparen(?:t|cy)|sheer)|(?:make|turn|render|increase).*?(?:see[- ]?through|transparen(?:t|cy)|sheer).*?(?:lingerie|underwear|bra))\b/i;
const EXPLICIT_ACT_PATTERN = /\b(penetration|oral sex|sex act|masturbat(?:e|ing|ion)|ejaculat(?:e|ing|ion)|intercourse|genital contact)\b/i;

export function evaluatePrompt(prompt: string): PolicyDecision {
  const normalized = prompt.trim();
  if (!normalized) {
    return { allowed: false, code: "empty_prompt", message: "Describe the edit you want first." };
  }
  if (normalized.length > 1200) {
    return { allowed: false, code: "prompt_too_long", message: "Shorten the edit description to 1,200 characters or fewer." };
  }
  if (MINOR_PATTERN.test(normalized)) {
    return { allowed: false, code: "minor_content", message: "Edits involving minors or young-looking people are not allowed." };
  }
  if (NONCONSENSUAL_PATTERN.test(normalized)) {
    return { allowed: false, code: "nonconsensual_content", message: "Non-consensual or coercive intimate edits are not allowed." };
  }
  if (NUDIFICATION_PATTERN.test(normalized)) {
    return { allowed: false, code: "nudification", message: "The app can edit an existing adult image, but it cannot create nudity from a clothed person." };
  }
  if (EXPLICIT_ACT_PATTERN.test(normalized)) {
    return { allowed: false, code: "explicit_act", message: "Generating or altering explicit sexual acts is not supported." };
  }
  return { allowed: true };
}

export const CONSENT_VERSION = 1;

export const CONSENT_DISCLAIMER =
  "Edit Studio is for adults 18+ editing images they own or have explicit permission to edit. Every depicted person must be an adult who consented to the image and this use. Existing consensual adult nude images may be used for permitted edits. Do not use Edit Studio to create nudity from clothed photos, depict minors, make non-consensual intimate imagery, or create explicit sexual acts. Built-in edits stay on this device. An image is sent to the secure generation provider only when an edit needs the optional cloud generator and you choose Apply or generate edit. Provider safety rules, rate limits, and billing still apply.";
