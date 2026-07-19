# HTML5 Arcade Starter

A minimal, portal-ready HTML5 game skeleton built with **Phaser 3 + TypeScript + Vite**.
It ships **zero external art assets** — every visual is a Phaser-generated texture or
rectangle, so it runs on a clean clone with nothing to download. **Two** playable
mini-games (**Tap Jumper** and **Stack Tower**) share one lifecycle: boot → preload →
game-select menu → gameplay → game over → replay, with a pluggable portal-SDK seam and a
real **CrazyGames SDK v3** integration already wired in.

## Run

```bash
npm install
npm run dev       # open the printed localhost URL
npm run build     # typechecks (tsc --noEmit) then emits static dist/
npm run preview   # serve the built dist/ locally
```

`npm run build` fails on any TypeScript error (strict mode).

## Play

The menu is a **game-select** screen — one button per game, each showing that game's own
high score. Pick a game by **tapping/clicking** it, or with the keyboard: **↑/↓** to move
the selection + **Space/Enter** to start, or press the game's **number key** (1, 2, …).
Every high score persists per-game across reloads.

- **Tap Jumper** — tap / click / press **Space** to jump. Avoid the red obstacles
  scrolling in from the right; clear one to score. Speeds up the longer you survive.
- **Stack Tower** — a block sweeps left-right across the top; tap / click / press **Space**
  to drop it onto the tower. The overlapping part stays, any overhang is sliced off (the
  block shrinks). Miss the tower entirely and it's game over. +1 per stack; the sweep speeds
  up and the tower scrolls up as it grows.

From the **Game Over** screen: **Play Again** (Space) restarts the same game, **Menu**
(Esc) returns to game-select, **Continue (watch ad)** exercises the rewarded-ad seam.

## Project structure

```
html5-arcade-starter/
├── index.html                # full-viewport canvas, touch-action:none, loads /src/main.ts
├── vite.config.ts            # base:"./" (relative paths — required for portal zip uploads)
├── tsconfig.json             # TypeScript strict
├── public/assets/            # empty today — demo is 100% generated textures
└── src/
    ├── main.ts               # builds Phaser.Game, creates the SDK, stores it on the registry
    ├── vite-env.d.ts         # typing for import.meta.env (VITE_SDK_PROVIDER)
    ├── config/
    │   ├── gameConfig.ts     # scale (FIT + CENTER_BOTH), physics, scene list
    │   ├── games.ts          # GameId + GAMES registry (id, title, sceneKey)
    │   └── constants.ts      # all tuning values (dims, colors, gameplay, storage, SDK)
    ├── scenes/
    │   ├── BootScene.ts       # earliest setup, awaits sdk.init() → Preload
    │   ├── PreloadScene.ts    # progress bar + generates demo textures → Menu
    │   ├── MenuScene.ts       # game-select: per-game buttons + high scores
    │   ├── GameScene.ts       # the Tap Jumper mini-game
    │   ├── StackScene.ts      # the Stack Tower mini-game
    │   └── GameOverScene.ts   # game-aware result + play-again / menu / rewarded continue
    ├── objects/
    │   ├── Player.ts          # the jumper (generated texture)
    │   └── Obstacle.ts        # scrolling obstacle
    ├── systems/
    │   ├── SaveSystem.ts      # localStorage per-game high scores (typed, migrating)
    │   └── AudioManager.ts    # thin audio stub
    └── sdk/
        ├── IGameSDK.ts        # the portal SDK interface (optional async init())
        ├── NoopSDK.ts         # default console-logging impl (used in dev)
        ├── CrazyGamesSDK.ts   # real CrazyGames SDK v3 wrapper (guarded no-op off-portal)
        └── SDKManager.ts      # createSDK() factory — the single portal seam
```

## The portal SDK seam

All portal integration lives in `src/sdk/`. The game logic never references a specific
portal — every scene reads the SDK via `this.registry.get("sdk") as IGameSDK`, so swapping
the impl needs no gameplay changes. Three impls exist:

