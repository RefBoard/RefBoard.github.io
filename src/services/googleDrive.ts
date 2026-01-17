
import { refreshDriveAccessToken } from './googleIdentity';

const FOLDER_NAME = 'RefBoard';
const MIME_TYPE_FOLDER = 'application/vnd.google-apps.folder';
const MIME_TYPE_JSON = 'application/json';
const GOOGLE_CLIENT_ID = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';

interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
    owners?: {
        displayName: string;
        emailAddress: string;
    }[];
}

/**
 * Get access token from Firebase Auth
 */
function getAccessToken(): string | null {
    return sessionStorage.getItem('google_access_token');
}

/**
 * Robust fetch wrapper that handles token refresh and retries
 */
export async function authorizedFetch(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
    let token = getAccessToken();

    // Initial token check - try refresh if missing
    if (!token && retryCount === 0) {
        const refreshed = await refreshDriveAccessToken(GOOGLE_CLIENT_ID, false);
        if (refreshed) token = getAccessToken();
    }

    // Clone headers to avoid mutation issues
    const headers = new Headers(options.headers || {});
    if (token) {
        // Only set if not already set (allows caller to override, though unlikely needed)
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }

    const newOptions = { ...options, headers };
    const response = await fetch(url, newOptions);

    // Handle 401 Unauthorized OR 403 Forbidden (Unregistered caller / Token missing)
    if ((response.status === 401 || response.status === 403) && retryCount < 1) {
        console.log(`Drive API ${response.status}, attempting interactive refresh...`);
        const success = await refreshDriveAccessToken(GOOGLE_CLIENT_ID, true);

        if (success) {
            // Update token in headers for retry
            const newToken = getAccessToken();
            if (newToken) {
                headers.set('Authorization', `Bearer ${newToken}`);
                return authorizedFetch(url, { ...options, headers }, retryCount + 1);
            }
        }

        // If refresh fails or user cancels, dispatch error
        if (response.status === 401) {
            sessionStorage.removeItem('google_access_token');
            window.dispatchEvent(new Event('google_auth_error'));
        }
    }

    return response;
}

/**
 * Call Google Drive API
 */
async function callDriveAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await authorizedFetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        // Handle 204 No Content (if it returns error? usually not)
        // If DELETE returns 204, authorizedFetch returns response.ok=true?
        // fetch returns ok=true for 200-299.
        const errorText = await response.text().catch(() => '');
        throw new Error(`Drive API error (${response.status}): ${response.statusText} ${errorText}`);
    }

    // Handle 204 No Content (e.g., DELETE)
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

/**
 * Get or create RefBoard folder
 */
