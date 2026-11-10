# Lattice — experimental development branch

This branch preserves experimental freeze-pane and native desktop work. It is not the supported release line and should not be used for release screenshots or distributed as a tested application.

For the browser/offline release, use [main](https://github.com/arsxd/lattice/tree/main) and the [Releases page](https://github.com/arsxd/lattice/releases).

Desktop builds on this branch run only through manual workflow dispatch. Internal development notes are not included in the current branch contents. Earlier Git history may still contain removed files.

Development: `npm ci`, `npm test`, `npm run offline:build`. Native development additionally needs Rust and platform prerequisites. Freeze behavior is known to be buggy and must be repaired and verified before consideration for main.
