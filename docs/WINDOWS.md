# Windows build and installation

Status as of 2026-11-09: **Windows build, installation and runtime remain unverified.** This workspace is on macOS and has no Git remote configured. No Windows installer is included in the handoff. The macOS ZIP cannot run on Windows.

## Build on a Windows machine

1. Install Node.js 24 or newer, Rust stable with the MSVC toolchain, Microsoft C++ Build Tools with **Desktop development with C++**, and WebView2 as described in the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/#windows).
2. Copy the project source, including `package-lock.json` and `src-tauri/Cargo.lock`, to Windows. Do not copy macOS `node_modules`, `dist`, or `src-tauri/target`.
3. Open PowerShell in the project directory and run each command. Stop on any failure:

```powershell
npm ci
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
Get-ChildItem .\src-tauri\target\release\bundle\nsis\*-setup.exe
```

The last command lists the expected setup executable after a successful build. Run that installer, then launch JSON Workbench. To run the application during development instead, use `npm run desktop`.

This follows Tauri's [Windows installer build path](https://v2.tauri.app/distribute/windows-installer/). Building on Windows keeps compiler, bundler and platform file-operation checks on the target OS. There is no signing certificate configured in this project.

## CI route

The repository contains `.github/workflows/desktop.yml`. Once the repository is hosted on GitHub with Actions enabled, it can be run manually via **Desktop verification and installers**, or triggered by push/PR. The Windows job runs TypeScript and Rust tests, builds an NSIS installer, and uploads `windows-development-installer`. Download and extract that artifact to obtain the setup executable. No workflow has been dispatched from this workspace.

The CI build is not a UI or installer smoke test. Before calling Windows support verified, check on Windows:

- Install, launch, close, uninstall, and reinstall.
- Open two files, edit and save each; confirm each receives only its own edits.
- Test non-ASCII paths and filenames, read-only files and external modification conflicts.
- Edit large integers and `1e400`; compare saved tokens exactly.
- Retain invalid source drafts when switching documents; cancel and confirm tab-close prompts.
- Verify recovery restores multiple unsaved documents after restarting.
- Check Ctrl+O/S/Z, F2, Enter, Tab, Shift+Tab and Escape in the WebView2 grid.
- Test window close and application quit with unsaved documents in background tabs.