async function getOrCreateFolder(): Promise<string> {
    // Check if folder exists
    const query = `name='${FOLDER_NAME}' and mimeType='${MIME_TYPE_FOLDER}' and trashed=false`;
    const response = await callDriveAPI(`files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

    if (response.files && response.files.length > 0) {
        return response.files[0].id;
    }

    // Create folder
    const folderMetadata = {
        name: FOLDER_NAME,
        mimeType: MIME_TYPE_FOLDER,
    };

    const folder = await callDriveAPI('files', {
        method: 'POST',
        body: JSON.stringify(folderMetadata),
    });

    return folder.id;
}

/**
 * Get file metadata (including thumbnail)
 */
export async function getFileMetadata(fileId: string): Promise<{ id: string; name: string; thumbnailLink?: string }> {
    // Request specifically the thumbnailLink field
    const response = await callDriveAPI(`files/${fileId}?fields=id,name,thumbnailLink`);
    return response;
}

/**
 * Save board to Google Drive
 */
export async function saveBoardToDrive(boardData: any, boardName: string, fileId?: string, thumbnail?: string): Promise<string> {
    const folderId = await getOrCreateFolder();

    const metadata: any = {
        name: boardName,
        mimeType: MIME_TYPE_JSON,
        parents: fileId ? undefined : [folderId],
    };

    // Add thumbnail if provided
    if (thumbnail) {
        metadata.contentHints = {
            thumbnail: {
                image: thumbnail.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''),
                mimeType: 'image/png'
            }
        };
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(boardData) +
        closeDelimiter;

    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }

    const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await authorizedFetch(url, {
        method: fileId ? 'PATCH' : 'POST',
        headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
    });

    if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
    }

    const result = await response.json();

    // Create images folder immediately for new boards
    // This ensures the folder is ready when users start adding images
    if (!fileId) {
        try {
            await getOrCreateBoardImagesFolder(result.id, boardName);
            console.log(`Created images folder for new board: ${boardName}`);
        } catch (error) {
            // Don't fail the board save if folder creation fails
            console.warn('Failed to create images folder:', error);
        }
    }

    return result.id;
}

/**
 * Load board from Google Drive
 */
export async function loadBoardFromDrive(fileId: string): Promise<any> {
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }

    const response = await authorizedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);

    if (!response.ok) {
        throw new Error(`Failed to load: ${response.statusText}`);
    }

    return response.json();
}

/**
 * List all boards
 */
export async function listBoards(): Promise<DriveFile[]> {
    const folderId = await getOrCreateFolder();
    return listFilesByFolder(folderId, `mimeType='${MIME_TYPE_JSON}'`);
}

/**
 * List all files in a specific folder with optional query filter
 */
export async function listFilesByFolder(folderId: string, extraQuery: string = ''): Promise<DriveFile[]> {
    let query = `'${folderId}' in parents and trashed=false`;
    if (extraQuery) {
        query += ` and ${extraQuery}`;
    }

    const response = await callDriveAPI(
        `files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,thumbnailLink,size)&orderBy=modifiedTime desc`
    );

    return (response.files || []).map((file: any) => ({
        ...file,
        thumbnail: file.thumbnailLink
    }));
}

/**
 * Delete board
 */
export async function deleteBoard(fileId: string): Promise<void> {
    // Delete the board file
    await callDriveAPI(`files/${fileId}`, { method: 'DELETE' });

    // Also delete the board's images folder ({boardId}_images)
    try {
        const folderId = await getOrCreateFolder();
        // Try to find images folder by name pattern (might be Name_images or ID_images)
        // Since we only have fileId (boardId) here, we might miss Name_images if we don't know the name.
        // However, we can search by parent folder relationship maybe?
        // For now, let's just try to delete the ID based one as legacy cleanup. 
        // Ideally we should list all folders in RefBoard and delete the one matching logic.

        // Strategy: Search for ANY folder ending in _images that is a child of RefBoard? No that's dangerous.
        // Let's rely on the fact that if we switched to Name_images, we can't easily guess the name from ID alone without fetching metadata.
        // But let's at least update the variable name to be consistent.
        const imagesFolderName = `${fileId}_images`;

        // Find the images folder
        const query = `name='${imagesFolderName}' and mimeType='${MIME_TYPE_FOLDER}' and '${folderId}' in parents and trashed=false`;
        const response = await callDriveAPI(`files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

        if (response.files && response.files.length > 0) {
            const imagesFolderId = response.files[0].id;
            // Delete the images folder (this will also delete all files inside)
            await callDriveAPI(`files/${imagesFolderId}`, { method: 'DELETE' });
            console.log(`Deleted images folder for board ${fileId}`);
        }
    } catch (error) {
        // Don't fail the entire deletion if images folder cleanup fails
        console.warn('Failed to delete images folder:', error);
    }
}

/**
 * Delete image file from Google Drive
 * @param fileId - Drive file ID of the image to delete
 * @param boardId - Optional board ID to locate the images folder
 * @param boardName - Optional board name to locate the images folder
 */
export async function deleteImageFromDrive(fileId: string, boardId?: string, boardName?: string): Promise<void> {
    try {
        await callDriveAPI(`files/${fileId}`, { method: 'DELETE' });
        console.log('Image deleted from Drive:', fileId);

        // Check if the images folder is now empty and delete if so
        if (boardId) {
            try {
                const imagesFolderId = await getOrCreateBoardImagesFolder(boardId, boardName);
                const imagesFolderName = boardName ? `${boardName}_images` : `${boardId}_images`;
                await deleteFolderIfEmpty(imagesFolderId, imagesFolderName);
            } catch (error) {
                console.warn('Failed to check/delete empty images folder:', error);
                // Don't fail the image deletion if folder cleanup fails
            }
        }
    } catch (error) {
        console.error('Failed to delete image from Drive:', error);
        throw error;
    }
}

