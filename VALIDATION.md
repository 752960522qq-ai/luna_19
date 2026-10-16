# 双人成鼠 0.2.0 — source validation

The current change expands the earlier movement test into chapter one of a story/shooter prototype. No APK is built for this change.

## Checks

- Source modules pass JavaScript syntax checks.
- Save tests cover per-instance random animation choices, stable round trips including random seed, malformed saves, numeric bounds, and storage failure.
- All character color materials load under the exact Android CSP: Cody 8/8, May 9/9, zombie 5/5, with no console errors. The CSP includes `connect-src 'self' blob:` for GLTFLoader's embedded texture fetches.
- Browser integration covers menu startup, opening dialogue, May movement, aiming, shots consuming ammo and damaging a target, reload, Cody's alarm event, the first wave, battery pickup, blackout event and second wave, the exit lock, chapter completion, save/load with unchanged enemy action choices, and death/load.
- Visual checks cover the menu, dialogue, aim stance, zombie idle/movement, and chapter scene. Character display scale and foot height are normalized at runtime, including animation transitions.

## Limits

There is no connected physical Android device or emulator. Browser validation does not establish Android touch behavior, device FPS, or install compatibility. The previous APK predates this source change and still needs a later rebuild to include it.

This version is one playable chapter, not a full multi-chapter game. The story uses text and animation without recorded voices. Zombies use one skinned model, two supplied idle sources, and an original movement clip plus a retimed movement variant. Their individual choices stay fixed after spawning and after restoring a save.

Floor contact is a flat-ground correction rather than a full foot IK system. Aim and Talk are retargeted to the existing character rigs, with no new facial or finger performance. The weapon is a procedural toy rifle, not a supplied licensed firearm model.
