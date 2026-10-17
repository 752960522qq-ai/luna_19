# Unreleased — supplied cabin, zombie variants and Cody material correction (source only)

- Use the supplied log cabin for both exterior and playable ground floor; remove the surrogate room. Derive wall collision from the original mesh, extract its real entrance door for breaking, and preserve floor height / actor grounding.
- Add the supplied shirt zombie with a fitted rest skeleton and skin weights; randomly select between two distinct character models and retain that choice in saves.
- Retarget the two supplied Zombie Idle files and Running(2) movement source. Correct the bind wrapper, torso / foot axes and anatomical head frame; smooth the baked leg cycle and derive the second movement rhythm without pose resampling.
- Disable obsolete runtime rig corrections for the reauthored zombies. Funnel enemies through the actual entrance.
- Correct all eight Cody materials from alpha blend to opaque, fixing see-through skin, missing-looking eyes and clothing sorting. Refresh portraits.
- Add actual cabin, variant persistence, opaque material and full-cycle movement regression coverage. No APK generated.

# Unreleased — rifle locomotion and Cody overlap correction (source only)

- Retarget the uploaded Rifle Idle / Rifle Run FBX clips to both May and Cody as RifleIdle / RifleRun.
- Select the new poses for an armed Colt 723; preserve pistol, unarmed, aiming and dialogue states.
- Maintain both hands on the rifle during running instead of attaching it to a freely swinging right hand.
- Use a two-frame seam for the 21-frame rifle run, preserving the authored gait.
- Separate Cody from May during following and after overlapping saves; sample collision corrections in small steps and try alternate free sides near walls.
- Preserve existing mesh, skin, texture and animation data; character GLBs remain within 20–30 MB.
- No APK generated.

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
