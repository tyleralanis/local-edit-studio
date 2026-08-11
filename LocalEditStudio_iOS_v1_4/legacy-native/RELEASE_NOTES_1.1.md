# Local Edit Studio 1.1 — Release Candidate Notes

This revision focuses on the actual end-user experience rather than just proving that on-device diffusion can run.

## User-facing improvements

- More polished SwiftUI layout and consistent visual cards/status indicators
- Three-step workflow: select → describe → generate
- No pre-edited mask image required
- Quick / Balanced / High Detail quality presets
- 1–4 variations per request
- Visible generation progress and cancel control
- Result gallery with selection
- "Continue editing this result" workflow
- Photorealism assist toggle
- Lighting/perspective preservation assist toggle
- Exact effective prompt is always visible to the user
- Clearer one-time on-device model setup
- Local history and Photos export
- Selected-area editing preserves pixels outside the selected region

## Technical intent

The app remains model-agnostic at the UI layer. Better compatible Core ML models can be imported later without rewriting the editor.

The phone build uses Apple's StableDiffusion Swift package and reduced-memory Core ML loading. Performance depends on the installed model and iPhone generation.

## Scope

The application is optimized for high-quality general photo editing and realistic image generation. It does not attempt to infer hidden real-world details that are absent from a source image.
