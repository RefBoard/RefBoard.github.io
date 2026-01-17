import { getFirebaseDatabase } from './firebaseAuth';
import { ref, set, onValue, off, remove, update } from 'firebase/database';

const db = getFirebaseDatabase();

// Generate a unique session ID for this tab/window
const SESSION_ID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Chunk size for large data splitting (500KB)
const CHUNK_SIZE = 500 * 1024;
// Cache for loaded chunks to avoid re-fetching
const chunkCache: Record<string, string> = {};

export interface CursorPosition {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    x: number;
    y: number;
    color: string;
    lastUpdate: number;
}

export interface PresenceInfo {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    joinedAt: number;
    lastSeen: number;
}

// Generate a consistent color for a user based on their ID (or Session ID for same-user distinction)
function getUserColor(id: string): string {
    const colors = [
        '#3B82F6', // blue
        '#10B981', // green
        '#F59E0B', // amber
        '#EF4444', // red
        '#8B5CF6', // purple
        '#EC4899', // pink
        '#14B8A6', // teal
        '#F97316', // orange
    ];

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

// Throttle function to limit update frequency
let lastCursorUpdate = 0;
const CURSOR_UPDATE_THROTTLE = 100; // 100ms (10 updates/sec) - balanced for performance

/**
 * Update cursor position for current session
 */
export function updateCursor(
    boardId: string,
    userId: string,
    userName: string,
    userEmail: string,
    x: number,
    y: number
): void {
    const now = Date.now();

    if (now - lastCursorUpdate < CURSOR_UPDATE_THROTTLE) {
        return;
    }

    lastCursorUpdate = now;

    // Use sessionId as key to allow multiple tabs for same user
    const cursorRef = ref(db, `boards/${boardId}/cursors/${SESSION_ID}`);
    const cursorData: CursorPosition = {
        sessionId: SESSION_ID,
        userId,
        userName,
        userEmail,
        x,
        y,
        color: getUserColor(SESSION_ID), // Color based on session to distinguish tabs
        lastUpdate: now,
    };

    set(cursorRef, cursorData).catch((error) => {
        console.error('Failed to update cursor:', error);
    });
}

/**
 * Subscribe to cursor updates from all users
 */
export function subscribeToCursors(
    boardId: string,
    callback: (cursors: CursorPosition[]) => void
): () => void {
    const cursorsRef = ref(db, `boards/${boardId}/cursors`);

    const handleValue = (snapshot: any) => {
        const cursors: CursorPosition[] = [];
        const now = Date.now();

        snapshot.forEach((childSnapshot: any) => {
            const cursor = childSnapshot.val();

            // Filter out own cursor (by session ID) and stale cursors
            if (cursor.sessionId !== SESSION_ID && now - cursor.lastUpdate < 30000) {
                cursors.push(cursor);
            }
        });

        callback(cursors);
    };

    onValue(cursorsRef, handleValue);

    return () => {
        off(cursorsRef, 'value', handleValue);
    };
}

/**
 * Set user presence
 */
export function setPresence(
    boardId: string,
    userId: string,
    userName: string,
    userEmail: string
): void {
    const presenceRef = ref(db, `boards/${boardId}/presence/${SESSION_ID}`);
    const presenceData: PresenceInfo = {
        sessionId: SESSION_ID,
        userId,
        userName,
        userEmail,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
    };

    set(presenceRef, presenceData).catch((error) => {
        console.error('Failed to set presence:', error);
    });

    const intervalId = setInterval(() => {
        set(ref(db, `boards/${boardId}/presence/${SESSION_ID}/lastSeen`), Date.now());
    }, 5000);

    (window as any)[`presenceInterval_${boardId}_${SESSION_ID}`] = intervalId;
}

/**
 * Remove user presence
 */
export function removePresence(boardId: string): void {
    const intervalId = (window as any)[`presenceInterval_${boardId}_${SESSION_ID}`];
    if (intervalId) {
        clearInterval(intervalId);
        delete (window as any)[`presenceInterval_${boardId}_${SESSION_ID}`];
    }

    const presenceRef = ref(db, `boards/${boardId}/presence/${SESSION_ID}`);
    remove(presenceRef).catch(console.error);

    const cursorRef = ref(db, `boards/${boardId}/cursors/${SESSION_ID}`);
    remove(cursorRef).catch(console.error);
}

/**
 * Subscribe to presence updates
 */
export function subscribeToPresence(
    boardId: string,
    callback: (users: PresenceInfo[]) => void
): () => void {
    const presenceRef = ref(db, `boards/${boardId}/presence`);

    const handleValue = (snapshot: any) => {
        const users: PresenceInfo[] = [];
        const now = Date.now();

        snapshot.forEach((childSnapshot: any) => {
            const presence = childSnapshot.val();

            // Filter out stale presence (>60 seconds)
            if (now - presence.lastSeen < 60000) {
                users.push(presence);
            }
        });

        callback(users);
    };

    onValue(presenceRef, handleValue);

    return () => {
        off(presenceRef, 'value', handleValue);
    };
}

// ========== CHUNKED DATA TRANSFER ==========

function chunkString(str: string, size: number): string[] {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substr(o, size);
    }
    return chunks;
}

