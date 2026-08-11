# Edit Studio 2.0

Edit Studio is an Expo/React Native photo editor for iPhone. It replaces the former native model-import prototype with a responsive client and a secure cloud image-editing route.

## Product scope

- Manual brush and mask erasing
- Selected-area and whole-image editing
- Retouch, replace, and creative modes
- Preservation controls and reference images
- Local history, undo, reset, discard, save, and share
- First-run 18+ and consent acknowledgement
- Existing consensual adult nude images may be submitted for permitted edits
- No generation of nudity from clothed photos, minors, coercive/non-consensual content, or explicit sexual acts
- No client-side generation quota; provider rate limits and billing still apply

## Secure generation

The phone never contains the model provider key. `src/app/api/edit+api.ts` runs on EAS Hosting and reads `OPENAI_API_KEY` from the server environment. Expo Router sends the native client to the fixed production origin at `https://edit-studio.expo.app/api/edit`.

Required EAS production variables:

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
