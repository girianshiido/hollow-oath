# Hollow Oath

Hollow Oath is a single-player illustrated dark-fantasy RPG. The interface, guide, spells and encounters are in English. It is built for a portrait phone screen, with keyboard and mouse controls on desktop.

- Four classes with different starting attributes and growth per level.
- Thirty-two waves, 1,024 encounters and 32 illustrated guardians.
- Automatic combat with separate clocks for the hero and enemy. Speed measures attacks per second.
- Switch between sword and grimoire while fighting. Hold the grimoire or tap its caret to choose a spell. Keyboard shortcuts are 1 for sword, 2 for grimoire and 3 for the spell list.
- Ember Bolt is available from level 1. Mend unlocks at 2, Rime Lance at 4 and Storm Sigil at 7. Seals are broken by the indicated spell or a steel strike. Some guardians add new seals at HP thresholds.
- Victory advances immediately after the defeat animation. HP carries between encounters and refills when starting a wave. Falling restarts the current wave at encounter 1 and preserves experience, gold and gear. The final wave is replayable.
- Open the armory with the top-left button. The shop sells weapons, armor, shields, helmets, boots and rings. Some guardians drop relics. The top-right button opens the pause menu.
- Three local autosave files. Use Export backup in the pause menu and Import a backup on the Load Game screen to move an oath between devices or browsers.

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

Publish the contents of `dist/` on a static HTTPS host, including GitHub Pages. Relative asset URLs and the service worker support hosting at a repository subpath. Offline play becomes available after the service worker finishes downloading the game. The pause menu reports the offline cache state. Use **Check for updates** to download a new release, then **Install update** to save the current game and reload. Publishing a new release preserves the three local files on the same web address.

GitHub Actions builds and deploys the game after each push to `main`. The repository's Pages publishing source is set to **GitHub Actions**.

On iPhone, the browser's Add to Home Screen action installs the app.

## Implementation

`src/content.ts` defines class growth, spells, encounters and gear. `src/engine.ts` handles battle timing, rewards and wave transitions. `src/saves.ts` validates and reads versioned saves. `src/main.ts` and `src/style.css` implement the screens and controls. `src/graphics.ts` draws combat effects on a Canvas overlay. `scripts/build-sw.mjs` creates a content-versioned offline cache. See [ART.md](ART.md) for the illustration prompts.
