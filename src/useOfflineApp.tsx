import { useEffect, useRef, useState } from "react";
import { watchAppUpdates } from "./platform/updateLifecycle";

type InstallOffer = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useOfflineApp(canReload: boolean) {
  const hosted =
    /^https?:$/.test(location.protocol) &&
    document.querySelector('link[rel="manifest"]') !== null;
  const [updateReady, setUpdateReady] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const canReloadRef = useRef(canReload);
  canReloadRef.current = canReload;
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const updateDialog = useRef<HTMLDialogElement>(null);
  const [offer, setOffer] = useState<InstallOffer | null>(null);
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem("lattice-install-dismissed") === "1";
    } catch {
      return false;
    }
  });
  function dismiss() {
    setHidden(true);
    try {
      sessionStorage.setItem("lattice-install-dismissed", "1");
    } catch {
      /* Storage may be unavailable. */
    }
  }
  useEffect(() => {
    if (!hosted || !("serviceWorker" in navigator) || import.meta.env.DEV)
      return;
    const capture = (event: Event) => {
      event.preventDefault();
      setOffer(event as InstallOffer);
    };
    const installed = () => {
      setOffer(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    let disposed = false;
    let stopUpdates: (() => void) | undefined;
    // Updates wait for all app windows to close; never reload an editing session.
    void navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        if (!disposed) {
          registrationRef.current = registration;
          stopUpdates = watchAppUpdates(
            registration,
            () => navigator.serviceWorker.controller !== null,
            document,
            setUpdateReady,
          );
        }
      })
      .catch(() => {
        /* Offline registration can be retried on the next launch. */
      });
    return () => {
      disposed = true;
      stopUpdates?.();
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- hosted comes from the page URL and cannot change while mounted
  }, []);
  async function install() {
    if (!offer || pending) return;
    setPending(true);
    try {
      await offer.prompt();
      await offer.userChoice;
    } catch {
      /* Browser installation remains available in its own menu. */
    } finally {
      setOffer(null);
      setPending(false);
      dismiss();
    }
  }
  function applyUpdate() {
    const worker = registrationRef.current?.waiting;
    if (!worker || !canReloadRef.current || applyingUpdate) return;
    setApplyingUpdate(true);
    setUpdateError("");
    const serviceWorker = navigator.serviceWorker;
    const cleanup = () => {
      clearTimeout(timer);
      serviceWorker.removeEventListener("controllerchange", changed);
    };
    const changed = () => {
      if (serviceWorker.controller !== worker) return;
      cleanup();
      if (canReloadRef.current) location.reload();
      else {
        setApplyingUpdate(false);
        setUpdateReady(false);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      setApplyingUpdate(false);
      setUpdateError(
        "The update did not activate. Close all Lattice windows and try again.",
      );
    }, 10000);
    serviceWorker.addEventListener("controllerchange", changed);
    worker.postMessage("lattice-activate-update");
  }
  const updateStatus =
    hosted && (updateReady || applyingUpdate) ? (
      <>
        <button
          className="text-button update-available"
          onClick={() => {
            setUpdateError("");
            updateDialog.current?.showModal();
          }}
        >
          Update available
        </button>
        <dialog
          ref={updateDialog}
          className="update-dialog"
          aria-labelledby="update-title"
        >
          <h2 id="update-title">Update available</h2>
          <p>
            {canReload
              ? "Update now reloads this window with the new build."
              : "Save your work and close all documents in this window to enable Update now."}
          </p>
          {updateError && <p role="alert">{updateError}</p>}
          <p className="small">
            This window runs build {__APP_BUILD__}. After reopening, hover the
            version in the status bar to confirm it changed.
          </p>
          <form method="dialog" className="dialog-actions">
            <button autoFocus>Keep working</button>
            <button
              type="button"
              disabled={!canReload || applyingUpdate}
              onClick={applyUpdate}
            >
              {applyingUpdate ? "Updating…" : "Update now"}
            </button>
          </form>
        </dialog>
      </>
    ) : null;
  const installPrompt =
    !hosted ||
    hidden ||
    window.matchMedia("(display-mode: standalone)").matches ? null : (
      <section className="welcome-install" aria-label="Install Lattice">
        <strong>Use Lattice as an app</strong>
        <p>
          Its own window, with offline access.
          {!offer &&
            " In Chrome or Edge, use the browser’s install menu; availability depends on browser support and policy."}
        </p>
        <div className="welcome-install-actions">
          {offer && (
            <button disabled={pending} onClick={() => void install()}>
              {pending ? "Opening…" : "Install Lattice"}
            </button>
          )}
          <button className="text-button" disabled={pending} onClick={dismiss}>
            Not now
          </button>
        </div>
      </section>
    );
  return { installPrompt, updateStatus };
}
