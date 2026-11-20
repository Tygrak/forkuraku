import type { Veteran } from "./types";

const DB_NAME = "forkuraku-veterans";
const DB_VERSION = 1;
const STORE_NAME = "roster";
const ROSTER_KEY = "current";

let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open veteran storage."));
    });

    return databasePromise;
};

const runRequest = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
    const database = await openDatabase();

    return new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = action(transaction.objectStore(STORE_NAME));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Veteran storage request failed."));
        transaction.onerror = () => reject(transaction.error ?? new Error("Veteran storage transaction failed."));
    });
};

export const loadStoredVeterans = async (): Promise<Veteran[] | null> => {
    if (typeof indexedDB === "undefined") return null;

    const stored = await runRequest<Veteran[] | undefined>(
        "readonly",
        store => store.get(ROSTER_KEY),
    );
    return Array.isArray(stored) ? stored : null;
};

export const saveStoredVeterans = async (veterans: Veteran[]): Promise<void> => {
    if (typeof indexedDB === "undefined") {
        throw new Error("Browser storage is not available.");
    }

    await runRequest("readwrite", store => store.put(veterans, ROSTER_KEY));
};

export const clearStoredVeterans = async (): Promise<void> => {
    if (typeof indexedDB === "undefined") return;

    await runRequest("readwrite", store => store.delete(ROSTER_KEY));
};
