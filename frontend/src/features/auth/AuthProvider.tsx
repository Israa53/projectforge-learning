import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";
import {
    subscribeToAuthChanges,
} from "../../lib/authCoordination";

import {
    ApiError,
    refreshSession,
    SESSION_EXPIRED_EVENT,
    setAccessToken,
    type AuthUser,
} from "../../lib/http";

import {
    login as loginRequest,
    logout as logoutRequest,
    type LoginInput,
} from "./api";

type AuthState =
    | { status: "loading" }
    | { status: "anonymous" }
    | { status: "authenticated"; user: AuthUser }
    | { status: "error"; message: string };

type AuthContextValue = {
    state: AuthState;
    login: (input: LoginInput) => Promise<void>;
    logout: () => Promise<void>;
    retrySession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
    children,
}: {
    children: ReactNode;
}) {
    const queryClient = useQueryClient();

    const [state, setState] = useState<AuthState>({
        status: "loading",
    });

    const [restoreVersion, setRestoreVersion] = useState(0);

    useEffect(() => {
        return subscribeToAuthChanges(() => {
            // Another tab logged in or logged out.
            // Reload to discard this tab's token, cache, and account state.
            window.location.reload();
        });
    }, []);

    useEffect(() => {
        function handleSessionExpired() {
            setAccessToken(null);
            setState({ status: "anonymous" });
            queryClient.clear();
        }

        window.addEventListener(
            SESSION_EXPIRED_EVENT,
            handleSessionExpired,
        );

        return () => {
            window.removeEventListener(
                SESSION_EXPIRED_EVENT,
                handleSessionExpired,
            );
        };
    }, [queryClient]);

    useEffect(() => {
        let active = true;

        async function restoreSession() {
            try {
                const result = await refreshSession();

                if (active) {
                    setState({
                        status: "authenticated",
                        user: result.user,
                    });
                }
            } catch (cause) {
                if (!active) {
                    return;
                }

                if (cause instanceof ApiError && cause.status === 401) {
                    setState({ status: "anonymous" });
                    return;
                }

                setState({
                    status: "error",
                    message:
                        cause instanceof Error
                            ? cause.message
                            : "Could not restore your session.",
                });
            }
        }

        void restoreSession();

        return () => {
            active = false;
        };
    }, [restoreVersion]);

    async function login(input: LoginInput): Promise<void> {
        const result = await loginRequest(input);

        // Remove any previous account's cached server data.
        await queryClient.cancelQueries();
        queryClient.clear();

        setState({
            status: "authenticated",
            user: result.user,
        });
    }

    async function logout(): Promise<void> {
        if (state.status !== "authenticated") {
            return;
        }

        // Don't sign out while creating, editing, or deleting an item.
        if (
            queryClient.isMutating({
                mutationKey: ["work-items"],
            }) > 0
        ) {
            throw new Error(
                "Please wait for your changes to finish before signing out.",
            );
        }

        const previousState = state;

        setState({ status: "loading" });

        await queryClient.cancelQueries();

        try {
            await logoutRequest();

            queryClient.clear();
            setState({ status: "anonymous" });
        } catch (cause) {
            setState(previousState);
            throw cause;
        }
    }

    function retrySession() {
        setState({ status: "loading" });
        setRestoreVersion(previous => previous + 1);
    }

    return (
        <AuthContext.Provider
            value={{
                state,
                login,
                logout,
                retrySession,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (context === null) {
        throw new Error(
            "useAuth must be used inside AuthProvider.",
        );
    }

    return context;
}