// MediaItem.tsx - Static Version (DCM/Interaction Removed)
import React, { useState, useRef, memo } from 'react';
import { MediaItem as MediaItemType } from '../types';
import { loadImageFromDrive } from '../services/googleDrive';
import { GenerationNode } from './GenerationNode';
import { PromptNode } from './PromptNode';
import { VideoItem } from './VideoItem';
export type MediaItemData = MediaItemType;
// import { useCanvasRefs } from '../contexts/CanvasRefContext'; // Unused

// import { isValidBlob } from '../utils/blobRegistry';

interface MediaItemProps {
    item: MediaItemType;
    isSelected: boolean;
    onSelect: (id: string, multi: boolean) => void;
    // Keep these in interface to match parent usage
    onUpdate: (id: string, updates: Partial<MediaItemType>) => void;
    onInteractionStart?: (id: string) => void;
    onInteractionEnd?: (id: string) => void;
    scale: number;
    activeTool: 'select' | 'hand' | 'pen' | 'eraser';
    onSocketMouseDown: (nodeId: string, socketId: string, e: React.MouseEvent) => void;
    onSocketMouseUp: (nodeId: string, socketId: string) => void;
    onSocketMouseEnter?: (nodeId: string, socketId: string) => void;
    onSocketMouseLeave?: () => void;
    onGenerateNode?: (id: string) => void;
    isGenerating?: boolean;
    onContextMenu?: (e: React.MouseEvent) => void;
    onImageDoubleClick?: (id: string) => void;
}

