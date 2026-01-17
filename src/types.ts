// Shared type definitions for RefBoard

export interface MediaItem {
    id: string;
    type: 'image' | 'video' | 'ad' | 'prompt_node' | 'generation_node';
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    rotation?: number; // Rotation in degrees (0-360), default 0
    driveFileId?: string;
    // Additional properties for specific types
    prompt?: string; // For prompt_node
    generatedImage?: string; // For generation_node
    thumbnailUrl?: string; // For video/image thumbnails (lazy loading)


    // Generation/Prompt Node specific
    promptText?: string;
    nodeInputs?: Record<string, any>;
    generationParams?: {
        model: string;
        aspectRatio: string;
        resolution?: string;
        style: string;
        seed?: number;
        batchSize?: number; // 1, 2, 4, 8
    };
    src?: string; // For generated images (current one)
    generatedHistory?: Array<{
        id: string; // Unique ID for the history item
        src?: string;
        driveFileId?: string;
        timestamp: number;
        seed?: number;
    }>;
    fileName?: string; // For downloads
    originalFilePath?: string; // For file tracking
    flipHorizontal?: boolean;
    flipVertical?: boolean;
    currentFileSlot?: number; // 0-7 for circular file overwriting
}

export interface Connection {
    id: string;
    fromNodeId: string;
    fromSocketId: string;
    toNodeId: string;
    toSocketId: string;
    color?: string;
}
