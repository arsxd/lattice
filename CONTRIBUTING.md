# Development workflow

Read `docs/HANDOFF.md` before changing behavior. Preserve the Excel-first workflow and exact JSON numeric tokens. Do not substitute whole-document JSON.parse/stringify serialization for the text/AST engine.

1. Inspect the current working tree. Preserve local work and user files.
2. Install locked dependencies: `npm ci`.
3. Make a focused change and meaningful behavioral checks.
4. Run `npm test` and `npm run offline:build`.
5. For Rust changes, run `cargo test --locked --manifest-path src-tauri/Cargo.toml` and the relevant native build on the target OS.
6. Update the handoff with behavior, decisions, verified evidence and remaining gaps.

Browser permission prompts, clipboard interactions, focus/IME behavior, source scrolling and platform file replacement need real UI checks. Mock tests do not establish those behaviors. State the actual tested browser/OS in a pull request.

Do not commit `output/`, `dist/`, `node_modules/`, Rust targets, generated native schemas, local screenshots, recovery checkpoints, credentials or company datasets. Use synthetic fixtures in tests. Lockfiles, editable icons and workflow files belong in Git.

Before the first commit:

```sh
git status --short
git diff --check
git add README.md CONTRIBUTING.md CHANGELOG.md .gitignore .gitattributes .github assets docs scripts src src-tauri tests index.html package.json package-lock.json tsconfig.json vite.config.ts
git diff --cached --stat
git diff --cached --check
git commit -m "Initial Lattice development version"
```

Review the staged files before committing. No remote, branch upload or publication is configured by this guide. Select a project license before representing this as an open-source release.
