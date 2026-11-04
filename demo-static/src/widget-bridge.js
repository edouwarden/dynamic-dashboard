/**
 * Widget bridge for the static demo.
 *
 * Injected as the first script of every widget page. It routes the widget's
 * /api/* calls (queryDB, tab variables, notifications) to the shared
 * IndexedDB engine, so widgets run unchanged without a backend.
 */

(function () {
  const nativeFetch = window.fetch.bind(window);
  let enginePromise = null;

  function engine() {
    if (!enginePromise) enginePromise = import('/demo/engine.js');
    return enginePromise;
  }

  window.fetch = async function staticDemoWidgetFetch(input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, location.href);
    } catch {
      return nativeFetch(input, init);
    }

    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    let body = init?.body;
    const method = init?.method || (typeof input === 'object' && input.method) || 'GET';
    if (body === undefined && typeof input === 'object' && input.body) {
      body = await input.clone().text();
    }

    const { handleFetch } = await engine();
    return handleFetch(
      new Request(url.toString(), {
        method,
        headers: init?.headers || (typeof input === 'object' ? input.headers : undefined),
        body,
      }),
    );
  };
})();