const MediaItemComponent = ({ item, isSelected, onSelect, onUpdate, onInteractionStart, onInteractionEnd, scale, activeTool, onSocketMouseDown, onSocketMouseUp, onSocketMouseEnter, onSocketMouseLeave, onGenerateNode, isGenerating, onContextMenu, onImageDoubleClick }: MediaItemProps) => {
    // Only used for rendering content
    const [isLoaded, setIsLoaded] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load image from Drive (proactive for GenNodes and Blobs)
    const [loadedDriveUrl, setLoadedDriveUrl] = useState<string | null>(null);
    const [healedUrl, setHealedUrl] = useState<string | null>(null);

    // Use latest history timestamp to trigger updates when overwriting slots
    const latestTimestamp = item.generatedHistory?.[0]?.timestamp;

    React.useEffect(() => {
        // Reset healed URL on parent URL change
        setHealedUrl(null);

        // Proactively load from Drive if:
        // 1. It's a Generation Node (always needs fresh URL)
        // 2. It's an Image with a 'blob:' URL (likely invalid on other clients)
        if (item.driveFileId) {
            const isGenNode = item.type === 'generation_node';
            const isBlobImage = item.type === 'image' && (!item.url || item.url.startsWith('blob:'));

            if (isGenNode || isBlobImage) {
                loadImageFromDrive(item.driveFileId, true).then(url => {
                    setLoadedDriveUrl(url);
                }).catch(console.error);
            } else {
                setLoadedDriveUrl(null);
            }
        } else {
            setLoadedDriveUrl(null);
        }
    }, [item.driveFileId, item.fileName, item.url, latestTimestamp, item.type]);

    // Self-healing: Restore image if URL is broken
    const handleImageError = async () => {
        if (item.driveFileId && retryCount < 3) {
            console.log(`Attempting to heal broken image: ${item.id}`);
            setRetryCount(prev => prev + 1);
            try {
                const newUrl = await loadImageFromDrive(item.driveFileId);
                // Update local state only to prevent sync loops of local blob URLs
                setHealedUrl(newUrl);
            } catch (e) {
                console.error('Failed to heal image:', e);
            }
        }
    };

    // Effective URL priority: Healed (Fixes broken) > Loaded (Proactive Drive) > Sync URL
    const effectiveUrl = healedUrl || loadedDriveUrl || item.url;



    // Determine content based on type
    const renderContent = () => {
        if (item.type === 'image') {
            return (
                <div
                    className="relative w-full h-full pointer-events-auto"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (onImageDoubleClick) onImageDoubleClick(item.id);
                    }}
                >
                    <img
                        src={effectiveUrl}
                        alt=""
                        className="w-full h-full object-fill select-none pointer-events-none rounded-3xl shadow-sm"
                        draggable={false}
                        onLoad={() => setIsLoaded(true)}
                        onError={handleImageError}
                    />

                    {/* Image Input Handle (Left Top) - Image Icon */}
                    <div
                        className="absolute -left-12 top-4 w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair shadow-lg z-50 pointer-events-auto"
                        title="Image Input"
                        data-handle-type="target"
                        data-handle-id="image-input"
                        data-node-id={item.id}
                        onMouseDown={(e) => onSocketMouseDown(item.id, 'image-input', e)}
                        onMouseUp={(e) => { e.stopPropagation(); onSocketMouseUp(item.id, 'image-input'); }}
                        onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'image-input')}
                        onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
                    >
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-900 opacity-60"></div>
                        <svg className="w-4 h-4 text-gray-300 transform scale-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>

                    {/* Image Output Handle (Right Top) - Image Icon */}
                    <div
                        className="absolute -right-12 top-4 w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair shadow-lg z-50 pointer-events-auto"
                        title="Image Output"
                        data-handle-type="source"
                        data-handle-id="image-output"
                        data-node-id={item.id}
                        onMouseDown={(e) => onSocketMouseDown(item.id, 'image-output', e)}
                        onMouseUp={(e) => { e.stopPropagation(); onSocketMouseUp(item.id, 'image-output'); }}
                        onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'image-output')}
                        onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
                    >
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-900 opacity-60"></div>
                        <svg className="w-4 h-4 text-gray-300 transform scale-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
            );

        } else if (item.type === 'generation_node') {
            return (
                <GenerationNode
                    item={item}
                    onGenerate={() => {
                        console.log('Generate requested for:', item.id);
                        if (onGenerateNode) onGenerateNode(item.id);
                        if (onInteractionStart) onInteractionStart(item.id);
                    }}
                    onUpdate={onUpdate}
                    activeTool={activeTool as any}
                    driveImageUrl={loadedDriveUrl}
                    isGenerating={isGenerating}
                    onSocketMouseDown={onSocketMouseDown}
                    onSocketMouseUp={onSocketMouseUp}
                    onSocketMouseEnter={onSocketMouseEnter}
                    onSocketMouseLeave={onSocketMouseLeave}
                />
            );
        } else if (item.type === 'video') {
            return (
                <VideoItem
                    item={item}
                    scale={scale}
                />
            );

        } else if (item.type === 'prompt_node') {
            return (
                <PromptNode
                    item={item}
                    onUpdate={onUpdate}
                    onSocketMouseDown={onSocketMouseDown}
                    onSocketMouseUp={onSocketMouseUp}
                    onSocketMouseEnter={onSocketMouseEnter}
                    onSocketMouseLeave={onSocketMouseLeave}
                />
            );

        }
        return null;
    };

    // Helper: Opacity Logic
    // Images: Container always visible, child img visibility controlled by CSS
    // Videos/Ads: Always visible (No CanvasRenderer support).
    // Generation Nodes: Always visible (DOM rendering for interactive controls)
    const getOpacity = () => {
        if (item.type === 'image') {
            // Container always visible - CSS controls child img visibility
            return 1;
        }
        if (item.type === 'generation_node') {
            // Always visible - generation nodes need DOM for interactive controls and visibility
            return 1;
        }
        if (item.type === 'video' || item.type === 'ad' || item.type === 'prompt_node') {
            // Always visible - these need full DOM interaction
            return 1;
        }
        return isLoaded ? 1 : 0; // Fallback
    };

    // UI Scaling Optimization:
    const uiScale = Math.min(5, Math.max(0.4, 1 / scale));

    return (
        <div
            ref={containerRef}
            className={`media-item-wrapper absolute type-${item.type} ${isSelected ? 'selected' : ''}`}
            data-item-id={item.id}
            style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                // FIX: Ad type must ALWAYS be on top of everything
                zIndex: item.type === 'ad' ? 99999 : (isSelected ? 10000 : item.zIndex),
                pointerEvents: 'auto', // Allow selection
                opacity: getOpacity(),
                transition: 'none', // No transition to avoid flicker
                // Ad: Inverse scale to keep constant screen size. Transform Origin Top-Left (0 0) matches positionAd top-left anchor.
                transform: item.type === 'ad'
                    ? `scale(${1 / scale})`
                    : `rotate(${item.rotation || 0}deg) scaleX(${item.flipHorizontal ? -1 : 1}) scaleY(${item.flipVertical ? -1 : 1})`,
                transformOrigin: item.type === 'ad' ? '0 0' : 'center center',
                overflow: 'visible',
            }}
            onMouseDown={(e) => {
                if (e.button !== 0) return;
                // Video controls handling
                if (item.type === 'video' && (e.target as HTMLElement).tagName === 'VIDEO') {
                    onInteractionStart?.(item.id);
                    onSelect(item.id, e.shiftKey || false); // Don't block controls
                    return;
                }

                if (activeTool === 'select') {
                    onSelect(item.id, e.shiftKey);
                }
            }}
            onContextMenu={onContextMenu}
        >
            {renderContent()}

            {/* Rotation Handle - only show when selected */}

            {/* Rotation Handle - only show when selected */}
            {isSelected && (
                <div
                    className="rotation-handle-container"
                    style={{
                        position: 'absolute',
                        bottom: -40 * uiScale,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 10001,
                        pointerEvents: 'auto'
                    }}
                >
                    {/* Connecting Line */}
                    <div
                        style={{
                            width: 2 * uiScale,
                            height: 20 * uiScale,
                            background: '#3b82f6',
                            opacity: 0.6
                        }}
                    />

                    {/* Handle Circle */}
                    <div
                        className="rotation-handle"
                        style={{
                            width: 28 * uiScale,
                            height: 28 * uiScale,
                            background: '#3b82f6',
                            borderRadius: '50%',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `${2 * uiScale}px solid white`,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onInteractionStart?.(item.id);
                            // Start rotation drag
                            const startX = e.clientX;
                            const startRotation = item.rotation || 0;

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                const deltaX = moveEvent.clientX - startX;
                                // Sensitivity: adjust based on zoom to feel consistent
                                const rawRotation = (startRotation - (deltaX * 0.5) + 360) % 360;
                                // 25-degree snapping with Shift
                                const newRotation = moveEvent.shiftKey ? Math.round(rawRotation / 25) * 25 : rawRotation;
                                onUpdate(item.id, { rotation: newRotation });
                            };

                            const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                                onInteractionEnd?.(item.id);
                            };

                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                        }}
                    >
                        {/* Rotation Icon (circular arrow) */}
                        <svg
                            width={16 * uiScale}
                            height={16 * uiScale}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Resize Handles - all four corners (DISABLED for Ads) */}
            {isSelected && item.type !== 'ad' && (
                <>
                    {(['tl', 'tr', 'bl', 'br'] as const).map(corner => {
                        const isTop = corner.startsWith('t');
                        const isLeft = corner.endsWith('l');

                        // Icon mapping
                        const rotations = {
                            tl: 180,
                            tr: 270,
                            bl: 90,
                            br: 0
                        };

                        return (
                            <div
                                key={corner}
                                className={`resize-handle handle-${corner}`}
                                style={{
                                    position: 'absolute',
                                    top: isTop ? (corner === 'tr' ? -12 * uiScale : -12 * uiScale) : 'auto',
                                    bottom: !isTop ? -12 * uiScale : 'auto',
                                    left: isLeft ? -12 * uiScale : 'auto',
                                    right: !isLeft ? -12 * uiScale : 'auto',
                                    width: 40 * uiScale,
                                    height: 40 * uiScale,
                                    cursor: isTop === isLeft ? 'nwse-resize' : 'nesw-resize',
                                    zIndex: 10002,
                                    pointerEvents: 'auto',
                                    display: 'flex',
                                    alignItems: isTop ? 'flex-start' : 'flex-end',
                                    justifyContent: isLeft ? 'flex-start' : 'flex-end',
                                    padding: 2 * uiScale,
                                    opacity: 0, // Hidden by default
                                    transition: 'opacity 0.2s ease',
                                }}
                                // Hover effect via inline style logic or external CSS
                                // I'll use a hacky but effective mouseenter/leave for now if needed, 
                                // or better, just use a CSS class for hover on the container.
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onInteractionStart?.(item.id);
                                    const startMouseX = e.clientX;
                                    const startMouseY = e.clientY;
                                    const startWidth = item.width;
                                    const startHeight = item.height;
                                    const startX = item.x;
                                    const startY = item.y;
                                    const rotation = (item.rotation || 0);
                                    const rad = (rotation * Math.PI) / 180;
                                    const aspectRatio = startWidth / startHeight;

                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                        // Screen deltas
                                        const dx_scr = (moveEvent.clientX - startMouseX) / scale;
                                        const dy_scr = (moveEvent.clientY - startMouseY) / scale;

                                        // Project screen mouse movement onto item's local rotated axes
                                        // Local dX = dx*cos(theta) + dy*sin(theta)
                                        // Local dY = -dx*sin(theta) + dy*cos(theta)
                                        const localDx = dx_scr * Math.cos(rad) + dy_scr * Math.sin(rad);
                                        const localDy = -dx_scr * Math.sin(rad) + dy_scr * Math.cos(rad);

                                        let dw = 0;
                                        let dh = 0;

                                        // Corner logic for raw dimension change
                                        if (corner === 'br') { dw = localDx; dh = localDy; }
                                        else if (corner === 'bl') { dw = -localDx; dh = localDy; }
                                        else if (corner === 'tr') { dw = localDx; dh = -localDy; }
                                        else if (corner === 'tl') { dw = -localDx; dh = -localDy; }

                                        // Apply minimum size constraints based on item type
                                        const minWidth = item.type === 'generation_node' ? 550 : item.type === 'prompt_node' ? 400 : 20;
                                        const minHeight = item.type === 'generation_node' ? 750 : item.type === 'prompt_node' ? 250 : 20;

                                        let newWidth = Math.max(minWidth, startWidth + dw);
                                        let newHeight = Math.max(minHeight, startHeight + dh);

                                        // Always lock aspect ratio (no Shift key unlock)
                                        if (Math.abs(dw) > Math.abs(dh)) {
                                            newHeight = newWidth / aspectRatio;
                                            // Re-calculate local axes change based on locked ratio
                                            if (corner === 'tl' || corner === 'bl') dw = startWidth - newWidth;
                                            else dw = newWidth - startWidth;
                                            if (corner === 'tl' || corner === 'tr') dh = startHeight - newHeight;
                                            else dh = newHeight - startHeight;
                                        } else {
                                            newWidth = newHeight * aspectRatio;
                                            if (corner === 'tl' || corner === 'bl') dw = startWidth - newWidth;
                                            else dw = newWidth - startWidth;
                                            if (corner === 'tl' || corner === 'tr') dh = startHeight - newHeight;
                                            else dh = newHeight - startHeight;
                                        }

                                        // Adjust x, y to keep the opposite corner fixed
                                        // The center of the unrotated box moves by half of the local changes,
                                        // but we must rotate that movement back to world space.

                                        // Translation in local space to keep pivot fixed
                                        let localTransX = 0;
                                        let localTransY = 0;

                                        // If resizing from Right, pivot is Left (Trans = half change)
                                        // If resizing from Left, pivot is Right (Trans = -half change?)
                                        // Wait, the center of the box is (x+w/2, y+h/2).
                                        // The local movement of the center for BR resize is (dw/2, dh/2).
                                        // For TL resize, it is (-dw/2, -dh/2)... no, wait.

                                        if (corner === 'br') { localTransX = dw / 2; localTransY = dh / 2; }
                                        else if (corner === 'bl') { localTransX = -dw / 2; localTransY = dh / 2; }
                                        else if (corner === 'tr') { localTransX = dw / 2; localTransY = -dh / 2; }
                                        else if (corner === 'tl') { localTransX = -dw / 2; localTransY = -dh / 2; }

                                        // Rotate local translation back to world space
                                        const worldTransX = localTransX * Math.cos(rad) - localTransY * Math.sin(rad);
                                        const worldTransY = localTransX * Math.sin(rad) + localTransY * Math.cos(rad);

                                        // Center of original box: startX + startWidth/2
                                        // New center = startCenter + worldTrans
                                        // New X = newCenter - newWidth/2
                                        const newX = (startX + startWidth / 2 + worldTransX) - newWidth / 2;
                                        const newY = (startY + startHeight / 2 + worldTransY) - newHeight / 2;

                                        onUpdate(item.id, { width: newWidth, height: newHeight, x: newX, y: newY });
                                    };

                                    const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                        onInteractionEnd?.(item.id);
                                        // We don't hide the handle here because mouse might still be hovering or not.
                                        // The hover effect should resolve by state/CSS anyway.
                                    };

                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                }}
                            >
                                <svg
                                    width={28 * uiScale}
                                    height={28 * uiScale}
                                    viewBox="0 0 32 32"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    style={{
                                        filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))',
                                        opacity: 0.9,
                                        transform: `rotate(${rotations[corner]}deg)`
                                    }}
                                >
                                    <path d="M28 12 A 16 16 0 0 1 12 28" />
                                </svg>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

