# Local Edit Studio 1.2 — Release Candidate

## New: Combine People

A new native compositing workflow for photographers who need to merge separate portraits into one finished image.

Typical workflow:

1. Choose the best solo or scene image as the base.
2. Choose another photograph containing the person to add.
3. Apple Vision automatically generates a foreground instance mask on-device.
4. The donor person is cut out automatically.
5. Drag, pinch, and rotate the person directly over the base photograph.
6. Fine tune size, rotation, opacity, and natural shadow.
7. Render and save the composite.

This is designed for cases such as couples who photograph better separately than together, family composites, wedding party corrections, head swaps using a separately prepared donor, editorial composites, and other authorized professional-photography workflows.

## Existing 1.1 features retained

- Native local Core ML image generation
- Selected-area editing
- Whole-image editing
- Touch mask editor
- Quick / Balanced / High Detail modes
- Multiple variations
- Visible prompt and prompt-assist controls
- Local history
- Photos import/export
- On-device model management
- Pixel preservation outside selected edit regions

## Privacy

Foreground isolation is performed using Apple's Vision framework locally on the device. The source images do not need to be uploaded to a segmentation server.
