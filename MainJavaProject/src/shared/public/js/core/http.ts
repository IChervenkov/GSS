export async function safeReadJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createRequestTracker() {
  let currentController = null;
  let lastToken = 0;

  function next() {
    lastToken += 1;
    if (currentController) currentController.abort();
    currentController = new AbortController();
    return { token: lastToken, signal: currentController.signal };
  }

  function isCurrent(token) {
    return token === lastToken;
  }

  return { next, isCurrent };
}
