# 双人成鼠 0.3.0 — source validation

No APK is generated for this change. Validation uses Chromium with the exact response CSP extracted from the Android host.

## Scope

- Source syntax, Python authoring script syntax, and all six save/state unit tests pass.
- Prologue tutorial, M92 15+45 rounds, exactly one ten-live-enemy gift offer, decline/save/load and independent accept/300-round path.
- Runtime Cody cover sample: 60 hits in 200 attempts with seed 123; every hit deals 16.8 damage (24 × 70%). Configuration is a 35% independent hit probability; a finite sample is not an exact percentage.
- Exactly 60 spawned / defeated enemies including the two door enemies; ending dialogue, complete-state save/load and entry to the original first chapter.
- Immediate cancellation of the prior per-line Cody audio element before the next line starts.
- Existing chapter regression: touch cancellation, movement, ray hits, reload, per-enemy action save/load, alarm, battery, blackout, exit, ending and death/load.
- Offline audio audit: 31 SFX + 22 Cody voice clips decode and have a non-silent signal. Source URLs and slice ranges are in `audio-sources`.
- GLB map loading: the original character materials remain fully textured; firearm and cabin maps are checked under the same CSP.
- Model-rendered portraits, menu, birthday dialogue, door scene, pistol / rifle stance, gift choice, ending and next chapter are inspected as browser stills.

## Test method and limits

The browser suites use software WebGL. Functional tests keep game updates running and render one frame explicitly for each screenshot, at a reduced canvas resolution, to prevent CPU rendering from consuming the whole test timeout. Entrance / door clocks and horde spawn intervals are advanced in the integration tests; zombie defeat accounting goes through the actual damage method. This validates state transitions and representative rendered frames, not real-time device performance or a human playthrough of the entire wave.

No physical Android device or emulator is connected. Device FPS, audio latency, installation and Android-specific touch behavior still need a later device test. The previous APK does not contain this source update.

The supplied cabin model is the exterior establishing set. A separate 14 × 16 m cutaway interior provides room-scale movement, furniture collision and a breakable 2.8 × 2.7 m door. This is not navigation inside the unmodified cabin mesh. Characters are around 1.8 m tall.

The supplied Pistol Idle is a low-ready gesture; it is retained as PistolReady. Eye-level pistol aiming uses the already retargeted raised-arm Aim; the weapon model and muzzle position differ from the rifle. Aim is blended with lower-body running while moving. Floor contact is a flat-ground correction, not full foot IK. No facial performance or new finger animation is added.

Cody voice is generic synthesized Mandarin male speech, not the original actor's voice. Each existing Cody line has an offline MP3. The rifle appearance uses the user-supplied CAR-15 file; the gameplay name is Colt 723. Downloaded gun effects are representative recordings, not recordings of those exact firearm models.
