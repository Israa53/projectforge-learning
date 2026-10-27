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

  readonly fieldErrors: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Module state: survives component renders, but not a page reload.
let accessToken: string | null = null;

let sessionRevision = 0;

export function getSessionRevision(): number {
  return sessionRevision;
}

export function assertCurrentSession(revision: number): void {
  if (revision !== sessionRevision) {
    throw new DOMException("The authentication session changed.", "AbortError");
  }
}
// Concurrent requests in this tab share one refresh operation.
let refreshPromise: Promise<AuthResponse> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  sessionRevision += 1;
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
    problem?.errors ?? {},
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
  // Remember which session started this request.
  const revision = getSessionRevision();

  const csrfToken = await getCsrfToken();

  // Stop if the session changed while getting the CSRF token.
  assertCurrentSession(revision);

  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRF-TOKEN": csrfToken,
    },
  });

  // Ignore the response if it belongs to an older session.
  assertCurrentSession(revision);

  if (response.status === 401) {
    setAccessToken(null);

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  await ensureSuccess(response);

  const result = (await response.json()) as AuthResponse;

  // Reading JSON is asynchronous, so check once more.
  assertCurrentSession(revision);

  // Refresh keeps the same session, so assign directly.
  accessToken = result.accessToken;

  return result;
}

// This helper supports repeatable request bodies such as our JSON strings.
// It is intended for protected work-item requests, not auth endpoints.
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const revision = getSessionRevision();
  const tokenUsed = accessToken;

  function checkRequest(): void {
    options.signal?.throwIfAborted();
    assertCurrentSession(revision);
  }

  function send(): Promise<Response> {
    checkRequest();

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

  let response = await send();

  checkRequest();

  if (response.status !== 401) {
    return response;
  }

  if (accessToken === null || accessToken === tokenUsed) {
    await refreshSession();
  }

  checkRequest();

  response = await send();

  checkRequest();

  if (response.status === 401) {
    setAccessToken(null);

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