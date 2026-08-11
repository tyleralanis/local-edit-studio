# Edit Studio 2.0

Edit Studio is an Expo/React Native photo editor for iPhone and modern desktop browsers. It replaces the former manual model-import prototype with a responsive editor, built-in credential-free effects, and an optional secure cloud image-editing route.

## Product scope

- Manual brush and mask erasing
- Selected-area and whole-image editing
- Retouch, replace, and creative modes
- Preservation controls and reference images
- Local history, undo, reset, discard, save, and share
- On-device lighting, color, retouching, sharpening, blur, cinematic grading, and painted-area cleanup
- The same built-in editing flow in a browser with no Python installation
- First-run 18+ and consent acknowledgement
- Existing consensual adult nude images may be submitted for permitted edits
- No generation of nudity from clothed photos, minors, coercive/non-consensual content, or explicit sexual acts
- No app-imposed edit quota; provider rate limits and billing apply only to cloud generation

## Built-in editing

Common commands run locally without an account, model download, or provider key: brighten, darken, contrast, vibrant, black and white, warm, cool, blur, sharpen, smooth skin, cinematic, enhance, recolor a painted area, and clean up a painted area. On iOS these use the bundled Core Image module; on the web they use the browser canvas. Open-ended semantic replacement remains an optional cloud feature.

## Optional secure generation

The phone never contains the model provider key. `src/app/api/edit+api.ts` runs on EAS Hosting and reads `OPENAI_API_KEY` from the server environment. Expo Router sends the native client to the fixed production origin at `https://edit-studio.expo.app/api/edit`.

Required only for open-ended cloud generation:

- `OPENAI_API_KEY` — secret, server-side only

`EXPO_PUBLIC_EDIT_API_URL` is an optional override for a separate staging service; production does not require it.

## Over-the-air updates

Production builds use the `production` EAS Update channel and the app-version runtime policy. JavaScript, styling, prompts, and bundled assets can be updated without a new App Store build as long as the native runtime does not change. Adding/upgrading native libraries, changing native configuration, or changing permissions still requires a new build.

## Commands

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm export:web
eas update --channel production --environment production --message "Description"
```

The previous Swift/Core ML implementation is retained under `legacy-native/` for reference only.