// ========== SHARING & PERMISSIONS ==========

export interface Permission {
    id: string;
    emailAddress?: string;
    displayName?: string;
    role: 'reader' | 'writer' | 'owner';
    type: 'user' | 'group' | 'domain' | 'anyone';
}

/**
 * Share board with user by email
 */
export async function shareBoard(fileId: string, email: string, role: 'reader' | 'writer'): Promise<void> {
    const permission = {
        type: 'user',
        role: role,
        emailAddress: email,
    };

    await callDriveAPI(`files/${fileId}/permissions?sendNotificationEmail=true`, {
        method: 'POST',
        body: JSON.stringify(permission),
    });
}

/**
 * Get list of users with access to board
 */
export async function getBoardPermissions(fileId: string): Promise<Permission[]> {
    const response = await callDriveAPI(`files/${fileId}/permissions?fields=permissions(id,emailAddress,displayName,role,type)`);
    return response.permissions || [];
}

/**
 * Remove user's access to board
 */
export async function removeBoardPermission(fileId: string, permissionId: string): Promise<void> {
    await callDriveAPI(`files/${fileId}/permissions/${permissionId}`, { method: 'DELETE' });
}

/**
 * Get shared boards (boards where current user is not owner)
 */
export async function listSharedBoards(): Promise<DriveFile[]> {
    // Query for boards shared with me - filter by MIME type to only get JSON files (RefBoard files)
    const query = `sharedWithMe=true and mimeType='${MIME_TYPE_JSON}' and trashed=false`;
    const response = await callDriveAPI(
        `files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,thumbnailLink,owners(displayName,emailAddress))&orderBy=modifiedTime desc`
    );

    return (response.files || []).map((file: any) => ({
        ...file,
        thumbnail: file.thumbnailLink
    }));
}

/**
 * Check if current user is owner of board
 */
export async function isOwner(fileId: string): Promise<boolean> {
    try {
        const response = await callDriveAPI(`files/${fileId}?fields=ownedByMe`);
        return response.ownedByMe === true;
    } catch {
        return false;
    }
}

// ========== IMAGE STORAGE ==========

/**
 * Delete folder if it's empty (no files inside)
 */
