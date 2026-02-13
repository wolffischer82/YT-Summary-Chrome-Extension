/**
 * IndexedDB Wrapper for YT Summary
 * Stores video summaries and chat histories.
 */

const DB_NAME = 'YTSummaryDB';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';

class Storage {
    constructor() {
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Storage error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
                    // Key path is videoId
                    db.createObjectStore(STORE_VIDEOS, { keyPath: 'videoId' });
                }
            };
        });
    }

    async getVideoData(videoId) {
        if (!videoId) return null;
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_VIDEOS], 'readonly');
            const store = transaction.objectStore(STORE_VIDEOS);
            const request = store.get(videoId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveVideoData(videoId, data) {
        if (!videoId) return;
        await this.open();

        // We need to merge with existing data to avoid overwriting unrelated fields
        // (e.g. saving chat history shouldn't wipe the summary if passed separately, 
        // though typically we'd read-modify-write or pass full object)

        // implementation: Read first, then put.
        const current = await this.getVideoData(videoId) || { videoId };
        const updated = { ...current, ...data, timestamp: Date.now() };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_VIDEOS], 'readwrite');
            const store = transaction.objectStore(STORE_VIDEOS);
            const request = store.put(updated);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveChatHistory(videoId, history) {
        return this.saveVideoData(videoId, { chatHistory: history });
    }

    async clearAll() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_VIDEOS], 'readwrite');
            const store = transaction.objectStore(STORE_VIDEOS);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export as global singleton for simplicity in vanilla JS modules
window.ytStorage = new Storage();