async function saveChunks(boardId: string, itemId: string, data: string) {
    const chunks = chunkString(data, CHUNK_SIZE);

    // Batch updates to avoid 10MB write limit
    // CHUNK_SIZE is 500KB. 15 chunks = 7.5MB (safe margin below 10MB)
    const BATCH_SIZE = 15;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const updates: any = {};
        const batch = chunks.slice(i, i + BATCH_SIZE);

        batch.forEach((chunk, batchIndex) => {
            const globalIndex = i + batchIndex;
            updates[`boards/${boardId}/chunks/${itemId}/${globalIndex}`] = chunk;
        });

        // Send batch
        try {
            await update(ref(db), updates);
        } catch (error) {
            console.error(`Failed to save chunk batch ${i / BATCH_SIZE}:`, error);
            throw error; // Re-throw to stop process
        }
    }
}

// Note: loadChunks function is kept for potential future use but currently unused
// async function loadChunks(boardId: string, itemId: string): Promise<string | null> {
//     try {
//         const snapshot = await get(ref(db, `boards/${boardId}/chunks/${itemId}`));
//         if (snapshot.exists()) {
//             const chunks = snapshot.val();
//             // chunks is an array or object with numeric keys
//             return Array.isArray(chunks) ? chunks.join('') : Object.values(chunks).join('');
//         }
//         return null;
//     } catch (error) {
//         console.error('Failed to load chunks:', error);
//         return null;
//     }
// }

// ========== REAL-TIME BOARD SYNC ==========

/**
 * Sync entire board state to Firebase
 * (Used for initial save or major updates)
 */
export async function syncBoardToFirebase(boardId: string, boardData: any) {
    const boardRef = ref(db, `boards/${boardId}/data`);
    // Ensure boardName is included in the sync
    const dataToSync = {
        ...boardData,
        boardName: boardData.boardName || 'Untitled Board'
    };
    await set(boardRef, dataToSync);
}

/**
 * Update a specific item in Firebase (Partial Update)
 * Use this for moving/resizing items to avoid sending large image data repeatedly
 */
const throttles = new Map<string, {
    timer: NodeJS.Timeout | null;
    latestArgs: any[];
    isPending: boolean;
}>();

export async function updateRemoteItem(boardId: string, itemId: string, changes: any) {
    // THROTTLE IMPLEMENTATION: prevent flood of updates (e.g. resize/drag)
    if (!throttles.has(itemId)) {
        throttles.set(itemId, { timer: null, latestArgs: [], isPending: false });
    }

    const status = throttles.get(itemId)!;
    status.latestArgs = [boardId, itemId, changes];

    // If timer is running, just update args (trailing edge will pick it up)
    if (status.timer) {
        status.isPending = true;
        return;
    }

    // Execute immediately (Leading Edge)
    executeRemoteUpdate(boardId, itemId, changes);

    // Start cooldown timer
    status.timer = setTimeout(() => {
        status.timer = null;
        if (status.isPending) {
            status.isPending = false;
            // Execute Trailing Edge if changes accumulated
            const [bId, iId, args] = status.latestArgs;
            executeRemoteUpdate(bId, iId, args);
        }
    }, 50); // 50ms throttle (20fps limit)
}