- **`NoopSDK`** — default, console-logging, network-free. Used by `npm run dev`.
- **`CrazyGamesSDK`** — real CrazyGames SDK v3 wrapper (see below).
- Poki — a commented stub in `SDKManager.ts` shows exactly where a `PokiSDK` case goes.

The provider is chosen in `createSDK()` from **`VITE_SDK_PROVIDER`** (build-time env), with
the `SDK_PROVIDER` constant in `constants.ts` as fallback (default `"noop"`). `BootScene`
`await`s the SDK's optional `init()` before the game continues, so async SDKs are ready.

Method mapping:

| `IGameSDK` method      | Poki (stub)               | CrazyGames v3                       |
| ---------------------- | ------------------------- | ----------------------------------- |
| `init()`               | `PokiSDK.init()`          | `SDK.init()` (awaited in Boot)      |
| `gameLoadingStart()`   | —                         | `SDK.game.loadingStart()`           |
| `gameLoadingFinished()`| —                         | `SDK.game.loadingStop()`            |
| `gameplayStart()`      | `PokiSDK.gameplayStart`   | `SDK.game.gameplayStart()`          |
| `gameplayStop()`       | `PokiSDK.gameplayStop`    | `SDK.game.gameplayStop()`           |
| `showRewarded()`       | `PokiSDK.rewardedBreak`   | `SDK.ad.requestAd("rewarded", …)`   |
| `showInterstitial()`   | `PokiSDK.commercialBreak` | `SDK.ad.requestAd("midgame", …)`    |

## Build for CrazyGames

```bash
VITE_SDK_PROVIDER=crazygames npm run build
```

This selects `CrazyGamesSDK` at build time. It dynamically injects the SDK v3 script
(`https://sdk.crazygames.com/crazygames-sdk-v3.js`) during `init()` — **only** when this
provider is active — so a plain `npm run dev` stays clean (NoopSDK, no script, no console
noise). Off-portal (local, or the script fails to load) `window.CrazyGames` is absent and
every call degrades to a guarded no-op; ad promises resolve safely and never reject the
game loop.

Then deploy the zipped `dist/` (see below). Note CrazyGames' **exclusivity / self-serve**
policy: submissions go through the [CrazyGames Developer Portal](https://developer.crazygames.com/),
and monetization (the ads wired here) requires the game to be approved and, for revenue
share, to honor their exclusivity terms — read the current developer docs before shipping.

## How to add a 3rd game

1. Create the scene, e.g. `src/scenes/MyGameScene.ts`, with a unique scene key in its
   `super("MyGame")` call. It should read its `gameId` and, on game over, call
   `this.scene.start("GameOver", { gameId, score, highScore, isNewBest })` — copy the
   `endRun()` shape from `StackScene.ts`.
2. Register the scene in `gameConfig.scene`.
3. Add a row to the **`GAMES`** registry in `src/config/games.ts`
   (`{ id: "mygame", title: "MY GAME", sceneKey: "MyGame" }`) and add `"mygame"` to the
   `GameId` union. The menu button, keyboard shortcut, and per-game high score all appear
   automatically.

Reuse Boot / Preload / Menu / GameOver and all systems (SaveSystem, AudioManager, the SDK)
as-is.

## Monetization notes

- `showInterstitial()` fires on **every game over** (in each game's `endRun()`), awaited
  before transitioning to the GameOver scene. Portals rate-limit interstitials
  automatically — no manual throttle needed in code.
- `showRewarded()` fires from the GameOver "CONTINUE (watch ad)" button. In this starter,
  a granted reward simply restarts the run (a placeholder); a real game would revive the
  player mid-run instead.

## Deploy to a portal

```bash
npm run build
```

Zip the **contents** of `dist/` (with `index.html` at the zip root — this is why
`vite.config.ts` uses `base: "./"`), then upload the zip to the portal dashboard
(Poki, CrazyGames, GameDistribution, etc.).
