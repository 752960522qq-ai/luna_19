# Validation — 2026-10-16

- Both GLB files load in Chromium WebGL without JavaScript errors.
- Cody has 8 rendered material primitives; character 2 has 9.
- Original skinning and bones are preserved, with Run and Idle animation clips.
- Visual checks cover standing and running for both characters; the second character's original vertical offset was corrected.
- Blender evaluated all 22 samples: lowest mesh point stays at 0.018 m before final display normalization (see `grounding-report.json`).
- Browser movement checks confirm forward travel and animated playback; character switches and reset work.
- Android APK compiles against API 35; APK signature verification and manifest/package inspection pass.

No physical Android device or Android emulator is attached to this workspace. Installation, touch response, WebView behavior, and frame rate on the user's phone still require a device run. Browser software-renderer FPS is not a phone performance measurement.

The idle is a static original rest pose, not a newly authored idle animation. Retargeted running is a testing implementation; fingers, face and secondary cloth bones are preserved but do not receive newly authored animation.

## Color texture fix — source only

The Android response policy previously omitted `blob:` from `connect-src`. GLTFLoader's ImageBitmapLoader uses fetch for embedded texture blob URLs, so the policy blocked those requests even though `img-src` allowed blob images. Reproducing the original policy produced the reported white character and 45 console errors. Allowing blob connections restored color with no console errors.

The source now allows `connect-src 'self' blob:`. `scripts/check_textures.cjs` extracts the policy directly from MainActivity.java and loads both GLBs with that policy applied: Cody passes 8/8 color-textured materials; character 2 passes 9/9, with no browser errors. Run it with Playwright installed; optionally set `LUNA_CHROMIUM` to a Chromium executable.

No new APK was built for this source-only change. Android device validation remains pending.
