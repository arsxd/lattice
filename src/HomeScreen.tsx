import type { ReactNode } from "react";
import "./homeScreen.css";

interface HomeScreenProps {
  onOpen: () => void;
  onNew: () => void;
  onSample: () => void;
  busy: boolean;
  installPrompt: ReactNode;
  updateStatus: ReactNode;
  recoverySetting: ReactNode;
}

export function HomeScreen({
  onOpen,
  onNew,
  onSample,
  busy,
  installPrompt,
  updateStatus,
  recoverySetting,
}: HomeScreenProps) {
  return (
    <main className="home-screen">
      <div className="home-screen-symbol" aria-hidden="true">
        {"{ }"}
      </div>
      <h1>Edit JSON like a spreadsheet.</h1>
      <p className="home-screen-description">
        Work with cells, rows, and columns. Explore nested data and review your
        changes—without wrestling with JSON syntax.
      </p>
      <div className="home-screen-actions">
        <button className="primary" disabled={busy} onClick={onOpen}>
          Open JSON file…
        </button>
        <button disabled={busy} onClick={onNew}>
          New document
        </button>
      </div>
      <button className="text-button" disabled={busy} onClick={onSample}>
        Explore sample workspace
      </button>
      <p className="home-screen-local">
        Files are processed locally. Save with supported browser file access, or
        download an edited copy.
      </p>
      {installPrompt}
      {updateStatus}
      {recoverySetting && (
        <section className="home-screen-recovery">
          {recoverySetting}
          <p>
            Off by default. When enabled, unsaved drafts are stored in this
            browser. Turning recovery off removes them. Save your file to keep a
            copy.
          </p>
        </section>
      )}
      <footer className="home-screen-footer">
        <span>UTF-8 · up to 64 MiB · 256 nesting levels</span>
        <a
          href="https://github.com/arsxd/lattice"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