// Renamed original function
async function executeRemoteUpdate(boardId: string, itemId: string, changes: any) {
    const itemRef = ref(db, `boards/${boardId}/data/items/${itemId}`);

    // CRITICAL OPTIMIZATION: Exclude image data (src) from real-time position/size updates
    // This prevents massive data transfer when items are moved or resized
    // Image data should only be synced on initial save, not on every update
    const syncChanges: any = { ...changes };

    // FIX: Never sync 'ad' items to Firebase (Personal/Local only)
    if (itemId === 'ad-banner' || syncChanges.type === 'ad') {
        return;
    }

    // Sanitize blob and authenticated URLs - NEVER send them to Firebase as they are session-local
    if (syncChanges.src && typeof syncChanges.src === 'string' && (syncChanges.src.startsWith('blob:') || syncChanges.src.includes('access_token='))) {
        syncChanges.src = null;
    }
    if (syncChanges.url && typeof syncChanges.url === 'string' && (syncChanges.url.startsWith('blob:') || syncChanges.url.includes('access_token='))) {
        syncChanges.url = null;
    }

    // Remove undefined values (Firebase doesn't allow undefined)
    Object.keys(syncChanges).forEach(key => {
        if (syncChanges[key] === undefined) {
            delete syncChanges[key];
        }
    });

    // If updating position/size AND src is included, exclude src to save bandwidth
    // Only sync src if it's a new image upload (src is the ONLY change or explicitly new)
    if (syncChanges.src) {
        const hasOtherChanges = Object.keys(syncChanges).some(key => key !== 'src' && key !== 'hasChunks');

        if (hasOtherChanges) {
            // Position/size update: exclude image data
            // console.log(`[RefBoard] Excluding image data from position/size update for item ${itemId} to save bandwidth`); 
            delete syncChanges.src;
            // Keep hasChunks flag if it exists
        } else if (syncChanges.src.length > CHUNK_SIZE) {
            // New large image: save to chunks
            console.log(`[RefBoard] Item ${itemId} is large (${(syncChanges.src.length / 1024).toFixed(2)}KB). Splitting into chunks...`);

            try {
                await saveChunks(boardId, itemId, syncChanges.src);
                chunkCache[itemId] = syncChanges.src;
                syncChanges.src = null;
                syncChanges.hasChunks = true;
            } catch (error) {
                console.error('Failed to save chunks:', error);
                return;
            }
        }
        // Small new image: include it (only happens on initial upload)
    }

    // Safety check: Calculate approximate size (after chunking)
    const payloadSize = JSON.stringify(syncChanges).length;
    if (payloadSize > 5 * 1024 * 1024) { // 5MB limit warning
        console.warn(`[RefBoard] Update payload too large (${(payloadSize / 1024 / 1024).toFixed(2)}MB). Skipping sync to prevent errors.`);
        return;
    }

    update(itemRef, syncChanges).catch(error => {
        console.error('Failed to update remote item:', error);
    });
}

/**
 * Update multiple items in Firebase
 */
export async function updateRemoteItems(boardId: string, items: any[]) {
    const updates: any = {};
    let totalSize = 0;
    let skippedCount = 0;

    for (const item of items) {
        const itemPath = `boards/${boardId}/data/items/${item.id}`;
        const itemData = JSON.parse(JSON.stringify(item));

        // FIX: Skip Ad items in bulk sync
        if (itemData.type === 'ad') {
            continue;
        }

        // Sanitize blob and authenticated URLs - NEVER send them to Firebase as they are session-local
        if (itemData.src && typeof itemData.src === 'string' && (itemData.src.startsWith('blob:') || itemData.src.includes('access_token='))) {
            itemData.src = null;
        }
        if (itemData.url && typeof itemData.url === 'string' && (itemData.url.startsWith('blob:') || itemData.url.includes('access_token='))) {
            itemData.url = null;
        }

        // Check for large src
        if (itemData.src && itemData.src.length > CHUNK_SIZE) {
            console.log(`[RefBoard] Item ${item.id} is large. Splitting into chunks...`);
            await saveChunks(boardId, item.id, itemData.src);
            chunkCache[item.id] = itemData.src;
            itemData.src = null;
            itemData.hasChunks = true;
        }

        const itemSize = JSON.stringify(itemData).length;

        // Check individual item size (Firebase limit is ~10MB per write, but let's be safe with 9MB)
        if (itemSize > 9 * 1024 * 1024) {
            console.error(`[RefBoard] Item ${item.id} is too large (${(itemSize / 1024 / 1024).toFixed(2)}MB) to sync.`);
            skippedCount++;
            continue;
        }

        updates[itemPath] = itemData;
        totalSize += itemSize;
    }

    if (skippedCount > 0) {
        alert(`${skippedCount} items were too large to sync in real-time. Try resizing them or using lower resolution.`);
    }

    if (totalSize > 0) {
        update(ref(db), updates).catch(console.error);
    }
}

/**
 * Delete an item from Firebase
 */
