# 0.3.1 — model rig corrections

- Correct the reversed firearm forward axis; set real grip pivots and geometry-derived muzzle positions.
- Add per-character weapon sizing, two-bone arm IK, wrist alignment and finger grip poses.
- Keep the aiming pelvis orientation when layering locomotion; reduce sprint leg lift for moving aim.
- Correct the zombie pelvis / neck basis, retain world-space limb poses and normalize from the corrected reference stance.
- Ground animated mesh soles instead of ankle joints; stabilize horizontal root drift.
- Blend animation changes over 140 ms and retire faded actions; use unarmed idle in the menu.
- Add three tests exercising actual model geometry, skeletons, weapon grips and repeated transitions.

# 0.3.0 — 生日礼物（source only）

- Add cabin prologue, model-based portraits, entrance / door camera cuts and interruptible per-line Cody voice.
- Retarget uploaded human Idle and PistolAim to May and Cody; add actual M92 / CAR-15 models and independent ammunition.
- Give 60 pistol rounds; tutorial movement / fire / reload; escalate to one gift decision at ten live zombies.
- Accept grants 723 with 300 rounds; reject resumes immediately. Exactly 60 total enemies including the two door enemies.
- Cody shoots with 35% accuracy and 70% same-weapon damage.
- Add downloaded CC0 effects, edited slices, offline playback, source links and time-range manifest.
- Persist prologue branch, tutorial, spawn / defeat counters and inventory; migrate old chapter-one saves.
- Add prologue end save / next chapter / menu; keep existing warehouse chapter.
- No APK generated.

# 0.2.0 — 双人成鼠

- Replace character-switching test with a May-controlled story/shooter chapter.
- Add AI Cody follow/cover behavior and two scripted "helpful" pranks.
- Add the main menu, validated local saves, pause menu, checkpoints and death/load.
- Add Aim/Talk to both characters and two idle / two movement choices for zombies.
- Select each zombie's idle, movement and pace once and retain them in saved games.
- Add aiming, continuous firing, hit detection, reload, ammo/health pickups and exit objectives.
- Keep offline assets and the corrected Android texture CSP.
- Source only; no new APK.
