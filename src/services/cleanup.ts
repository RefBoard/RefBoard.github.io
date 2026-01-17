import { listFilesByFolder, deleteImageFromDrive, getOrCreateBoardImagesFolder } from './googleDrive';

export interface OrphanReport {
    orphans: {
        id: string;
        name: string;
        isAI: boolean;
        size?: string;
    }[];
    totalCount: number;
    aiCount: number;
    regularCount: number;
}

/**
 * Find files in Google Drive that are no longer referenced by the board
 */
export async function findOrphanFiles(boardItems: any[], boardId: string, boardName: string): Promise<OrphanReport> {
    // 1. Collect all referenced Drive File IDs
    const referencedIds = new Set<string>();

    boardItems.forEach(item => {
        if (item.driveFileId) {
            referencedIds.add(item.driveFileId);
        }
        // Also check generation history for each item (if any)
        if (item.generatedHistory && Array.isArray(item.generatedHistory)) {
            item.generatedHistory.forEach((h: any) => {
                if (h.driveFileId) {
                    referencedIds.add(h.driveFileId);
                }
            });
        }
    });

    try {
        // 2. Get the Images folder ID for this board
        const folderId = await getOrCreateBoardImagesFolder(boardId, boardName);

        // 3. List all files in that folder
        const driveFiles = await listFilesByFolder(folderId);

        // 4. Identify orphans
        const orphans = driveFiles
            .filter(file => !referencedIds.has(file.id))
            .map(file => ({
                id: file.id,
                name: file.name,
                isAI: file.name.startsWith('generation_node_'),
                size: (file as any).size
            }));

        const aiCount = orphans.filter(o => o.isAI).length;

        return {
            orphans,
            totalCount: orphans.length,
            aiCount,
            regularCount: orphans.length - aiCount
        };
    } catch (error) {
        console.error('Failed to find orphan files:', error);
        throw error;
    }
}

/**
 * Delete a list of files from Drive
 */
export async function cleanupFiles(fileIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Use Promise.allSettled to continue even if some deletions fail
    const results = await Promise.allSettled(
        fileIds.map(fileId => deleteImageFromDrive(fileId))
    );

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            success++;
        } else {
            failed++;
            console.error('Failed to delete file:', result.reason);
        }
    });

    return { success, failed };
}
