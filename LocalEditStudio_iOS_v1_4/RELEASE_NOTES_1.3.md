# Local Edit Studio 1.3 — Rebuilt Release Candidate

This rebuild focuses on the core requirement: **change the requested region while preserving the visible person, skin tone, lighting, proportions, and scene as faithfully as possible.**

## New in 1.3

### Preservation-first generation
- Visible locks for:
  - identity
  - proportions / geometry
  - scene / background
- Internal candidate generation and automatic best-match selection
- Seam-aware and tone-aware candidate scoring
- Retouch / Replace / Creative edit modes

### Better editing philosophy
The editing prompt now explicitly prioritizes:
- preserving visible body silhouette
- preserving lighting and perspective
- preserving background content
- preserving visible identity markers

### Existing features retained
- Local on-device Core ML generation
- Selected-area editing
- Whole-image editing
- Multiple result variations
- Touch mask editor
- Combine People tab with on-device subject extraction
- Photos import/export
- Model manager
- Local history

## Scope
The app is optimized for high-quality general-purpose photo editing and professional retouching workflows. It does not claim to recover hidden real-world details that were absent from the source image.
