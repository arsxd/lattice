import { useEffect } from "react";

// Register offline support without adding installation controls to the workspace.
export default function RegisterOfflineApp() {
  useEffect(() => {
    if (
      !/^https?:$/.test(location.protocol) ||
      !("serviceWorker" in navigator) ||
      import.meta.env.DEV
    )
      return;
    // Waiting updates activate after all app windows close; never reload an editing session.
    void navigator.serviceWorker.register("./sw.js").catch(console.error);
  }, []);
  return null;
}