export function deleteRemoteItem(boardId: string, itemId: string) {
    const itemRef = ref(db, `boards/${boardId}/data/items/${itemId}`);
    remove(itemRef).catch(console.error);

    // Also remove chunks if they exist
    const chunksRef = ref(db, `boards/${boardId}/chunks/${itemId}`);
    remove(chunksRef).catch(console.error);
}

/**
 * Subscribe to board data changes
 */
export function subscribeToBoardData(
    boardId: string,
    onItemsChange: (items: any[]) => void,
    onGroupsChange: (groups: any[]) => void,
    onArrowsChange: (arrows: any[]) => void,
    onPathsChange: (paths: any[]) => void,
    onConnectionsChange?: (connections: any[]) => void,
    onBoardNameChange?: (boardName: string) => void
): () => void {
    const dataRef = ref(db, `boards/${boardId}/data`);

    const handleValue = async (snapshot: any) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.items) {
            // Processing items for sync
            const itemsList: any[] = [];
            const invalidKeys: string[] = [];

            Object.entries(data.items).forEach(([key, value]: [string, any]) => {
                if (value && value.id) {
                    // FIX: Filter out incoming Ad items (they should be local only)
                    if (value.type !== 'ad') {
                        itemsList.push(value);
                    }
                } else {
                    // Collect invalid keys for cleanup
                    invalidKeys.push(key);
                }
            });

            // Auto-cleanup invalid items from Firebase
            if (invalidKeys.length > 0) {
                console.warn(`[Collaboration] Found ${invalidKeys.length} invalid items in Firebase. Cleaning up...`);
                const updates: any = {};
                invalidKeys.forEach(key => {
                    updates[`boards/${boardId}/data/items/${key}`] = null;
                });
                // Perform cleanup in background
                update(ref(db), updates).catch(err =>
                    console.error('[Collaboration] Failed to clean up invalid items:', err)
                );
            }

            // IMPORTANT: Don't load image data during real-time sync to save bandwidth
            // Only load images when they're missing (initial load) or when explicitly requested
            // For real-time updates, we only sync metadata (position, size, etc.)
            const processedItems = await Promise.all(itemsList.map(async (item: any) => {
                // Skip loading image data for real-time sync
                // Images should be loaded separately on initial board load
                // This prevents massive data transfer when items are moved/resized
                if (item.hasChunks && !item.src) {
                    // Only load chunks if we don't have the image locally
                    // Check if item exists locally first
                    const existingItem = chunkCache[item.id];
                    if (existingItem) {
                        item.src = existingItem;
                    } else {
                        // Don't auto-load chunks during real-time sync
                        // This will be loaded on initial board load or when needed
                        item.src = null; // Keep as null to indicate it needs to be loaded
                    }
                }
                // If item already has src (from initial load), keep it
                return item;
            }));

            onItemsChange(processedItems);
        } else {
            onItemsChange([]);
        }

        if (data.groups) {
            onGroupsChange(Object.values(data.groups));
        } else {
            onGroupsChange([]);
        }

        if (data.arrows) {
            onArrowsChange(Object.values(data.arrows));
        } else {
            onArrowsChange([]);
        }

        if (data.paths) {
            onPathsChange(Object.values(data.paths));
        } else {
            onPathsChange([]);
        }

        if (data.connections && onConnectionsChange) {
            onConnectionsChange(Object.values(data.connections));
        }
        // Don't clear connections if they don't exist in data - preserve local state

        // Sync board name if callback is provided
        if (data.boardName && onBoardNameChange) {
            onBoardNameChange(data.boardName);
        }
    };

    onValue(dataRef, handleValue);

    return () => {
        off(dataRef, 'value', handleValue);
    };
}

/**
 * Update generic data (groups, arrows, paths, connections)
 */
export function updateRemoteData(boardId: string, type: 'groups' | 'arrows' | 'paths' | 'connections' | 'bookmarks', data: any[]) {
    const updates: any = {};

    const dataObj: any = {};
    data.forEach(item => {
        dataObj[item.id] = item;
    });

    updates[`boards/${boardId}/data/${type}`] = JSON.parse(JSON.stringify(dataObj));
    update(ref(db), updates).catch(console.error);
}

/**
 * Add a single path to Firebase
 */
export function addRemotePath(boardId: string, path: any) {
    const pathRef = ref(db, `boards/${boardId}/data/paths/${path.id}`);
    set(pathRef, path).catch(console.error);
}

/**
 * Delete a single path from Firebase
 */
export function deleteRemotePath(boardId: string, pathId: string) {
    const pathRef = ref(db, `boards/${boardId}/data/paths/${pathId}`);
    remove(pathRef).catch(console.error);
}
