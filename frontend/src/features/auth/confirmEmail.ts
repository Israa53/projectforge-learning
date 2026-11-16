import { ensureSuccess, getCsrfToken } from "../../lib/http";

export async function confirmEmail(
  userId: string,
  code: string,
): Promise<void> {
  const csrfToken = await getCsrfToken();

  const response = await fetch("/api/auth/confirm-email", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrfToken,
    },
    body: JSON.stringify({ userId, code }),
  });

  await ensureSuccess(response);
}