async function deleteFolderIfEmpty(folderId: string, folderName: string): Promise<void> {
    try {
        // Check if folder has any files
        const query = `'${folderId}' in parents and trashed=false`;
        const response = await callDriveAPI(`files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);

        const fileCount = response.files ? response.files.length : 0;

        if (fileCount === 0) {
            // Folder is empty, delete it
            await callDriveAPI(`files/${folderId}`, { method: 'DELETE' });
            console.log(`Deleted empty folder: ${folderName}`);
        } else {
            console.log(`Folder "${folderName}" is not empty (${fileCount} files), keeping it`);
        }
    } catch (error) {
        console.error(`Failed to check/delete folder "${folderName}":`, error);
        // Don't throw - this is a cleanup operation that shouldn't fail the main operation
    }
}

/**
 * Get or create board-specific images folder inside RefBoard folder
 * Each board has its own images folder to prevent filename conflicts
 * @param boardId - Board ID (used as fallback for folder name)
 * @param boardName - Board name (preferred for folder name, supports Korean)
 */
export async function getOrCreateBoardImagesFolder(boardId: string, boardName?: string): Promise<string> {
    const folderId = await getOrCreateFolder();

    // DEBUG: Log input parameters
    console.log('[getOrCreateBoardImagesFolder] boardId:', boardId, 'boardName:', boardName);

    // Use boardName if provided, otherwise fall back to boardId (backward compatibility)
    // Board Name Priority: Use boardName_images for new standard
    const imagesFolderName = boardName ? `${boardName}_images` : `${boardId}_images`;

    // DEBUG: Log final folder name
    console.log('[getOrCreateBoardImagesFolder] Creating/Finding folder:', imagesFolderName);

    // Check if board images folder exists
    // Note: Drive API search handles Korean characters automatically
    const query = `name='${imagesFolderName.replace(/'/g, "\\'")}' and mimeType='${MIME_TYPE_FOLDER}' and '${folderId}' in parents and trashed=false`;
    const response = await callDriveAPI(`files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

    if (response.files && response.files.length > 0) {
        console.log('[getOrCreateBoardImagesFolder] Found existing folder:', response.files[0].name);
        return response.files[0].id;
    }

    // Create board images folder
    const folderMetadata = {
        name: imagesFolderName,
        mimeType: MIME_TYPE_FOLDER,
        parents: [folderId],
    };

    const folder = await callDriveAPI('files', {
        method: 'POST',
        body: JSON.stringify(folderMetadata),
    });

    console.log('[getOrCreateBoardImagesFolder] Created new folder:', imagesFolderName);
    return folder.id;
}

/**
 * Get or create Images folder inside RefBoard folder (backward compatibility)
 * @deprecated Use getOrCreateBoardImagesFolder instead
 */
async function getOrCreateImagesFolder(): Promise<string> {
    // For backward compatibility, use a default board ID
    // This should only be used for legacy code that doesn't have boardId
    return getOrCreateBoardImagesFolder('default');
}

/**
 * Find file by name in Google Drive folder
 */
async function findFileByName(folderId: string, fileName: string): Promise<string | null> {
    try {
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
        const response = await callDriveAPI(`files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

        if (response.files && response.files.length > 0) {
            return response.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('Failed to find file:', error);
        return null;
    }
}

/**
 * Generate unique filename if file already exists (adds _copy01, _copy02, etc.)
 */
async function generateUniqueFileName(folderId: string, baseFileName: string): Promise<string> {
    const fileExt = baseFileName.split('.').pop() || '';
    const baseName = baseFileName.replace(`.${fileExt}`, '');

    // Check if base filename exists
    const existingFile = await findFileByName(folderId, baseFileName);
    if (!existingFile) {
        return baseFileName; // No conflict, use original name
    }

    // Find next available copy number
    let copyNumber = 1;
    let newFileName: string;
    do {
        newFileName = `${baseName}_copy${copyNumber.toString().padStart(2, '0')}.${fileExt}`;
        const existingCopy = await findFileByName(folderId, newFileName);
        if (!existingCopy) {
            return newFileName;
        }
        copyNumber++;
    } while (copyNumber < 1000); // Safety limit

    // Fallback: use timestamp
    return `${baseName}_copy${Date.now()}.${fileExt}`;
}

/**
 * Upload or update media file (image or video) in Google Drive
 * If file with same name exists and overwrite is true, it will be updated (overwritten)
 * If overwrite is false, generates unique filename with _copy01 suffix
 */
export async function uploadOrUpdateMediaInDrive(mediaData: string | File, fileName: string, overwrite: boolean = false, isVideo: boolean = false, boardId?: string, boardName?: string): Promise<string> {
    // Use boardId if provided, otherwise fallback to default folder (backward compatibility)
    const imagesFolderId = boardId
        ? await getOrCreateBoardImagesFolder(boardId, boardName)
        : await getOrCreateImagesFolder();
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }

    // If not overwriting, generate unique filename
    let finalFileName = fileName;
    if (!overwrite) {
        finalFileName = await generateUniqueFileName(imagesFolderId, fileName);
    }

    // Check if file with same name already exists
    const existingFileId = overwrite ? await findFileByName(imagesFolderId, finalFileName) : null;

    let mimeType: string;
    let byteArray: Uint8Array;

    // Handle File object (for videos)
    if (mediaData instanceof File) {
        mimeType = mediaData.type || (isVideo ? 'video/mp4' : 'image/png');
        const arrayBuffer = await mediaData.arrayBuffer();
        byteArray = new Uint8Array(arrayBuffer);
    } else {
        // Handle base64 string (for images)
        // Determine MIME type from data URL or file extension
        mimeType = 'image/png';
        if (mediaData.startsWith('data:')) {
            const match = mediaData.match(/data:([^;]+)/);
            if (match) {
                mimeType = match[1];
            }
        } else {
            const ext = fileName.split('.').pop()?.toLowerCase();
            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            else if (ext === 'gif') mimeType = 'image/gif';
            else if (ext === 'webp') mimeType = 'image/webp';
            else if (ext === 'mp4') mimeType = 'video/mp4';
            else if (ext === 'webm') mimeType = 'video/webm';
            else if (ext === 'mov') mimeType = 'video/quicktime';
        }

        // Extract base64 data if it's a data URL
        let mediaBytes: string;
        if (mediaData.startsWith('data:')) {
            mediaBytes = mediaData.split(',')[1];
        } else {
            mediaBytes = mediaData;
        }

        // Convert base64 to binary
        const byteCharacters = atob(mediaBytes);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        byteArray = new Uint8Array(byteNumbers);
    }

    // Upload using multipart upload (simpler approach)
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    // Build metadata - don't include parents for updates (causes 403 error)
    const metadata: any = {
        name: finalFileName, // Use final filename (may have _copy suffix)
        mimeType: mimeType,
    };

    // Only include parents for new files (not updates)
    if (!existingFileId) {
        metadata.parents = [imagesFolderId];
    }

    // Create multipart body
    const metadataJson = JSON.stringify(metadata);
    const encoder = new TextEncoder();

    // Build multipart body
    const parts: Uint8Array[] = [];

    // Part 1: Metadata
    parts.push(encoder.encode(delimiter));
    parts.push(encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'));
    parts.push(encoder.encode(metadataJson));

    // Part 2: File data
    parts.push(encoder.encode(delimiter));
    parts.push(encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`));
    parts.push(byteArray);

    // Closing delimiter
    parts.push(encoder.encode(closeDelimiter));

    // Calculate total length
    let totalLength = 0;
    for (const part of parts) {
        totalLength += part.length;
    }

    // Combine all parts
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        combined.set(part, offset);
        offset += part.length;
    }

    try {
        if (existingFileId) {
            // Update existing file
            const response = await authorizedFetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                    'Content-Length': totalLength.toString(),
                },
                body: combined,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText };
                }
                throw new Error(`Failed to update media: ${JSON.stringify(errorData)}`);
            }

            const result = await response.json();
            if (!result.id || result.id.trim() === '') {
                throw new Error(`Update succeeded but no file ID returned: ${JSON.stringify(result)}`);
            }
            console.log('Media updated successfully, file ID:', result.id);

            // Ensure permissions are set correctly on update as well
            try {
                await callDriveAPI(`files/${result.id}/permissions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone',
                    }),
                });
                console.log('Refreshed public read permission for file:', result.id);
            } catch (permError) {
                // Ignore permission error if it already exists or fails - user might already have access
                console.warn('Note: Failed to refresh permission for file (might already exist):', result.id, permError);
            }

            return result.id;
        } else {
            // Create new file
            const response = await authorizedFetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                    'Content-Length': totalLength.toString(),
                },
                body: combined,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText };
                }
                throw new Error(`Failed to upload media: ${JSON.stringify(errorData)}`);
            }

            const result = await response.json();
            if (!result.id) {
                throw new Error(`Upload succeeded but no file ID returned: ${JSON.stringify(result)}`);
            }
            console.log('Media uploaded successfully, file ID:', result.id);

            // Make the file accessible to anyone with the link (reader role)
            // This is crucial for shared boards so other users can see the media
            try {
                await callDriveAPI(`files/${result.id}/permissions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone',
                    }),
                });
                console.log('Set public read permission for file:', result.id);
            } catch (permError) {
                console.warn('Failed to set public permission for file:', result.id, permError);
                // Continue even if permission setting fails - better to have the file uploaded than fail completely
            }

            return result.id;
        }
    } catch (error) {
        console.error('Error uploading/updating media in Drive:', error);
        throw error;
    }
}

/**
 * Upload or update image in Google Drive (backward compatibility)
 * If file with same name exists and overwrite is true, it will be updated (overwritten)
 * If overwrite is false, generates unique filename with _copy01 suffix
 * @param boardId - Board ID to determine which images folder to use
 * @param boardName - Board name to determine which images folder to use
 */
export async function uploadOrUpdateImageInDrive(imageData: string, fileName: string, overwrite: boolean = false, boardId?: string, boardName?: string): Promise<string> {
    // Use boardId if provided, otherwise fallback to default folder (backward compatibility)
    const imagesFolderId = boardId
        ? await getOrCreateBoardImagesFolder(boardId, boardName)
        : await getOrCreateImagesFolder();
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }

    // If not overwriting, generate unique filename
    let finalFileName = fileName;
    if (!overwrite) {
        finalFileName = await generateUniqueFileName(imagesFolderId, fileName);
    }

    // Check if file with same name already exists
    const existingFileId = overwrite ? await findFileByName(imagesFolderId, finalFileName) : null;

    // Determine MIME type from data URL or file extension
    let mimeType = 'image/png';
    if (imageData.startsWith('data:')) {
        const match = imageData.match(/data:([^;]+)/);
        if (match) {
            mimeType = match[1];
        }
    } else {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
    }

    // Extract base64 data if it's a data URL
    let imageBytes: string;
    if (imageData.startsWith('data:')) {
        imageBytes = imageData.split(',')[1];
    } else {
        imageBytes = imageData;
    }

    // Convert base64 to binary
    const byteCharacters = atob(imageBytes);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Upload using multipart upload (simpler approach)
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    // Build metadata - don't include parents for updates (causes 403 error)
    const metadata: any = {
        name: finalFileName, // Use final filename (may have _copy suffix)
        mimeType: mimeType,
    };

    // Only include parents for new files (not updates)
    if (!existingFileId) {
        metadata.parents = [imagesFolderId];
    }

    // Create multipart body
    const metadataJson = JSON.stringify(metadata);
    const encoder = new TextEncoder();

    // Build multipart body
    const parts: Uint8Array[] = [];

    // Part 1: Metadata
    parts.push(encoder.encode(delimiter));
    parts.push(encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'));
    parts.push(encoder.encode(metadataJson));

    // Part 2: File data
    parts.push(encoder.encode(delimiter));
    parts.push(encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`));
    parts.push(byteArray);

    // Closing delimiter
    parts.push(encoder.encode(closeDelimiter));

    // Calculate total length
    let totalLength = 0;
    for (const part of parts) {
        totalLength += part.length;
    }

    // Combine all parts
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        combined.set(part, offset);
        offset += part.length;
    }

    // If file exists, update it; otherwise create new
    const url = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const response = await fetch(url, {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: combined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${existingFileId ? 'update' : 'upload'} image: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    // Set permission to 'anyone with the link' to match MediaItem logic
    try {
        await callDriveAPI(`files/${result.id}/permissions`, {
            method: 'POST',
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone',
            }),
        });
        console.log('Set public read permission for image:', result.id);
    } catch (permError) {
        console.warn('Failed to set public permission for image:', result.id, permError);
    }

    return result.id;
}

