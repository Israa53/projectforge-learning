import {
    createContext,
    useContext,
    type Dispatch,
    type SetStateAction,
} from "react";

type DraftGuardValue = {
    hasUnsavedChanges: boolean;
    setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
};

export const DraftGuardContext =
    createContext<DraftGuardValue | null>(null);

export function useDraftGuard(): DraftGuardValue {
    const context = useContext(DraftGuardContext);

    if (context === null) {
        throw new Error("useDraftGuard must be used inside AuthGate.");
    }

    return context;
}