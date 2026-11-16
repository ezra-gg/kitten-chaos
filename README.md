# 🐱 Kitten Chaos

A cozy browser physics puzzle. Two kittens are about to wake up. You get a few
moves to kitten-proof the apartment, then you watch what survives.

---

## Just want to play? (Mac)

1. Download this folder and unzip it.
2. Open the folder and **double-click `play.command`**.
3. The first time, it sets everything up (a few minutes). After that it's quick.
4. The game opens in your web browser. To stop playing, close the little black
   window that opened.

> The first launch may ask your permission to run - that's macOS being careful.
> Right-click `play.command`, choose **Open**, then **Open** again to allow it.

That's it. Everything the game needs is downloaded automatically.

---

## For developers

**Prerequisite:** [Node.js](https://nodejs.org) version 20 or newer.
(If you use `nvm`, run `nvm use` - the version is pinned in `.nvmrc`.)

```bash
npm install      # download dependencies (first time only)
npm run dev      # start the dev server with hot reload
npm test         # run the Vitest suite
npm run build    # produce a static site in dist/
```

If you have [`just`](https://github.com/casey/just) installed, there are
shortcuts in the `justfile` (`just setup`, `just dev`, `just test`, ...).

### Tech stack

TypeScript, Vite, [Matter.js](https://brm.io/matter-js/) physics, and an HTML
Canvas 2D renderer, tested with Vitest. No backend, no accounts, no network
calls. Everything runs locally in your browser.
