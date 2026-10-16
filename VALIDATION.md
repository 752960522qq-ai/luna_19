# Rifle locomotion / Cody correction — source validation

No APK was generated for this update. Android device validation remains outstanding.

- `npm test`: 13 tests pass, including six sampled phases per rifle clip for both real skinned characters, sole contact, torso height, muzzle direction, both-hand support and weapon/dialogue selection.
- Companion tests cover identical/overlapping positions, alternate free sides, fully blocked corrections and thin-wall path sampling.
- `tests/rifle-smoke.cjs`: eight actual textured pose renders; overlapping Cody/player positions separate to at least 1.05 m; zero page errors.
- `tests/story-smoke.cjs`: original chapter progression, input, hits, reload, save/load and death/load pass.
- `tests/prologue-smoke.cjs`: tutorial, gift branches, sixty-enemy ending and next chapter pass.
- `scripts/check_textures.cjs`: both characters, zombie, both guns and cabin pass.
- Original nodes, meshes, skins, materials, images and animations compare unchanged against the preceding revision; original binary data is preserved. New animation channels are appended.
- Cody GLB: 27,236,392 bytes. May GLB: 26,454,540 bytes.

Visual inspection uses the real renderer and textures, including comparison with Cody's supplied RestPose and original Run. This corrects player/companion overlap and unsupported rifle running; it does not replace the supplied character mesh or add facial animation. Flat-floor sole correction is not uneven-terrain foot IK.

## Previous 0.3.1 validation (historical)

# 双人成鼠 0.3.1 — source validation

A signed APK is built for this change. Validation uses Chromium with the exact response CSP extracted from the Android host.

## Scope

- Source syntax, Python authoring script syntax, and all nine save/state/model-rig tests pass.
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

The supplied Pistol Idle remains PistolReady. Aim provides the underlying body gesture; two-bone arm IK, wrist alignment and procedural finger curling now place the hands on each firearm. Moving aim uses a reduced-amplitude leg cycle and preserves the aiming pelvis rotation. Sole sampling corrects flat-ground contact; it is not terrain foot IK. There is no new facial performance.

Cody voice is generic synthesized Mandarin male speech, not the original actor's voice. Each existing Cody line has an offline MP3. The rifle appearance uses the user-supplied CAR-15 file; the gameplay name is Colt 723. Downloaded gun effects are representative recordings, not recordings of those exact firearm models.

## 0.3.1 model regression

- Actual GLB geometry tests cover all four zombie clips across five phases, corrected head / pelvis alignment, model height, floor penetration and skinned sole contact.
- Both characters, both weapons and stationary / moving aim are tested for grip distance, forward muzzle direction, finite transforms and repeated IK updates without drift.
- Repeated idle / run / moving aim / talk transitions verify that faded actions are retired.
- Before / after inspection uses the real textured models in fixed cameras; no generated replacement imagery.
- Original imported topology, textures and skin weights are preserved. Corrections live in the runtime rig and animation layer.

0.3.1 result: all nine state/model tests, full prologue smoke, Cody cover sample, original chapter smoke and death/load pass. Head-dominant skinned vertices are checked above the neck to catch collapsed-head regressions.
