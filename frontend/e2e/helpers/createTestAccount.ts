import { randomBytes, randomUUID } from "node:crypto";
import { expect, request } from "@playwright/test";

export async function createTestAccount() {
  const account = {
    email: `e2e-${randomUUID()}@example.test`,
    password: `Aa1!${randomBytes(16).toString("hex")}`,
  };

  const api = await request.newContext({
    baseURL: "https://localhost:5173",
    ignoreHTTPSErrors: true,
  });

  try {
    const csrfResponse = await api.get("/api/auth/csrf");
    await expect(csrfResponse).toBeOK();

    const csrf = (await csrfResponse.json()) as {
      requestToken: string;
    };

    const registerResponse = await api.post("/api/auth/register", {
      headers: {
        "X-CSRF-TOKEN": csrf.requestToken,
      },
      data: account,
    });

    await expect(registerResponse).toBeOK();

    return account;
  } finally {
    await api.dispose();
  }
}
