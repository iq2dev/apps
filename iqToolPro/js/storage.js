// Files kept in the browser's IndexedDB: uploaded IODDs (dashboards are never stored automatically).
// One object store, keyed by a path-like string ("iodd/576_901_1_1.zip").

const dbName = "iqToolPro";
const storeName = "files";
let opened = null;

function db() {
    opened ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => { opened = null; reject(request.error); };
    });
    return opened;
}

async function run(mode, action) {
    const store = (await db()).transaction(storeName, mode).objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = action(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

window.iqStorage = {
    put: (key, bytes) => run("readwrite", s => s.put(new Uint8Array(bytes), key)).then(() => undefined),
    get: async (key) => { const v = await run("readonly", s => s.get(key)); return v === undefined ? null : v; },
    delete: (key) => run("readwrite", s => s.delete(key)).then(() => undefined),
};
