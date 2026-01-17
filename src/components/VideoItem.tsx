import React, { useState, useRef, useEffect } from 'react';
import { MediaItem as MediaItemType } from '../types';
import { loadImageFromDrive } from '../services/googleDrive';

interface VideoItemProps {
    item: MediaItemType;
    scale: number;
}

export const VideoItem: React.FC<VideoItemProps> = ({ item, scale }) => {
    // Calculate dynamic sizes based on zoom scale to keep UI readable
    const uiScale = Math.max(0.5, 1 / scale);
    const labelFontSize = 10 * uiScale;
    const buttonSize = 32 * uiScale;
    const iconSize = 16 * uiScale;
    const labelPaddingX = 6 * uiScale;
    const labelPaddingY = 3 * uiScale;
    const labelRadius = 4 * uiScale;
    const labelTopLeft = 8 * uiScale;

    // Use local state for URLs to prevent sync loops
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [localUrl, setLocalUrl] = useState<string | null>(null);

    const [reloadAttempts, setReloadAttempts] = useState(0);
    const MAX_RELOAD_ATTEMPTS = 3;
    const isReloadingRef = useRef(false);

    // Initial and synced URL
    const effectiveUrl = localUrl || item.url;
    // Determine if we have a playable source ready
    // CRITICAL: Only consider ready if we have a LOCAL URL (Blob)
    const isReadyToPlay = !!localUrl && !hasError;

    // Effect: Reset state on item.url change
    useEffect(() => {
        setHasError(false);
        setLocalUrl(null);
        setIsLoading(false);
        setIsPlaying(false);
    }, [item.url, item.driveFileId]);

    const loadVideo = async (shouldAutoPlay = false) => {
        if (!item.driveFileId || isLoading || isReloadingRef.current || localUrl) return;

        setIsLoading(true);
        console.log(`Loading video blob (AutoPlay: ${shouldAutoPlay}): ${item.id}`);

        try {
            // Load as blob (safe, bypasses CORS/403)
            const newUrl = await loadImageFromDrive(item.driveFileId, true, true);
            if (newUrl) {
                console.log(`Video blob loaded for ${item.id}`);
                setLocalUrl(newUrl);
                setHasError(false);

                if (shouldAutoPlay) {
                    setIsPlaying(true);
                }
            }
        } catch (err) {
            console.error('Failed to load video blob:', err);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Effect: Auto-load removed for performance. Now using direct drive thumbnail.
    // Fallback to blob load happens strictly on thumbnail error.

    const performReload = () => {
        if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) return;
        setReloadAttempts(p => p + 1);
        setLocalUrl(null);
        setHasError(false);
        // Retry loading with autoplay preference
        loadVideo(true);
    };

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        console.warn('Video playback error:', item.id, e.currentTarget.error);
        if (localUrl) {
            setHasError(true);
            setIsPlaying(false);
        }
    };

    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isReadyToPlay) {
            setIsPlaying(true);
        } else {
            // Not ready? Load it and PLAY IT.
            loadVideo(true);
        }
    };

    return (
        <div className="w-full h-full relative rounded-3xl overflow-hidden group" style={{ backgroundColor: '#000' }}>
            {isReadyToPlay ? (
                <video
                    key={effectiveUrl} // Re-mount if URL changes
                    className="w-full h-full object-contain"
                    src={effectiveUrl}
                    loop
                    muted={false}
                    playsInline
                    controls
                    controlsList="nofullscreen"
                    draggable={false}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={handleVideoError}
                    ref={(el) => {
                        if (el) {
                            if (isPlaying && el.paused) el.play().catch(() => { setIsPlaying(false); });
                            else if (!isPlaying && !el.paused) el.pause();
                        }
                    }}
                />
            ) : (
                // Placeholder / Loading State
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white/50">
                    {/* Lightweight Thumbnail (Poster) */}
                    {!isLoading && item.driveFileId && (
                        <img
                            src={`https://drive.google.com/thumbnail?id=${item.driveFileId}&sz=w800`}
                            alt="Video Thumbnail"
                            className="absolute inset-0 w-full h-full object-contain opacity-75 transition-opacity duration-300"
                            draggable={false}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                // If thumbnail fails (404), fallback to loading the actual video blob 
                                // to show the first frame (without autoplay)
                                console.warn(`Thumbnail failed for ${item.id}, falling back to blob...`);
                                e.currentTarget.style.display = 'none';
                                loadVideo(false);
                            }}
                        />
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center gap-2 z-10">
                            <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-xs font-medium drop-shadow-md text-white">Loading video...</span>
                        </div>
                    ) : (hasError) ? (
                        <div className="flex flex-col items-center gap-2 text-center px-4 z-10">
                            <span className="text-xs text-red-400 font-medium drop-shadow-md">Load Failed</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); performReload(); }}
                                className="mt-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] backdrop-blur-sm"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        // Idle state (Click to Load)
                        <div className="flex items-center justify-center z-10"></div>
                    )}
                </div>
            )}

            {/* Overlays (Label & Big Play Button) - Visible when NOT playing */}
            {!isPlaying && !isLoading && !hasError && (
                <>
                    <div
                        className="absolute bg-black/60 text-white font-bold z-10 backdrop-blur-md pointer-events-none transition-opacity duration-200 shadow-md flex items-center justify-center"
                        style={{
                            top: `${labelTopLeft}px`,
                            left: `${labelTopLeft}px`,
                            fontSize: `${labelFontSize}px`,
                            padding: `${labelPaddingY}px ${labelPaddingX}px`,
                            borderRadius: `${labelRadius}px`
                        }}
                    >
                        VIDEO
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div
                            className="bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-sm cursor-pointer transition-transform transform hover:scale-105 pointer-events-auto shadow-2xl border-2 border-white/20"
                            style={{
                                width: `${buttonSize}px`,
                                height: `${buttonSize}px`
                            }}
                            onClick={handlePlayClick}
                        >
                            <svg
                                style={{ width: `${iconSize}px`, height: `${iconSize}px`, marginLeft: `${iconSize * 0.1}px` }}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                </>
            )}

            {/* Pause Button Overlay (Hover when playing) */}
            {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div
                        className="bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-sm cursor-pointer transition-transform transform hover:scale-105 pointer-events-auto shadow-2xl border-2 border-white/20"
                        style={{
                            width: `${buttonSize}px`,
                            height: `${buttonSize}px`
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPlaying(false);
                        }}
                    >
                        <svg
                            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};
