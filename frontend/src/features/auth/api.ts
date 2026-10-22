import {
  ensureSuccess,
  getCsrfToken,
  setAccessToken,
  waitForPendingRefresh,
  type AuthResponse,
} from "../../lib/http";

import { notifyAuthChanged, withAuthLock } from "../../lib/authCoordination";

export type LoginInput = {
  email: string;
  password: string;
};

export async function login(input: LoginInput): Promise<AuthResponse> {
  // Wait outside the lock: a refresh may itself be waiting for it.
  await waitForPendingRefresh();

  return withAuthLock(async () => {
    const csrfToken = await getCsrfToken();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify(input),
    });

    await ensureSuccess(response);

    const result = (await response.json()) as AuthResponse;

    setAccessToken(result.accessToken);
    notifyAuthChanged();

    return result;
  });
}

export async function logout(): Promise<void> {
  await waitForPendingRefresh();

  return withAuthLock(async () => {
    const csrfToken = await getCsrfToken();

    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRF-TOKEN": csrfToken,
      },
    });

    await ensureSuccess(response);

    setAccessToken(null);
    notifyAuthChanged();
  });
}
