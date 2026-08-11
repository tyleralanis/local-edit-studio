# Edit Studio 2.0

Edit Studio is an Expo/React Native photo editor for iPhone and modern desktop browsers. It replaces the former manual model-import prototype with a responsive editor, built-in credential-free effects, and an optional secure cloud image-editing route.

## Product scope

- Manual brush and mask erasing
- Selected-area and whole-image editing
- Retouch, replace, and creative modes
- Preservation controls and reference images
- Local history, undo, reset, discard, save, and share
- On-device lighting, color, retouching, sharpening, blur, cinematic grading, and painted-area cleanup
- Downloadable on-device text-to-image generation with no account or per-image service charge
- The same built-in editing flow in a browser with no Python installation
- First-run 18+ and consent acknowledgement
- Existing consensual adult nude images may be submitted for permitted edits
- No generation of nudity from clothed photos, minors, coercive/non-consensual content, or explicit sexual acts
- No app-imposed edit quota; provider rate limits and billing apply only to cloud generation

## Built-in editing

Common commands run locally without an account, model download, or provider key: brighten, darken, contrast, vibrant, black and white, warm, cool, blur, sharpen, smooth skin, cinematic, enhance, recolor a painted area using a named color or hex code, and clean up a painted area. On iOS these use the bundled Core Image module; on the web they use the browser canvas.

The iPhone app can also download the BK-SDM-Tiny model through React Native ExecuTorch and generate new images entirely on-device. The initial model download is about 1.9 GB and is cached locally. Prompts and generated images are not sent to an inference provider. Local prompt safeguards run before inference. Semantic, context-aware replacement within an existing photo remains an optional cloud feature because the bundled local model is text-to-image rather than image-conditioned inpainting.

## Optional secure generation

Cloud generation is disabled in the client by default, so ordinary users cannot incur provider charges. If the owner later opts in, the phone still never contains the provider key: `src/app/api/edit+api.ts` runs on EAS Hosting and reads `OPENAI_API_KEY` from the server environment. Expo Router sends the native client to the fixed production origin at `https://edit-studio.expo.app/api/edit`.

Required only for open-ended cloud generation:

- `OPENAI_API_KEY` — secret, server-side only
- `EXPO_PUBLIC_ENABLE_CLOUD_GENERATION=true` — explicit client opt-in; leave unset or false for local-only use

`EXPO_PUBLIC_EDIT_API_URL` is an optional override for a separate staging service; production does not require it.

## Over-the-air updates

Production builds use the `production` EAS Update channel and the fingerprint runtime policy. JavaScript, styling, prompts, safeguards, and bundled assets can be updated without a new App Store build as long as the native runtime does not change. Adding/upgrading native libraries, changing native configuration, or changing permissions changes the fingerprint and requires a new build, preventing incompatible updates from reaching older binaries.

## Commands

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm export:web
eas update --channel production --environment production --message "Description"
```

The previous Swift/Core ML implementation is retained under `legacy-native/` for reference only.
