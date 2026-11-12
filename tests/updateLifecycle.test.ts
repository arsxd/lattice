import { afterEach, describe, expect, it, vi } from "vitest";
import { watchAppUpdates } from "../src/platform/updateLifecycle";

class Worker extends EventTarget {
  state = "installing";
}
class Registration extends EventTarget {
  waiting: Worker | null = null;
  installing: Worker | null = null;
  update = vi.fn(async () => this as unknown as ServiceWorkerRegistration);
}
function setup(controlled = true) {
  const registration = new Registration();
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const ready = vi.fn();
  const start = () =>
    watchAppUpdates(
      registration as unknown as ServiceWorkerRegistration,
      () => controlled,
      page as unknown as Document,
      ready,
    );
  return { registration, page, ready, start };
}
afterEach(() => vi.useRealTimers());
describe("app update lifecycle", () => {
  it("announces an already waiting update only for an existing controlled app", () => {
    const app = setup();
    app.registration.waiting = new Worker();
    const stop = app.start();
    expect(app.ready).toHaveBeenLastCalledWith(true);
    stop();
    const first = setup(false);
    first.registration.waiting = new Worker();
    const stopFirst = first.start();
    expect(first.ready).not.toHaveBeenCalledWith(true);
    stopFirst();
  });
  it("announces a newly installed waiting worker and removes listeners on cleanup", () => {
    const app = setup();
    const stop = app.start();
    const worker = new Worker();
    app.registration.installing = worker;
    app.registration.dispatchEvent(new Event("updatefound"));
    app.registration.waiting = worker;
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    expect(app.ready).toHaveBeenLastCalledWith(true);
    stop();
    app.ready.mockClear();
    worker.dispatchEvent(new Event("statechange"));
    expect(app.ready).not.toHaveBeenCalled();
  });
  it("throttles visible checks, ignores hidden pages, handles offline rejection, and stops timers", async () => {
    vi.useFakeTimers();
    const app = setup();
    app.registration.update.mockRejectedValue(new Error("offline"));
    const stop = app.start();
    app.page.visibilityState = "hidden";
    app.page.dispatchEvent(new Event("visibilitychange"));
    expect(app.registration.update).not.toHaveBeenCalled();
    app.page.visibilityState = "visible";
    app.page.dispatchEvent(new Event("visibilitychange"));
    app.page.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(app.registration.update).toHaveBeenCalledTimes(1);
    expect(app.ready).not.toHaveBeenCalledWith(true);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(app.registration.update).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    app.page.dispatchEvent(new Event("visibilitychange"));
    expect(app.registration.update).toHaveBeenCalledTimes(2);
  });
});
