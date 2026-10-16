# Audio sources and processing

All downloaded sound effects below are published as CC0. The game embeds only the selected, edited slices. The original packs can be downloaded again from these links; `audio-slices.csv` gives the exact source filenames, time ranges and measured levels. `scripts/prepare_audio.py` reproduces the trimming, mono conversion, peak normalization, 5 ms edge fades and MP3 encoding.

| Source / author | Source page | Used for |
|---|---|---|
| Zombies Sound Pack / artisticdude | https://opengameart.org/content/zombies-sound-pack | Idle groans, attack, hurt and death variants |
| Gunshot Sounds / Tabasco | https://opengameart.org/content/gunshot-sounds | CZ pistol recording for M92; SKS rifle recording for 723 (representative effects, not recordings of those exact guns) |
| Gun reload sounds / SpringySpringo | https://opengameart.org/content/gun-reload-sounds | Pistol and rifle reload |
| Impact Sounds / Kenney | https://kenney.nl/assets/impact-sounds | Wood/concrete steps, wood/metal/glass impacts, door knocks and break, equip, empty click, pickup, UI, save, console |

Download URLs:
- https://opengameart.org/sites/default/files/zombies.zip
- https://opengameart.org/sites/default/files/sounds.zip
- https://opengameart.org/sites/default/files/gunreload1.wav
- https://opengameart.org/sites/default/files/assaultriflereload1_0.wav
- https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip

## Voice (separate from downloaded SFX)

The twelve prologue Cody lines are generic Mandarin synthesized male speech (`zh-CN-YunxiNeural`), not the actor's original performance. Each line is an independent offline MP3. `web/assets/audio/voice/manifest.json` preserves the exact script. Dialogue cancels the previous audio element before starting the next line, including on skip, menu, pause and death. The existing first chapter Cody lines also have individual offline MP3 files. Device speech synthesis is a fallback for future lines without a supplied clip.

## Object / event coverage

| Event / material | SFX key |
|---|---|
| M92 / 723 shot | pistol / rifle |
| Reload | reloadpistol / reloadrifle |
| Empty, equip, ejected case | empty / equip / metal |
| Cabin floor / warehouse floor | stepwood0–2 / stepstone0–2 |
| Wood / metal / glass shot impact | wood / metal / glass |
| Cabin door knock / destruction | door / break |
| Zombie idle / attack / hurt / death | zombie0–2 / zombie3 / zombie4–5 / zombie6–8 |
| Player hit | hurt |
| Gifts, ammunition, medicine, battery | pickup / equip |
| Console, exit power, menu, save | console / metal / ui / save |

Audio concurrency is capped at 20 SFX, with distance attenuation and per-zombie groan cooldowns. Voice is separate and always interruptible.
