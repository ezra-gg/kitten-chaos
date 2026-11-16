# Kitten Chaos

A cozy browser physics puzzle. Two kittens are about to wake up. You get a few
moves to kitten-proof the apartment, then you watch what survives.

## Play online

Once GitHub Pages is enabled for this repository, the game is playable in any
modern browser at:

https://ezra-gg.github.io/kitten-chaos/

Nothing to install. Just open the link.

## How to play

Each level is a room with breakable things sitting on shelves. You have a small
number of moves to make it safe before the kittens wake up.

1. **Prep.** Spend your moves to protect the breakables. Depending on the level
   you may have these tools:
   - **Relocate:** drag an item to a safer spot. Some items, like a mug or a
     laptop, cannot be left on the floor.
   - **Putty:** stick an item down so the cats leave it alone.
   - **Box:** drop a cardboard box on the floor that a kitten climbs into and sits
     in for a while.
   - **Toy:** place a toy mouse that lures the nearest kitten away to play.
   - **Treat:** buy a treat, then during the chaos press the button to call both
     kittens to the bowl.
   - **Door:** close a cabinet to seal whatever is inside.
2. **Release the kittens.** They run wild for 30 seconds. You only watch, on the
   cat cam, with speed controls if you want to hurry along.
3. **Score.** You earn points for everything that survived, a bonus for unspent
   moves, and 1 to 3 stars based on how much of the room's value you saved.

Meet the cats. **Bargie** is the patient one who picks her moment and bats things
off edges. **Beano** is the rambunctious one who sprints around knocking things
over. They behave differently, so a good player learns their habits.

Your best score and stars for each level are saved in your browser.

## Play locally (Mac)

If you have the project folder and would rather run it yourself:

1. Open the folder and double-click `play.command`.
2. The first time, it sets everything up. After that it is quick.
3. The game opens in your browser. Close the little black window to stop it.

> The first launch may ask your permission to run. That is macOS being careful.
> Right-click `play.command`, choose **Open**, then **Open** again to allow it.

## For developers

**Prerequisite:** [Node.js](https://nodejs.org) version 20 or newer. If you use
`nvm`, run `nvm use` (the version is pinned in `.nvmrc`).

```bash
npm install      # download dependencies (first time only)
npm run dev      # start the dev server with hot reload
npm test         # run the Vitest suite
npm run build    # produce a static site in dist/
```

If you have [`just`](https://github.com/casey/just) installed, the `justfile` has
shortcuts (`just setup`, `just dev`, `just test`).

Pushing to `main` builds and deploys to GitHub Pages automatically through the
workflow in `.github/workflows/deploy.yml`.

### Tech stack

TypeScript, Vite, [Matter.js](https://brm.io/matter-js/) physics, and an HTML
Canvas 2D renderer, tested with Vitest. No backend, no accounts, and no network
calls. Everything runs locally in your browser.

## License

Copyright (c) 2026 Garrett Gregg. All rights reserved.

This project is source-available for viewing on GitHub, but it is **not** open
source. You may not copy, modify, distribute, host, or use any part of this code,
its assets, or its design, in whole or in part, without the author's explicit
prior written permission. All rights are reserved, including the right to release
a commercial version in the future. See the [LICENSE](./LICENSE) file for the full
terms.

Third-party components and their licenses are tracked in
[THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md). Everything that ships is
original work plus one permissively licensed library (Matter.js, MIT).
