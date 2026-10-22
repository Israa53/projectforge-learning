import { withAuthLock } from "./authCoordination";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResponse = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};

type CsrfResponse = {
  requestToken: string;
};

type ProblemDetails = {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}

// Module state: survives component renders, but not a page reload.
let accessToken: string | null = null;

// Concurrent requests in this tab share one refresh operation.
let refreshPromise: Promise<AuthResponse> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const problem = (await response
    .json()
    .catch(() => null)) as ProblemDetails | null;

  const validationMessage = problem?.errors
    ? Object.values(problem.errors).flat().join(" ")
    : undefined;

  throw new ApiError(
    validationMessage ||
      problem?.detail ||
      problem?.title ||
      `Request failed. HTTP ${response.status}.`,
    response.status,
  );
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "include",
    cache: "no-store",
  });

  await ensureSuccess(response);

  const result = (await response.json()) as CsrfResponse;

  return result.requestToken;
}

export function refreshSession(): Promise<AuthResponse> {
  if (refreshPromise !== null) {
    return refreshPromise;
  }

  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function performRefresh(): Promise<AuthResponse> {
  return withAuthLock(performRefreshRequest);
}

async function performRefreshRequest(): Promise<AuthResponse> {
  const csrfToken = await getCsrfToken();

  // Use fetch directly. Refresh must never recursively refresh itself.
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRF-TOKEN": csrfToken,
    },
  });

  if (response.status === 401) {
    accessToken = null;

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  await ensureSuccess(response);

  const result = (await response.json()) as AuthResponse;

  accessToken = result.accessToken;

  return result;
}

// This helper supports repeatable request bodies such as our JSON strings.
// It is intended for protected work-item requests, not auth endpoints.
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const tokenUsed = accessToken;

  function send(): Promise<Response> {
    const headers = new Headers(options.headers);

    if (accessToken !== null) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else {
      headers.delete("Authorization");
    }

    return fetch(path, {
      ...options,
      headers,
      credentials: "include",
    });
  }

  options.signal?.throwIfAborted();

  let response = await send();

  if (response.status !== 401) {
    return response;
  }

  options.signal?.throwIfAborted();

  // Another request may already have replaced the expired token.
  if (accessToken === null || accessToken === tokenUsed) {
    await refreshSession();
  }

  // Cancelling one query must not cancel a refresh shared by other queries.
  options.signal?.throwIfAborted();

  // Retry once. A second 401 is returned to the caller.
  response = await send();

  if (response.status === 401) {
    accessToken = null;

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  return response;
}

export const SESSION_EXPIRED_EVENT = "projectforge:session-expired";

export async function waitForPendingRefresh(): Promise<void> {
  if (refreshPromise !== null) {
    await refreshPromise.catch(() => undefined);
  }
}
