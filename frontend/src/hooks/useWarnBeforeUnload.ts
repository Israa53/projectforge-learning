import { useEffect } from "react";

export function useWarnBeforeUnload(when: boolean) {
  useEffect(() => {
    if (!when) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();

      // Compatibility with older browser implementations.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [when]);
}
