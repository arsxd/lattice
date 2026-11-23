import { useEffect, useRef, useState, type ReactNode } from "react";
export type DroppedFile = { file: File; handle?: FileSystemFileHandle };
export function FileDropZone({
  children,
  blocked,
  onBlocked,
  onFiles,
  onError,
}: {
  children: ReactNode;
  blocked: boolean;
  onBlocked: () => void;
  onFiles: (files: DroppedFile[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const current = useRef({ blocked, onBlocked, onFiles });
  current.current = { blocked, onBlocked, onFiles };
  const depth = useRef(0);
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(1);
  const files = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files");
  const reset = () => {
    clearTimeout(expiry.current);
    depth.current = 0;
    setActive(false);
  };
  const keepAlive = () => {
    clearTimeout(expiry.current);
    // External file drags do not reliably deliver dragend when cancelled outside the page.
    expiry.current = setTimeout(reset, 1500);
  };
  useEffect(() => {
    const toolbar = root.current?.querySelector<HTMLElement>(".toolbar");
    const positionOverlay = () => {
      if (!toolbar) return;
      root.current?.style.setProperty(
        "--file-drop-top",
        `${Math.ceil(toolbar.getBoundingClientRect().bottom) + 8}px`,
      );
    };
    positionOverlay();
    const observer = new ResizeObserver(positionOverlay);
    if (toolbar) observer.observe(toolbar);
    window.addEventListener("resize", positionOverlay);
    window.addEventListener("scroll", positionOverlay, true);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("drop", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("dragend", reset);
    window.addEventListener("keydown", escape);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionOverlay);
      window.removeEventListener("scroll", positionOverlay, true);
      clearTimeout(expiry.current);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("drop", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div
      ref={root}
      className="file-drop-root"
      onDragEnter={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        depth.current++;
        setCount(
          Math.max(
            1,
            Array.from(event.dataTransfer.items).filter(
              (item) => item.kind === "file",
            ).length,
          ),
        );
        if (!blocked) {
          setActive(true);
          keepAlive();
        }
      }}
      onDragOver={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = blocked ? "none" : "copy";
        if (!blocked) {
          setActive(true);
          keepAlive();
        }
      }}
      onDragLeave={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        if (--depth.current <= 0) reset();
      }}
      onDrop={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        reset();
        if (blocked) {
          onBlocked();
          return;
        }
        const items = Array.from(event.dataTransfer.items).filter(
          (item) => item.kind === "file",
        );
        const candidates = items.length
          ? items.map((item) => item.getAsFile())
          : Array.from(event.dataTransfer.files);
        if (candidates.some((file) => file === null)) {
          onError("Drop readable JSON files, rather than folders.");
          return;
        }
        const incoming = candidates.filter(
          (file): file is File => file !== null,
        );
        if (!incoming.length) {
          onError("Drop JSON files, rather than folders.");
          return;
        }
        if (
          incoming.length > 8 ||
          incoming.reduce((sum, file) => sum + file.size, 0) > 64 * 1024 * 1024
        ) {
          onError(
            "Drop up to 8 files totalling 64 MiB. Open larger batches separately.",
          );
          return;
        }
        // Request optional handles during the drop event, before yielding its task.
        const handles = items.map((item) => {
          const entry = item as DataTransferItem & {
            getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
          };
          try {
            return entry.getAsFileSystemHandle?.().catch(() => undefined);
          } catch {
            return undefined;
          }
        });
        void Promise.all(handles)
          .then((results) => {
            if (results.some((handle) => handle?.kind === "directory")) {
              onError("Drop JSON files, rather than folders.");
              return;
            }
            if (current.current.blocked) {
              current.current.onBlocked();
              return;
            }
            return current.current.onFiles(
              incoming.map((file, index) => ({
                file,
                handle:
                  results[index]?.kind === "file"
                    ? (results[index] as FileSystemFileHandle)
                    : undefined,
              })),
            );
          })
          .catch((error) =>
            onError(error instanceof Error ? error.message : String(error)),
          );
      }}
    >
      {children}
      {active && (
        <div className="file-drop-overlay" role="status">
          <div className="file-drop-hint">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3H5v18h14V8l-5-5Z" />
              <path d="M14 3v5h5M12 11v7m-3-3 3 3 3-3" />
            </svg>
            <strong>
              {count > 1
                ? `Drop ${count} files to open`
                : "Drop a JSON file to open"}
            </strong>
            <span>Release to open. Each file opens in its own tab.</span>
          </div>
        </div>
      )}
    </div>
  );
}
