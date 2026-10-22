const AUTH_LOCK_NAME = "projectforge:auth";
const AUTH_CHANNEL_NAME = "projectforge:auth-events";

type AuthChangeMessage = {
  type: "auth-changed";
};

export async function withAuthLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks) {
    throw new Error(
      "This browser does not support authentication coordination. " +
        "Use an updated browser and open the app over HTTPS.",
    );
  }

  return navigator.locks.request(
    AUTH_LOCK_NAME,
    { mode: "exclusive" },
    operation,
  );
}

export function notifyAuthChanged(): void {
  const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);

  const message: AuthChangeMessage = {
    type: "auth-changed",
  };

  channel.postMessage(message);
  channel.close();
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data;

    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "auth-changed"
    ) {
      callback();
    }
  };

  return () => {
    channel.close();
  };
}
