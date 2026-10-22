import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRoutes } from "./AppRoutes";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ApiError } from "./lib/http";

import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/ui.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,

      retry: (failureCount, error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return false;
        }

        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }

        return failureCount < 1;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
