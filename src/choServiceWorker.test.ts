import { describe, expect, it, vi } from "vitest";
import serviceWorkerSource from "../public/cho-service-worker.js?raw";

type FetchHandler = (event: {
  request: {
    method: string;
    mode?: string;
    url: string;
  };
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (promise: Promise<unknown>) => void;
}) => void;

function loadChoServiceWorkerForFetchTest(fetchMock: typeof fetch, cachedShell?: Response, scope = "https://xatori-dev.github.io/chos-martial-arts-operations-app/") {
  const listeners = new Map<string, FetchHandler>();
  const cachePut = vi.fn().mockResolvedValue(undefined);
  const cacheAddAll = vi.fn().mockResolvedValue(undefined);
  const cachesMock = {
    match: vi.fn().mockResolvedValue(cachedShell),
    open: vi.fn().mockResolvedValue({ addAll: cacheAddAll, put: cachePut }),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true)
  };
  const selfMock = {
    location: { origin: "https://xatori-dev.github.io" },
    registration: { scope, showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn().mockResolvedValue(undefined) },
    navigator: {},
    addEventListener: vi.fn((eventName: string, handler: FetchHandler) => {
      listeners.set(eventName, handler);
    })
  };

  new Function("self", "caches", "fetch", "Response", "URL", serviceWorkerSource)(selfMock, cachesMock, fetchMock, Response, URL);

  return { cachesMock, listeners, scope };
}

describe("Cho service worker fetch handling", () => {
  it("serves the cached app shell for same-scope GitHub Pages route 404 navigations", async () => {
    const cachedShell = new Response("<main>Cho app shell</main>", {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response("<main>GitHub Pages fallback</main>", { status: 404 }));
    const { cachesMock, listeners, scope } = loadChoServiceWorkerForFetchTest(fetchMock as unknown as typeof fetch, cachedShell);
    const fetchHandler = listeners.get("fetch");
    if (!fetchHandler) throw new Error("Expected service worker fetch handler.");
    let navigationResponse: Promise<Response> | undefined;

    fetchHandler({
      request: { method: "GET", mode: "navigate", url: `${scope}profile` },
      respondWith: (response) => {
        navigationResponse = response;
      },
      waitUntil: vi.fn()
    });

    const response = await navigationResponse;
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("<main>Cho app shell</main>");
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: `${scope}profile` }));
    expect(cachesMock.match).toHaveBeenCalledWith(scope);
  });

  it("ignores same-prefix routes outside the service-worker scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<main>Unexpected</main>", { status: 200 }));
    const { cachesMock, listeners } = loadChoServiceWorkerForFetchTest(
      fetchMock as unknown as typeof fetch,
      undefined,
      "https://xatori-dev.github.io/chos-martial-arts-operations-app"
    );
    const fetchHandler = listeners.get("fetch");
    if (!fetchHandler) throw new Error("Expected service worker fetch handler.");
    const respondWith = vi.fn();

    fetchHandler({
      request: { method: "GET", mode: "navigate", url: "https://xatori-dev.github.io/chos-martial-arts-operations-app.evil/profile" },
      respondWith,
      waitUntil: vi.fn()
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cachesMock.match).not.toHaveBeenCalled();
  });
});
