import { useEffect, useState } from "react";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [offer, setOffer] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if (
      !/^https?:$/.test(location.protocol) ||
      !("serviceWorker" in navigator) ||
      import.meta.env.DEV
    )
      return;
    const install = (event: Event) => {
      event.preventDefault();
      setOffer(event as InstallEvent);
    };
    const installed = () => setOffer(null);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    // Waiting updates activate after all app windows close; never reload an editing session.
    void navigator.serviceWorker.register("./sw.js").catch(console.error);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!offer) return null;
  return (
    <button
      onClick={() => {
        void offer
          .prompt()
          .then(() => offer.userChoice)
          .then(() => setOffer(null))
          .catch(() => setOffer(null));
      }}
    >
      Install Lattice
    </button>
  );
}
