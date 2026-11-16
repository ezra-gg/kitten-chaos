# Third-Party Licenses and Credits

This file tracks third-party components used in Kitten Chaos and their licenses.
It exists so that attribution is already handled for any distributed build,
including a future commercial release. Update it whenever a new dependency, font,
or asset is added.

Current status: everything that ships to players is either original work or the
one permissively licensed library below. There are no third-party art, audio, or
font assets.

## Bundled in the game (ships to players)

### Matter.js

A 2D physics engine. This is the only third-party library included in the built
game bundle.

- Version: 0.20.0
- License: MIT
- Project: https://brm.io/matter-js/
- Copyright (c) Liam Brummitt and contributors.

```
The MIT License (MIT)

Copyright (c) Liam Brummitt and contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Build and development tools (not shipped)

These tools are used to build and test the project. They are not included in the
distributed game, so they do not require attribution in a shipped product. They
are listed here for completeness. All are permissively licensed (MIT,
Apache-2.0, ISC, or BSD-3-Clause).

- Vite (MIT), the dev server and bundler.
- Vitest (MIT), the test runner.
- TypeScript (Apache-2.0), the language and compiler.
- esbuild (MIT) and Rollup (MIT), used internally by Vite.
- @types/matter-js (MIT), type definitions only.

A full scan of all installed packages found only MIT, Apache-2.0, ISC, and
BSD-3-Clause licenses. None are copyleft (GPL family) or non-commercial.

## Fonts

No fonts are embedded or distributed. The game uses the player's system font
stack (system-ui and platform defaults).

## Art and audio assets

None. All artwork (the cats, items, and UI) is original and drawn in code on an
HTML canvas. There is no audio.

When assets are added in the future, record each one here with its source,
author, and license, and confirm the license permits commercial use before
shipping. Public domain (CC0) assets are safe. Avoid anything marked
non-commercial.