/**
 * Upload image to Google Drive and return file ID (creates new file, doesn't overwrite)
 */
export async function uploadImageToDrive(imageData: string, fileName: string, boardId?: string, boardName?: string): Promise<string> {
    return uploadOrUpdateImageInDrive(imageData, fileName, false, boardId, boardName);
}

/**
 * Get image URL from Google Drive file ID
 * Returns a URL that can be used in img src
 */
export function getImageUrlFromDrive(fileId: string): string {
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }
    // Use the webContentLink or create a direct download URL
    // For authenticated access, we'll need to use the files API with alt=media
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`;
}

/**
 * Load media (image or video) from Google Drive as blob URL
 */
export async function loadMediaFromDrive(fileId: string, cacheBust: boolean = false): Promise<string> {
    const token = getAccessToken();
    if (!token) {
        throw new Error('No access token');
    }

    const MAX_RETRIES = 3;
    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Backoff delay for retries
            if (attempt > 0) {
                const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Add cache busting parameter if requested (for refreshed images)
            const url = cacheBust
                ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&t=${Date.now()}`
                : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

            const response = await authorizedFetch(url, {
                headers: {
                    // Authorization header added by authorizedFetch
                },
                cache: cacheBust ? 'no-cache' : 'default',
            });

            if (!response.ok) {
                // If 5xx error (Server Error), throw to trigger retry logic
                if (response.status >= 500 && response.status < 600) {
                    throw new Error(`Server error ${response.status}`);
                }

                // If 403 Forbidden, the media might not be shared with current user
                if (response.status === 403) {
                    throw new Error(`Media is not accessible (403 Forbidden). File ID: ${fileId}. Please ask the board owner to share the media files.`);
                }
                // If 404 Not Found, the file doesn't exist or was deleted
                if (response.status === 404) {
                    throw new Error(`Media file not found (404 Not Found). File ID: ${fileId}. The file may have been deleted, the ID is incorrect, or you do not have permission to view it.`);
                }
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Failed to load media (${response.status}): ${response.statusText}. File ID: ${fileId}. Error: ${errorText}`);
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error: any) {
            lastError = error;
            // Only retry on server errors or network errors
            const isServerError = error.message.includes('Server error') || error.message.includes('500') || error.message.includes('502') || error.message.includes('503');

            if (attempt < MAX_RETRIES - 1 && isServerError) {
                console.warn(`Retry ${attempt + 1}/${MAX_RETRIES} for file ${fileId} due to: ${error.message}`);
                continue;
            }
            // For non-retriable errors or max retries reached, throw
            throw error;
        }
    }
    throw lastError;
}

/**
 * Load image or video from Google Drive
 * For images: returns a local blob URL (cached and reliable)
 * For videos: returns a direct Drive/Public URL (enables streaming and seeking)
 */
export async function loadImageFromDrive(fileId: string, cacheBust: boolean = false): Promise<string> {
    const token = getAccessToken();

    // Strategy 1: Use authenticated Blob creation if token is available.
    // This works for both images and videos and is the ONLY way to bypass CORS and 403 
    // for private files using the Drive API in a browser environment.
    if (token) {
        try {
            return await loadMediaFromDrive(fileId, cacheBust);
        } catch (error) {
            console.warn(`Authenticated media load failed for ${fileId}:`, error);
        }
    }

    // Strategy 2: Public URL fetch (fallback for non-logged-in users or public files)
    const publicViewUrl = `https://drive.google.com/uc?id=${fileId}&export=download${cacheBust ? `&t=${Date.now()}` : ''}`;

    try {
        const response = await fetch(publicViewUrl, {
            cache: cacheBust ? 'no-cache' : 'default',
        });

        if (response.ok) {
            const blob = await response.blob();
            console.log(`Loaded media via public URL: ${fileId}`);
            return URL.createObjectURL(blob);
        }

        console.log(`Public URL returned ${response.status} for ${fileId}`);
    } catch (error) {
        console.warn(`Public URL fetch failed for ${fileId}:`, error);
    }

    // Final Fallback: Return the public URL directly
    return publicViewUrl;
}

