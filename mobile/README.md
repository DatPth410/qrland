# QRLand (mobile)

Animated, **scannable 3D QR worlds** for iOS & Android — the mobile sibling of the
`qrland` web app, built on the cherry-blossom-qrcode idea.

Type a URL and it becomes a little world built out of the QR code's modules. **Tap the
world** to morph between the isometric 3D view and a flat top-down view that a normal
camera can scan. Three worlds ship today:

- **Cherry Blossom** — a sakura tree (brown trunk, pink dome canopy) on a grass-and-dirt field.
- **Khuê Văn Các** — the Hà Nội pavilion (ported from the web app).
- **Cyclades** — a whitewashed Greek-island church (ported from the web app).

## Stack

React Native (Expo) + **`react-native-wgpu` (WebGPU)** + **React Three Fiber on
`three/webgpu`**. Everything renders on the GPU through Metal (iOS) / Vulkan (Android).
The web app's Three.js scene (`QRField`, the theme system, lighting) is reused almost
verbatim — see [Architecture](#architecture).

## Run it (iOS Simulator)

You need a **dev build** — `react-native-wgpu` is a native module, so Expo Go won't work.
On a Mac that means Xcode.

### One-time setup
1. **Install Xcode** from the App Store (large download), then open it once to finish setup.
2. Point the toolchain at it and accept the license:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```
3. **Install an iOS Simulator runtime**: Xcode → Settings → Components → install an iOS runtime.
4. **CocoaPods** (native dependency manager):
   ```sh
   brew install cocoapods        # or: sudo gem install cocoapods
   brew install watchman         # recommended for Metro file-watching
   ```

### Build & launch
```sh
cd mobile
npm install
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios   # prebuild + pod install + native build + boot
```
The `LANG`/`LC_ALL` exports work around a CocoaPods Ruby locale bug
(`Unicode Normalization not appropriate for ASCII-8BIT`) — without them `pod install` crashes.

When `expo run:ios` finishes it prints a benign `osascript ... System Events` error from its "focus
the Simulator window" step — the build, install, and launch all succeed; you can ignore it.

If the app launches and immediately shows **"No script URL provided"** (Metro can't be found),
re-issue the dev-client deep link manually with your machine's LAN IP:
```sh
# replace 10.0.0.x with `ipconfig getifaddr en0`
xcrun simctl openurl booted "com.anonymous.qrland://expo-development-client/?url=http%3A%2F%2F10.0.0.x%3A8081"
```

### ⚠️ Simulator gotcha — disable Metal Validation
WebGPU (Dawn → Metal) trips the Simulator's Metal Validation layer. In
**Xcode → Product → Scheme → Edit Scheme → Run → Options**, **uncheck "Metal Validation"**
(or run on a physical device, where it isn't needed).

> Works in the Simulator because this Mac is **Apple Silicon** (Metal is available there). On an
> Intel Mac you'd need a physical device.

### Android (optional)
Install Android Studio + an emulator (or plug in a device), then `npx expo run:android`.

## Using the app
- **Tap the world** → morph between 3D (scene) and flat (scan) views. The flat view is a real,
  scannable QR — point another phone's camera at the screen to test it.
- **World pills** (top) → switch between Cherry Blossom / Khuê Văn Các / Cyclades.
- **Text field** (bottom) → type any URL/text; the world re-encodes a beat after you stop typing.

## Shipping to the stores
Both stores accept this app; you build with **EAS** (no Expo Go involved):
```sh
npm i -g eas-cli && eas login
eas build -p ios        # → .ipa  (needs an Apple Developer account)
eas build -p android    # → .aab  (needs a Google Play account)
eas submit -p ios       # upload to App Store Connect
eas submit -p android   # upload to Play Console
```
You'll set a real bundle identifier / package name in `app.json` before the first build.

## Architecture

```
src/
  qr/generate.ts            QR → boolean matrix (ECC H, min version 11)   ← copied from web app
  scene/
    theme.ts                QRTheme / ColumnSpec / PropVoxel interfaces   ← copied from web app
    themes/
      cherryBlossom.ts      the sakura tree (new, this app)
      khuevancac.ts         Hà Nội pavilion world                          ← copied from web app
      cycladic.ts           Greek-island church world                      ← copied from web app
    QRField.tsx             instanced voxels + scene↔scan height fold      ← copied from web app
    Scene.tsx               background + lighting + field + camera (mobile)
    CameraRig.tsx           eases the camera between iso & top-down (mobile, replaces drei)
  state/useView.ts          scene/scan toggle store (zustand)
  ui/
    QRApp.tsx               state + canvas mount + controls
    Controls.tsx            world pills, URL field, view toggle
  lib/                      react-native-wgpu ↔ R3F harness (from the Expo WebGPU template)
  app/                      expo-router entry (index renders QRApp)
```

A **theme** turns the QR matrix into a 3D world. Dark/light modules extrude into themed
voxel columns (`column()` / `light()`), decorative voxels are added via `props()`, and
anything elevated is marked `isoOnly` so it **folds flat when you scan** — keeping the
top-down view a clean, high-contrast (scannable) code while the 3D view stays rich. To add
a world, write one `QRTheme` object and list it in `scene/themes/index.ts`.

### Notes / tuning
- **Shadows**: enabled in `lib/fiber-canvas.tsx` + `scene/Scene.tsx` (`SHADOWS`). If a device
  struggles, set `SHADOWS = false`.
- **`react-native-wgpu`** is young; versions here mirror the official Expo `with-webgpu`
  template. If the Simulator misbehaves, try a physical device.