// Custom comparison function to prevent unnecessary re-renders, especially for videos
const areEqual = (prevProps: MediaItemProps, nextProps: MediaItemProps) => {
    // For videos, if URL hasn't changed, don't re-render (preserves playback state)
    if (prevProps.item.type === 'video' && nextProps.item.type === 'video') {
        if (prevProps.item.url !== nextProps.item.url) {
            return false; // URL changed, must re-render
        }
    }

    // Check other critical props
    if (prevProps.item.id !== nextProps.item.id) return false;
    if (prevProps.item.x !== nextProps.item.x) return false;
    if (prevProps.item.y !== nextProps.item.y) return false;
    if (prevProps.item.width !== nextProps.item.width) return false;
    if (prevProps.item.height !== nextProps.item.height) return false;
    if (prevProps.item.rotation !== nextProps.item.rotation) return false;
    if ((prevProps.item as any).flipHorizontal !== (nextProps.item as any).flipHorizontal) return false;
    if ((prevProps.item as any).flipVertical !== (nextProps.item as any).flipVertical) return false;
    if (prevProps.item.zIndex !== nextProps.item.zIndex) return false;
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.scale !== nextProps.scale) return false;
    if (prevProps.activeTool !== nextProps.activeTool) return false;

    // For images, also check URL changes
    if (prevProps.item.type === 'image' && nextProps.item.type === 'image') {
        if (prevProps.item.url !== nextProps.item.url) return false;
    }

    // For generation nodes, check driveFileId changes (ensures thumbnail clicks update immediately)
    if (prevProps.item.type === 'generation_node' && nextProps.item.type === 'generation_node') {
        if (prevProps.item.driveFileId !== nextProps.item.driveFileId) return false;
    }

    return true; // Props are equal, skip re-render
};

// Export memoized component with custom comparison
export const MediaItem = memo(MediaItemComponent, areEqual);
MediaItem.displayName = 'MediaItem';
