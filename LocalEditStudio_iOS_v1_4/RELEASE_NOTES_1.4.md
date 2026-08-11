# Local Edit Studio 1.4 — Release Candidate

## Requested additions

### 9. Automatic quality inspection
The result screen can now run a local QA pass that checks:
- pixel drift outside the edit mask
- color/exposure drift
- edit-boundary mismatch
- face-count changes
- face position/size drift

The report produces a score plus warnings and passed checks.

This is intentionally a photographer QA system rather than a claim that every possible generative artifact can be detected automatically.

### 10. Better masks / Smart Select
Smart Select now supports:
- Person
- Foreground object
- Background

Apple Vision performs these selections locally. Brush/eraser correction remains available.

The architecture is ready for additional semantic segmentation models later for finer classes such as hair or garments.

### 11. Pose-aware Combine People
Combine People now adds:
- donor in front / donor behind base subject
- automatic base-person mask for occlusion
- floor-line control
- perspective scaling
- contact-shadow control
- drag / pinch / rotate placement

These controls make couple/family/editorial composites much more natural than flat cut-and-paste placement.

### Autosave / crash recovery
The editor now saves:
- source photo
- prompt
- negative prompt
- edit mode
- preserve-original setting
- quality preset
- guidance
- seed

A previous session can be restored after an unexpected exit.

### Export controls
New export sheet:
- JPEG
- PNG
- HEIF
- JPEG/HEIF compression quality
- current full result resolution
- Share Sheet export

## Previous core capabilities retained
- local Core ML diffusion
- selected-area and whole-image editing
- preservation locks
- internal candidate ranking
- multiple variations
- local history
- Combine People
- on-device model manager
