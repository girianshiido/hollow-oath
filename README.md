# Hollow Oath

Hollow Oath is a single-player illustrated dark-fantasy RPG. The interface, guide, spells and encounters are in English. It is built for a portrait phone screen, with keyboard and mouse controls on desktop.

- Four classes with different starting attributes and growth per level. Choose a character name when beginning or rename it under Armory → Character. Tap the avatar there to enlarge it.
- Thirty-two waves, 1,024 encounters and 32 illustrated guardians.
- A new illustrated creature joins the regular encounters every four waves, from Wickstalker in wave 4 to Glaivehorn Sentinel in wave 32. Earlier arrivals return in rotating palettes.
- Automatic combat with separate clocks for the hero and enemy. Speed measures attacks per second. Attack rolls vary by ±12%, and monster families have distinct physical and magical defenses.
- Each weapon rank below the current wave halves outgoing steel and spell damage: rank 12 in wave 13 gives 50% power, then 25% in wave 14. Equipping a current-rank weapon restores full offensive power. Healing and Aegis are unaffected. The arena and Character page show this ratio. Buying a higher-rank normal weapon credits the price of your best previously purchased normal weapon; your collection is kept.
- Six equal action buttons directly select steel, Ember Bolt, Mend, Rime Lance, Storm Sigil and Aegis. Hold a spell (or right-click / Shift+Enter) to pause and inspect its description, current level and MP cost. Keys 1–6 select actions. Locked spells remain visible with unlock instructions. Low MP returns to steel.
- Ember Bolt is available from level 1. Mend unlocks at 2, Rime Lance at 4 and Storm Sigil at 7. Seals are broken by the indicated spell or a steel strike. Guardians change seals and weaknesses at HP thresholds, with up to five phases. Only one action has the active frame; a ! marks the action needed for a seal; underlevelled arrivals never face a seal requiring a locked spell.
- Some foes take 70% less damage from an element, are immune to it, or take 50% more damage from a weakness. The arena displays these affinities. The original spells can still break every seal.
- Marked foes and guardians grant Arcane Essence on their first defeat. The Workshop and Shop open only after a defeat, before retrying. Spend Essence to learn Aegis and improve all five spells up to level 10. Rank caps follow campaign progress: level 1 in wave 1 through level 10 in wave 32. Higher levels increase MP costs; the highest learned level is always used. Thunder Verdict has been retired; old purchases and upgrades are refunded in Essence, and historical casts still count toward achievements.
- Aegis reduces physical and magical damage by 30% for five enemy attacks at level 1, rising to 45% for eight attacks at level 10. Casting returns to steel. Charges survive spell changes and encounters; a new wave clears them. Remaining charges cannot stack or be refreshed.
- Ordinary enemy spells use the normal Speed clock and strike without an additional preparation turn. Boss spells and special attacks keep a visible 1.8-second preparation; ordinary heavy blows prepare for 1 second. Preparing enemies cannot attack until the prepared action resolves. Rime can delay a preparation by at most 0.6 seconds total. Enemy frost delays the next player action, and lightning pierces some magic defense. Some bosses cast Mend at most twice or drain life based on actual HP lost, so Aegis also reduces their recovery. Total enemy recovery is capped at 18% of maximum HP per encounter, and healing cannot restore a cleared phase.
- Existing saves migrate when loaded. They retain their hero, equipment, battle and XP and receive Essence for already cleared guardians.
- Victory advances immediately after the defeat animation. HP carries between encounters and refills when starting a wave. Falling restarts the current wave at encounter 1 and preserves experience, gold and gear. The final boss leads to a musical epilogue and a class-specific ending illustration. Loading a completed save replays the ending.
- Open the armory with the top-left button. The Shop opens after a defeat, before retrying. Its Auto-equip purchases checkbox can equip each purchase immediately. It sells weapons, armor, shields, helmets, boots and rings, with names and relic titles tailored to your class. Some guardians drop relics. The top-right button opens the pause menu.
- Select Play music on the title screen to start audio. The score changes for combat, defeat and the ending. A silent prologue follows character naming. Open the pause menu to mute music and effects, adjust the volume, or hear a test strike. The settings are saved on this browser. See [sound credits](AUDIO.md).
- Local autosaves with no fixed number of files. Delete old saves from Load Game. Use Export backup in the pause menu and Import a backup on the Load Game screen to move an oath between devices or browsers.

The Achievements page on the title screen and in Options shares progress across all adventures on this device. Totals accumulate across files and records keep their best result. Deleting a save keeps its achievements. Timed challenges require a new game and count active combat, transitions and failed attempts. Menus and defeat screens pause the timer. Existing saves credit milestones supported by their saved data.

## Run locally

Install Node.js 22.18 or later. In this directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server prints a local URL. For a production build and a preview of the installed game:

```sh
pnpm test
pnpm build
pnpm preview
```

The production build also writes `release/Hollow-Oath.html`, a self-contained edition you can open directly in a desktop browser. It contains the game and all its art.

Publish the contents of `dist/` on a static HTTPS host, including GitHub Pages. Relative asset URLs and the service worker support hosting at a repository subpath. Offline play becomes available after the service worker finishes downloading the game. The pause menu reports the offline cache state. Use **Check for updates** on the title screen or in Options to download a new release, then **Install update** to save the current game and reload. Publishing a new release preserves the local files on the same web address.

GitHub Actions builds and deploys the game after each push to `main`. The repository's Pages publishing source is set to **GitHub Actions**.

On iPhone, the browser's Add to Home Screen action installs the app.

## Implementation

`src/content.ts` defines class growth, spells, encounters and gear. `src/engine.ts` handles battle timing, rewards and wave transitions. `src/saves.ts` validates and reads versioned saves. `src/main.ts` and `src/style.css` implement the screens and controls. `src/graphics.ts` draws combat effects on a Canvas overlay. `scripts/build-sw.mjs` creates a content-versioned offline cache. See [ART.md](ART.md) for the illustration prompts.

## Tactical regression checks

`pnpm test` checks combat clocks, multi-phase seals, limited boss recovery, Aegis charges, ten-level upgrades and legacy-save migration. Run `node scripts/simulate-tactics.mjs` for deterministic full-campaign tactical simulations with all four classes. These use an automated strategy and are not human completion-time estimates. `node scripts/benchmark-encounters.mjs` measures retaliation and hit counts for fixed level/wave/equipment scenarios. Ordinary enemies gain up to 30% additional HP progressively from wave 4; their strength depends on their wave, never the hero’s level.
