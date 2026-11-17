import { useRef, useState, type ReactNode } from "react";
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
  const current = useRef({ blocked, onBlocked, onFiles });
  current.current = { blocked, onBlocked, onFiles };
  const depth = useRef(0);
  const [active, setActive] = useState(false);
  const files = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files");
  const reset = () => {
    depth.current = 0;
    setActive(false);
  };
  return (
    <div
      className="file-drop-root"
      onDragEnter={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        depth.current++;
        if (!blocked) setActive(true);
      }}
      onDragOver={(event) => {
        if (!files(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = blocked ? "none" : "copy";
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
          Drop JSON files to open
        </div>
      )}
    </div>
  );
}
