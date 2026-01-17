// Thumbnail generation and caching utility
// Generates multiple resolution thumbnails and caches them in IndexedDB

const DB_NAME = 'RefBoardThumbnails';
const STORE_NAME = 'thumbnails';
const DB_VERSION = 1;

// Thumbnail size presets
export const ThumbnailSize = {
    SMALL: 512,   // For zoomed out view
    MEDIUM: 1024, // For normal view
} as const;

type ThumbnailSizeType = typeof ThumbnailSize[keyof typeof ThumbnailSize];

// IndexedDB connection
let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });

    return dbPromise;
}

/**
 * Generate a thumbnail from an image blob
 * @param imageBlob Original image blob
 * @param maxSize Maximum width/height (maintains aspect ratio)
 * @returns Thumbnail blob
 */
export async function generateThumbnail(
    imageBlob: Blob,
    maxSize: ThumbnailSizeType
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageBlob);

        img.onload = () => {
            try {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Create canvas and resize
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // High-quality resize
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create thumbnail blob'));
                        }
                    },
                    'image/jpeg',
                    0.85 // Quality 85%
                );
            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Get thumbnail from cache or generate if not exists
 * @param imageUrl Original image URL (used as cache key)
 * @param size Thumbnail size
 * @returns Thumbnail blob URL
 */
export async function getThumbnail(
    imageUrl: string,
    size: ThumbnailSizeType
): Promise<string> {
    const cacheKey = `${imageUrl}_${size}`;

    try {
        // Try to get from cache
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cacheKey);

        const cachedBlob = await new Promise<Blob | null>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });

        if (cachedBlob) {
            // Return cached thumbnail
            return URL.createObjectURL(cachedBlob);
        }

        // Not in cache - need to generate
        // Fetch original image
        const response = await fetch(imageUrl);
        const originalBlob = await response.blob();

        // Generate thumbnail
        const thumbnailBlob = await generateThumbnail(originalBlob, size);

        // Store in cache
        const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
        const writeStore = writeTransaction.objectStore(STORE_NAME);
        writeStore.put(thumbnailBlob, cacheKey);

        // Return thumbnail URL
        return URL.createObjectURL(thumbnailBlob);
    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        // Fallback to original
        return imageUrl;
    }
}

/**
 * Preload thumbnails for an image
 * @param imageUrl Original image URL
 */
export async function preloadThumbnails(imageUrl: string): Promise<void> {
    try {
        // Generate both sizes in parallel
        await Promise.all([
            getThumbnail(imageUrl, ThumbnailSize.SMALL),
            getThumbnail(imageUrl, ThumbnailSize.MEDIUM),
        ]);
    } catch (error) {
        console.error('Preload failed:', error);
    }
}

/**
 * Clear thumbnail cache for a specific image
 * @param imageUrl Original image URL
 */
export async function clearImageThumbnails(imageUrl: string): Promise<void> {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Delete all sizes
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const request = store.delete(`${imageUrl}_${ThumbnailSize.SMALL}`);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise<void>((resolve, reject) => {
                const request = store.delete(`${imageUrl}_${ThumbnailSize.MEDIUM}`);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
        ]);
    } catch (error) {
        console.error('Failed to clear thumbnails:', error);
    }
}

/**
 * Clear entire thumbnail cache
 */
export async function clearAllThumbnails(): Promise<void> {
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}
