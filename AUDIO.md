# Sound credits

The following OpenGameArt sounds are used under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

| Hollow Oath cues | Source | Artist |
| --- | --- | --- |
| Three sword strikes, blocked strike and defeat | [20 Sword Sound Effects (Attacks and Clashes)](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes) | StarNinjas |
| Ember Bolt | [Fireball](https://lpc.opengameart.org/content/fireball-1) | Julien Matthey |
| Rime Lance and seal break | [Ice spells](https://lpc.opengameart.org/content/ice-spells) | bart |
| Storm Sigil | [Spell sounds](https://lpc.opengameart.org/content/spell-sounds) | Augmentality (Brandon Morris) |
| Mend | [Cure Magic](https://opengameart.org/content/cure-magic) | Someoneman |
| Incoming hit and reward | [Rpg Sound Effect Pack](https://opengameart.org/content/rpg-sound-effect-pack) | Delta12 Studio |

Cues were edited for timing and levels, with EQ and pitch adjustments as needed. The game includes twelve short Ogg Vorbis files, with matching AAC encodes for older Safari versions. The offline cache and portable HTML include the sound effects.

## Original score

Seven original instrumental pieces were rendered from the MIDI scores in `music/` using FluidSynth 2.6 and the local `MuseScore_General_HQ.sf2` soundfont. The stereo masters run at 48 kHz. The game uses Ogg Vorbis, with AAC versions for browsers that cannot decode Ogg.

| Scene | Piece | Playback |
| --- | --- | --- |
| Title | Ashes Around the Eclipse | 72 seconds. Harp, cello and English horn with a fade before the restart. |
| Combat | Iron Through the Hollow | 76.8 seconds. Cello ostinato, brass and drums. The loop is cut from a repeated render and blended across the seam. |
| Chapter guardians, waves 4–28 | The Thirty-Two Chains | 168 BPM; 74.286 seconds. A 5.714-second opening leads to a 68.571-second loop. Horn motif, cello ostinato, spiccato strings, low brass, organ, timpani, orchestral drums and bells. |
| Final guardian, wave 32 | A Crown Without a King | 176 BPM; 70.909 seconds. A brighter, higher-tension variation with a 5.455-second opening and 65.455-second loop. |
| Chronicle interludes and the awakening | Between the Names | 76 BPM; 50.526 seconds. Quiet piano, harp, English horn, cello and veiled strings. A steady-state loop retains the reverb across its seam. |
| Defeat | After the Last Bell | 64 seconds. Piano, cello and bell with a fade before the restart. |
| Ending | The Dawn Remembers | 104 seconds. A lyrical horn and flute theme with strings, harp, piano and celesta. A final resolution fades before the restart. |

The ending score is reproducible with `python3 scripts/compose-ending.py`. The prologue is silent; the ending theme begins with the victory epilogue and continues through The End. All music follows the global mute and volume settings.

The two boss scores are editable in `music/the-thirty-two-chains.mid` and `music/a-crown-without-a-king.mid`. Generate them with `python3 scripts/compose-chapter-boss.py`, then render with `python3 scripts/render-chapter-audio.py` (numpy, FluidSynth, ffmpeg and the local HQ SoundFont are required). These are original MIDI-synthesized instrumental tracks. Each score has nine musical parts, 2,810 notes and no same-pitch overlaps. Two complete passes are synthesized before mastering, then the second pass supplies the loop body with a 35 ms seam blend. The opening plays once; Web Audio loops only the body. Stereo 48 kHz masters have peaks below −2.8 dBFS. `music-chapter` and `music-final-boss` ship in both OGG and AAC, and are included in the offline cache and portable edition. The next chapter track is prefetched near the boss when music is enabled.

The Chronicle interlude is reproducible with `python3 scripts/compose-interlude.py` (numpy, FluidSynth, ffmpeg and the same local HQ SoundFont). Its editable score is `music/between-the-names.mid`; the generator validates 200 notes across five musical parts without same-pitch overlaps before rendering. The game includes `music-interlude.ogg` and `music-interlude.m4a` in the offline cache and portable HTML. Three passes are rendered; the second supplies a stable loop with a 35 ms seam blend. `music/interlude-report.json` records the decoded OGG peak (−5.46 dBFS), stereo 48 kHz format and seam jump (0.00184). Web Audio handles fade-in and crossfades back to combat. Reading and the permanent-power choice never advance combat time. All mute and separate-volume settings apply to this original MIDI-synthesized instrumental music.
