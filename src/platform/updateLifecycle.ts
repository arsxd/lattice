const CHECK_INTERVAL = 60 * 60 * 1000;

/** Observe updates without activating a worker or reloading an editing session. */
export function watchAppUpdates(
  registration: ServiceWorkerRegistration,
  hasController: () => boolean,
  page: Document,
  onReady: (ready: boolean) => void,
): () => void {
  const workers = new Set<ServiceWorker>();
  let lastCheck = -Infinity;
  const inspect = () =>
    onReady(hasController() && registration.waiting !== null);
  const track = () => {
    const worker = registration.installing;
    if (worker && !workers.has(worker)) {
      workers.add(worker);
      worker.addEventListener("statechange", inspect);
    }
    inspect();
  };
  const check = () => {
    if (
      page.visibilityState !== "visible" ||
      Date.now() - lastCheck < CHECK_INTERVAL
    )
      return;
    lastCheck = Date.now();
    // An offline update check changes neither readiness nor the current session.
    void registration.update().catch(() => {});
  };
  registration.addEventListener("updatefound", track);
  page.addEventListener("visibilitychange", check);
  const timer = setInterval(check, CHECK_INTERVAL);
  track();
  return () => {
    clearInterval(timer);
    registration.removeEventListener("updatefound", track);
    page.removeEventListener("visibilitychange", check);
    for (const worker of workers)
      worker.removeEventListener("statechange", inspect);
  };
}