/**
 * Share image file with user by email
 */
export async function shareImage(imageFileId: string, email: string, role: 'reader' | 'writer'): Promise<void> {
    await shareBoard(imageFileId, email, role);
}

/**
 * Share multiple images/videos with user
 */
export async function shareImages(imageFileIds: string[], email: string, role: 'reader' | 'writer'): Promise<void> {
    await Promise.all(imageFileIds.map(fileId => shareImage(fileId, email, role)));
}

/**
 * Share multiple media files (images/videos) with user (alias for shareImages)
 */
export async function shareMediaFiles(mediaFileIds: string[], email: string, role: 'reader' | 'writer'): Promise<void> {
    await shareImages(mediaFileIds, email, role);
}

/**
 * Fix permissions for a list of media files
 * Sets 'reader' permission for 'anyone' to ensure shared visibility
 */
export async function fixMediaPermissions(fileIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        await Promise.all(batch.map(async (fileId) => {
            try {
                // First check if permission already exists to avoid 400 errors?
                // Actually, the API might allow duplicates or just return the existing one.
                // But blindly adding 'anyone' 'reader' usually works or returns benign error.
                await callDriveAPI(`files/${fileId}/permissions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone',
                    }),
                });
                success++;
            } catch (error) {
                console.warn(`Failed to fix permission for file ${fileId}:`, error);
                failed++;
            }
        }));
    }

    return { success, failed };
}
