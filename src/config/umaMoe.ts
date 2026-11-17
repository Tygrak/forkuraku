export const UMA_MOE_API_BASE = "https://uma.moe";
export const UMA_MOE_API_KEY_STORAGE_KEY = "forkuraku.umaMoeApiKey";

export const loadUmaMoeApiKey = (): string => {
    if (typeof localStorage === "undefined") return "";

    try {
        return localStorage.getItem(UMA_MOE_API_KEY_STORAGE_KEY)?.trim() ?? "";
    } catch {
        return "";
    }
};

export const saveUmaMoeApiKey = (apiKey: string): void => {
    if (typeof localStorage === "undefined") return;

    try {
        const trimmed = apiKey.trim();
        if (trimmed) {
            localStorage.setItem(UMA_MOE_API_KEY_STORAGE_KEY, trimmed);
        } else {
            localStorage.removeItem(UMA_MOE_API_KEY_STORAGE_KEY);
        }
    } catch {
        // Storage may be unavailable; the in-memory key still works for this session.
    }
};
