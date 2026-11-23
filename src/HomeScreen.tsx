import type { ReactNode } from "react";
import "./homeScreen.css";

interface HomeScreenProps {
  webClient?: boolean;
  onOpen: () => void;
  onNew: () => void;
  onSample: () => void;
  busy: boolean;
  installPrompt: ReactNode;
  updateStatus: ReactNode;
  recoverySetting: ReactNode;
}

export function HomeScreen({
  webClient = false,
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
        Drop a JSON file anywhere to open it. Files are processed locally. Save
        with supported browser file access, or download an edited copy.
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
      {/* Brand marks: Simple Icons 13.21.0 (CC0), embedded for offline use. */}
      <footer className="home-screen-footer">
        <span aria-label="Lattice version">v{__APP_VERSION__}</span>
        {webClient && <span>Web client</span>}
        <span>UTF-8 · up to 64 MiB · 256 nesting levels</span>
        <nav className="home-footer-links" aria-label="Project links">
          <a
            className="home-footer-link"
            aria-label="Source on GitHub"
            title="Source on GitHub"
            href="https://github.com/arsxd/lattice"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            <span>Source code</span>
          </a>
          <a
            className="home-footer-link"
            href="https://github.com/arsxd/lattice"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star on GitHub"
            title="Open GitHub to star Lattice"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.37l-5.62 2.96 1.07-6.28L2.9 9.6l6.3-.9Z" />
            </svg>
            <span>Star on GitHub</span>
          </a>
          <a
            className="home-footer-link"
            href="https://buymeacoffee.com/arshaaad"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support Lattice on Buy Me a Coffee"
            title="Support on Buy Me a Coffee"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z" />
            </svg>
            <span>Support</span>
          </a>
        </nav>
      </footer>
    </main>
  );
}
