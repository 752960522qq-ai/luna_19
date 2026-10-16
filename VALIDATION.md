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
