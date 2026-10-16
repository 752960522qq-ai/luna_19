# Luna 19 · Character Movement Test

Offline Android movement playground built with Three.js and an Android WebView shell. No Unity installation, account, external content server, or runtime network access is needed.

## Controls

- Left virtual stick: camera-relative movement. WASD / arrow keys also work on desktop.
- Drag the right half of the screen: orbit the camera.
- Sprint button: toggle between 3.2 m/s and 5.3 m/s.
- Character tabs: switch Cody / character 2.
- Run preview: loop the supplied run in place.
- Reset: return to the center.

The scene includes obstacles, collision checks, a 24.6 m movement boundary and a light contact shadow. Characters use the supplied original skins and textures, existing skeletons, a retargeted 22-frame run, and a static rest-pose idle. Both are displayed at the same standing height. Run root translation is removed; the movement controller owns displacement.

## Android

Package `com.luna.movement`, version `0.1.0`, min Android 8 / API 26, target API 35. Contains no native shared libraries, so it does not depend on a 32-bit CPU runtime. Requires OpenGL ES 3 and a current Android System WebView. Landscape orientation; all game assets are packaged inside the APK. No Android permissions are requested.

Build with `scripts/build_apk.sh`. Supply Android SDK Platform 35, Build Tools 35.0.1 and JDK 17 using `LUNA_SDK`, `LUNA_BUILD_TOOLS`, `LUNA_JAVAC`, and an external development keystore path in `LUNA_KEY`. The build uses javac, D8, aapt2, zipalign and apksigner directly, with no Gradle dependency download. Test certificate credentials are `android`; this is a development APK, not a store release.

```bash
LUNA_SDK=/path/to/sdk \
LUNA_BUILD_TOOLS=/path/to/sdk/build-tools/35.0.1 \
LUNA_JAVAC=/path/to/jdk/bin/javac \
LUNA_KEY=/path/outside/repo/luna19-test.keystore \
  bash scripts/build_apk.sh
```

For browser use: `python3 -m http.server 8080 --directory web`.

## Asset processing

`web/assets/*_run.glb` are the finished skinned assets. `scripts/retarget.py` and `scripts/fix_grounding.py` record their Blender processing. They expect the original compressed GLBs and supplied Running FBX in the source workspace; the original source archive is not required to run or build this project. Bone maps preserve the existing skin weights and secondary bones, while mapping 22 body bones. Foot height is corrected per sample to avoid sinking/floating. The first and last run samples match for looping.

Three.js is included locally under its MIT license (`web/vendor/LICENSE-THREE.txt`). Character assets and animation were provided by the user; original character rights remain with their respective owners. This repository does not assert a new license over those assets.

## Validation

See `VALIDATION.md` for results and remaining device checks.
