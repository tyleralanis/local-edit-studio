# Local Edit Studio 1.4 — Native iPhone Edition

A native SwiftUI image editor that runs compatible Stable Diffusion Core ML models locally on iPhone and iPad.

## What is included

- Native SwiftUI UI
- Photos import and export
- Finger/Apple Pencil mask painting
- Selected-area editing
- Whole-image image-to-image editing
- Localized crop generation to reduce work
- Exact preservation of pixels outside the selected region
- Seed, steps, guidance, and preservation controls
- Local edit history
- On-device Core ML inference
- Model folder importer
- Increased-memory-limit entitlement
- XcodeGen project definition

## Why the app remains native Swift

The core feature is multi-gigabyte Core ML diffusion inference using Apple's StableDiffusion Swift package, Core ML compute units, and iOS memory-management options. A native Swift app is substantially cleaner and more reliable for this than wrapping it through Expo/React Native.

The app itself remains fully native. Expo Application Services is used only as the hosted macOS build, signing, and TestFlight delivery pipeline.

## Requirements

- Mac with Xcode
- Apple Developer account
- XcodeGen (`brew install xcodegen`)
- iPhone/iPad running iOS 17+
- A compatible Core ML Stable Diffusion Resources folder

## Create the Xcode project

From Terminal:

```bash
cd LocalEditStudio_iOS
xcodegen generate
open LocalEditStudio.xcodeproj
```

In Xcode:

1. Select the `LocalEditStudio` target.
2. Signing & Capabilities → select your Apple Developer team.
3. Confirm the bundle identifier is `com.tyleralanis.localeditstudio`.
4. Connect your iPhone and build to the device.
5. For TestFlight, Product → Archive → Distribute App → App Store Connect.

## Model installation

The TestFlight binary intentionally does not bundle multi-gigabyte diffusion weights.

Use Apple's `ml-stable-diffusion` conversion workflow or a compatible pre-converted Core ML model. On iPhone, the imported Resources folder should contain at minimum:

- `TextEncoder.mlmodelc` (or a compatible encoder)
- `UnetChunk1.mlmodelc`
- `UnetChunk2.mlmodelc`
- `VAEDecoder.mlmodelc`
- `VAEEncoder.mlmodelc` (required for editing existing images)
- `vocab.json`
- `merges.txt`

Put the Resources folder in iCloud Drive / Files, open Local Edit Studio → Models, and import the folder.

Apple recommends chunked UNet files, compressed weights, and reduced-memory operation on iPhone.

## Important implementation note

Apple's current StableDiffusion Swift pipeline supports text-to-image and image-to-image. The app implements selected-area editing by:

1. rendering the user's mask,
2. finding a padded crop around the selection,
3. running image-to-image on that crop,
4. compositing only selected pixels back into the original.

This keeps unselected pixels identical to the source while giving the local model context around the edit.

## GitHub

This folder is ready to commit to GitHub. The repo can be created or uploaded from Xcode, GitHub Desktop, or the command line.

## EAS Build and TestFlight

The repository is connected to the Expo project `@alanis-projects/edit-studio` with this directory as its base directory. The production workflow:

1. generates the Xcode project with XcodeGen on an EAS macOS worker,
2. signs the native app for `com.tyleralanis.localeditstudio`,
3. creates a production App Store archive, and
4. uploads the successful build to TestFlight.

The workflow definition is `.eas/workflows/build-and-testflight.yml`; its production build profile is in `eas.json`.


See `RELEASE_NOTES_1.1.md` for the current release-candidate feature set.


## Combine People

Version 1.2 adds on-device person extraction and interactive photographic compositing using Apple Vision.


## Preservation-first editing

Version 1.3 adds visible identity/geometry/scene locks, Retouch/Replace/Creative modes, and internal candidate ranking to better preserve the original subject while still filling edited regions convincingly.


## Version 1.4

Adds local QA inspection, Vision Smart Select, pose-aware person compositing, autosave/crash recovery, and professional export controls.
