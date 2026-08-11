import type { EditMode } from "./types";

const MODE_GUIDANCE: Record<EditMode, string> = {
  retouch:
    "Make a restrained photorealistic retouch. Preserve identity, anatomy, pose, lighting direction, camera perspective, and all details not requested.",
  replace:
    "Replace only the described element. Preserve identity, anatomy, pose, lighting, perspective, and surrounding details exactly where possible.",
  creative:
    "Apply the requested creative direction while keeping the result photorealistic and preserving the subject's identity unless the request explicitly asks for an anonymized synthetic identity.",
};

export function buildGenerationPrompt({
  prompt,
  negativePrompt,
  mode,
  preserve,
  selectedArea,
  hasReference,
}: {
  prompt: string;
  negativePrompt: string;
  mode: EditMode;
  preserve: number;
  selectedArea: boolean;
  hasReference: boolean;
}) {
  const preservation = preserve >= 0.75
    ? "Preservation is strict: keep all unrequested pixels and visible identity as close to the source as possible."
    : preserve >= 0.45
      ? "Preservation is balanced: prioritize the requested edit while retaining recognizable source details."
      : "Preservation is flexible, but keep anatomy natural and the result coherent.";

  return [
    prompt.trim(),
    MODE_GUIDANCE[mode],
    preservation,
    selectedArea
      ? "Treat the transparent painted mask as the intended edit region. Do not change anything outside it unless needed for a seamless edge."
      : "Apply the edit to the whole image while preserving unrelated content.",
    hasReference ? "Use the second image only as a visual reference; do not copy an identity from it unless explicitly requested and permitted." : "",
    negativePrompt.trim() ? `Avoid: ${negativePrompt.trim()}.` : "",
    "Do not create nudity from a clothed person. Do not depict minors, coercion, non-consensual intimate content, or explicit sexual acts.",
  ]
    .filter(Boolean)
    .join(" ");
}
