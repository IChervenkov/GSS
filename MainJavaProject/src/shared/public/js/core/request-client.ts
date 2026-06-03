import { safeRedirect } from '/assets/shared/js/core/dom.ts';
import { normalizeApiResult, SECURITY_REDIRECT_CODES } from '/assets/shared/js/core/app-errors.ts';
import { safeReadJson } from '/assets/shared/js/core/http.ts';

type RequestQuery = Record<string, unknown> | null;

type RequestClientOptions = {
  body?: unknown;
  csrfToken?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  query?: RequestQuery;
};

type RequestClientConfig = {
  onSecurityRedirect?: ((url: string, fallback?: string) => void) | null;
};

function joinUrl(path: string, query: RequestQuery = null) {
  const url = new URL(path, window.location.origin);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.pathname + url.search + url.hash;
}

export function createRequestScope() {
  let activeController: AbortController | null = null;
  let token = 0;

  return {
    next() {
      token += 1;
      activeController?.abort();
      activeController = new AbortController();
      return { token, signal: activeController.signal };
    },
    isCurrent(candidate) {
      return candidate === token;
    },
    abort() {
      activeController?.abort();
    },
  };
}

export function createRequestClient({ onSecurityRedirect = null }: RequestClientConfig = {}) {
  async function send(
    method: string,
    path: string,
    { body, csrfToken = '', headers = {}, signal, query }: RequestClientOptions = {},
  ) {
    const requestHeaders = {
      Accept: 'application/json',
      ...headers,
    };

    const hasBody = body !== undefined;
    if (hasBody) requestHeaders['Content-Type'] = 'application/json';
    if (csrfToken) requestHeaders['CSRF-Token'] = csrfToken;

    let response;
    let parsedBody = null;

    try {
      response = await fetch(joinUrl(path, query), {
        method,
        credentials: 'include',
        headers: requestHeaders,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal,
      });
      parsedBody = await safeReadJson(response);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return {
          ok: false,
          status: 0,
          code: 'ABORTED',
          message: 'The request was cancelled.',
          data: null,
          body: null,
          redirectTo: null,
          aborted: true,
          retryable: false,
          pageState: 'idle',
        };
      }
      throw error;
    }

    const result = normalizeApiResult({ response, body: parsedBody });

    if (!result.ok && SECURITY_REDIRECT_CODES.has(result.code)) {
      const redirectHandler =
        typeof onSecurityRedirect === 'function' ? onSecurityRedirect : safeRedirect;
      redirectHandler(result.redirectTo || '/', '/');
    }

    return result;
  }

  return {
    getJson(path, options = {}) {
      return send('GET', path, options);
    },
    postJson(path, options = {}) {
      return send('POST', path, options);
    },
    putJson(path, options = {}) {
      return send('PUT', path, options);
    },
    patchJson(path, options = {}) {
      return send('PATCH', path, options);
    },
    deleteJson(path, options = {}) {
      return send('DELETE', path, options);
    },
  };
}
