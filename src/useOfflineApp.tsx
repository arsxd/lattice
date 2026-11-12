import { useEffect, useState } from "react";

type InstallOffer = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useOfflineApp() {
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
    if (
      !/^https?:$/.test(location.protocol) ||
      !("serviceWorker" in navigator) ||
      import.meta.env.DEV
    )
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
    // Updates wait for all app windows to close; never reload an editing session.
    void navigator.serviceWorker.register("./sw.js").catch(console.error);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (
    !/^https?:$/.test(location.protocol) ||
    hidden ||
    window.matchMedia("(display-mode: standalone)").matches
  )
    return null;
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
  return (
    <section className="welcome-install" aria-label="Install Lattice">
      <strong>Use Lattice as an app</strong>
      <p>Open in its own window, with offline access.</p>
      {!offer && (
        <p>
          Open this page in Chrome or Edge and use the browser’s install menu.
          Installation depends on browser support and policy.
        </p>
      )}
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
}
