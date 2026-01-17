
import { useRef, useEffect, useImperativeHandle, forwardRef, useContext } from 'react';
import { MediaItemData } from './MediaItem';
import { TextItemData } from './TextItem';
import CanvasRefContext from '../contexts/CanvasRefContext';
import { loadImageFromDrive } from '../services/googleDrive';

export type BoardItem = MediaItemData | TextItemData;

export interface CanvasItemLayerRef {
    updateTracker: (id: string, x: number, y: number, isActive?: boolean) => void;
    clearTracker: (id: string) => void;
    setHiddenItems: (ids: string[]) => void;
    getItemAt: (x: number, y: number) => string | null;
    forceRedraw: () => void;
    setLODMode: (active: boolean) => void;
}

interface CanvasItemLayerProps {
    items: BoardItem[];
    selectedIds: string[];
    onRender?: () => void;
    onImageDoubleClick?: (id: string) => void;
}

export const CanvasItemLayer = forwardRef<CanvasItemLayerRef, CanvasItemLayerProps>(({
    items,
    selectedIds,
    onRender
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // LOD Cache: Stores both optimization and original
    type CachedImageData = {
        thumbnail: ImageBitmap | HTMLImageElement; // 512px optimized
        original?: HTMLImageElement; // Full resolution (Optional lazy load)
        width: number;
        height: number;
        sourceKey?: string;
        lastUsed?: number;
        loading?: boolean;
    };
    const imageCache = useRef<Map<string, CachedImageData>>(new Map());
    const failedImagesCache = useRef(new Set<string>()); // Track failed image IDs to prevent retry spam
    const ghostPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
    const hiddenItemIdsRef = useRef<Set<string>>(new Set());

    // Get distinct refs from context for high-perf sync
    const { positionRef, scaleRef, visualTransformRef } = useContext(CanvasRefContext);

    // Helper to get effective position (ghost or real)
    const getItemPos = (item: BoardItem) => {
        const ghost = ghostPositionsRef.current[item.id];
        return ghost ? { ...item, x: ghost.x, y: ghost.y } : item;
    };

    // Track loading state to prevent duplicates
    const loadingIds = useRef(new Set<string>());

    // RAF loop control - Unique ID to identifying the active loop
    const activeLoopIdRef = useRef<number | null>(null);
    const lastDrawTimeRef = useRef(0);
    // Explicit LOD Control from Parent
    const isLODActiveRef = useRef(false);

    // State Refs to allow persistent loop without closure staleness
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    // Memory Managed Image Loader
    const loadItemImage = (_item: BoardItem) => {
        const item = _item as any; // Cast for property access
        // Determine effective source key (Drive ID or Src)
        const sourceKey = item.driveFileId || item.src || item.url;
        if (!sourceKey) return;

        const cached = imageCache.current.get(item.id) as any;

        // Skip if fully loaded (original exists) or currently loading
        // Check sourceKey to handle updates (if source changes, we reload)
        if (cached && cached.sourceKey === sourceKey) {
            if (cached.original || cached.loading) return;
        }

        // Prevent concurrent loads for same ID
        if (loadingIds.current.has(item.id)) return;

        // Mark loading
        if (cached) cached.loading = true;
        loadingIds.current.add(item.id);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        // Cleanup helper
        const cleanup = () => {
            if (cached) cached.loading = false;
            loadingIds.current.delete(item.id);
        };

        img.onload = () => {
            // Performance Optimization: Aggressive Thumbnailing (LOD)
            const LOD_THRESHOLD = 512; // User requested 512px
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // Reuse existing thumbnail if present (avoid expensive regen)
            const existingInternalParams = imageCache.current.get(item.id);
            if (existingInternalParams && existingInternalParams.thumbnail && existingInternalParams.thumbnail !== existingInternalParams.original) {
                // Update with new original, keep thumbnail
                imageCache.current.set(item.id, {
                    ...existingInternalParams,
                    original: img,
                    sourceKey: sourceKey,
                    lastUsed: Date.now(),
                    loading: false
                });
                cleanup();
                draw();
                return;
            }

            // Calculate thumbnail dimensions
            let thumbWidth = width;
            let thumbHeight = height;
            if (thumbWidth > LOD_THRESHOLD || thumbHeight > LOD_THRESHOLD) {
                const scale = Math.min(LOD_THRESHOLD / thumbWidth, LOD_THRESHOLD / thumbHeight);
                thumbWidth = Math.floor(thumbWidth * scale);
                thumbHeight = Math.floor(thumbHeight * scale);
            }

            // Create thumbnail
            createImageBitmap(img, { resizeWidth: thumbWidth, resizeHeight: thumbHeight, resizeQuality: 'high' })
                .then((bitmap) => {
                    // Store both
                    imageCache.current.set(item.id, {
                        thumbnail: bitmap,
                        original: img,
                        sourceKey: sourceKey,
                        width: width,
                        height: height,
                        lastUsed: Date.now(),
                        loading: false
                    });
                    cleanup();
                    draw();
                })
                .catch(err => {
                    console.warn('Bitmap creation failed, falling back to image', err);
                    // Fallback: Thumbnail is Original
                    imageCache.current.set(item.id, {
                        thumbnail: img,
                        original: img,
                        sourceKey: sourceKey,
                        width: width,
                        height: height,
                        lastUsed: Date.now(),
                        loading: false
                    });
                    cleanup();
                    draw();
                });
        };

        img.onerror = (e) => {
            console.error('Failed to load image:', item.id, e);
            cleanup();
        };

        // If item has driveFileId, load from Google Drive
        if (item.driveFileId && (!item.src || item.src === '' || item.src.startsWith('blob:'))) {
            // Skip if this Drive file has already failed (prevents CORS error spam)
            if (failedImagesCache.current?.has(item.driveFileId)) {
                cleanup();
                return;
            }

            loadImageFromDrive(item.driveFileId, false)
                .then((blobUrl) => {
                    img.src = blobUrl;
                })
                .catch(() => {
                    // Mark as failed to prevent future retry attempts
                    failedImagesCache.current?.add(item.driveFileId!);
                    console.warn(`Failed to load image from Drive (will not retry): ${item.driveFileId}`);
                    cleanup();
                });
        } else if (item.src) {
            // Handle local paths for Electron/Canvas (Windows Drive Letter Check)
            let src = item.src;
            if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('file:') && !src.startsWith('blob:')) {
                if (/^[a-zA-Z]:/.test(src)) {
                    src = `file:///${src.replace(/\\/g, '/')}`;
                }
            }
            img.src = src;
        } else {
            // No source?
            cleanup();
        }
    };

    // Initial Load Effect
    useEffect(() => {
        items.forEach(item => {
            if (item.type === 'image' || item.type === 'ad') {
                loadItemImage(item);
            }
        });
        // Cleanup cache logic will be added separately
    }, [items]);

    // Memory Cleanup (Unload unused originals)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            imageCache.current.forEach((cached: any) => {
                // If original exists and unused for 5s, unload it to save RAM
                // This ensures "Outside yellow area" items revert to thumbnails
                if (cached.original && (now - (cached.lastUsed || 0) > 5000)) {
                    cached.original = null;
                }
            });
        }, 2000); // Check every 2s
        return () => clearInterval(interval);
    }, []);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // LOD SECURITY CHECK: Only draw if explicitly enabled by parent (or debugging)
        // This ensures exact synchronization with DOM visibility.
        // We allow drawing if LOD is active OR if we have selection outlines to draw (handled separately?)
        // Ideally, CanvasItemLayer handles BOTH LOD items and Selection Outlines.
        // If LOD is OFF, we should only draw Selection Outlines?
        // Current logic draws items conditionally.

        // PREVENT DUPLICATES: Hard throttle to 5ms (approx 200fps cap)
        // This ensures we never draw twice in the same frame even if called from multiple sources
        const now = performance.now();
        if (now - lastDrawTimeRef.current < 5) {
            return;
        }
        lastDrawTimeRef.current = now;

        // Resize canvas to match window/container
        // We'll rely on parent for size, or set it here. 
        // Best to set it to 100% of parent.
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Check if resize needed
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }

        // ALWAYS reset transform and clear canvas to avoid ghosting
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply DPR scaling for sharp rendering
        ctx.scale(dpr, dpr);

        // DRAWING LOGIC: Handle Viewport Culling
        // CRITICAL BUG FIX: At very low zoom levels, culling becomes inaccurate/flickering.
        // We disable culling if scale is < 0.2 to ensure high-density patterns render correctly.
        // Determine viewport bounds in world space
        // Use visualTransformRef for real-time synchronization during zoom
        const s = visualTransformRef.current.scale;
        const tx = visualTransformRef.current.x;
        const ty = visualTransformRef.current.y;

        const viewportX = -tx / s;
        const viewportY = -ty / s;
        const viewportW = canvas.width / (dpr * s);
        const viewportH = canvas.height / (dpr * s);

        // Apply Viewport Transform from Refs (Real-time)
        ctx.translate(tx, ty);
        ctx.scale(s, s);

        // LOD: Disable Culling at extreme zoom (< 0.2) to prevent flickering artifacts
        // At this scale, most items are effectively visible on screen anyway, or the user is looking at the whole board.
        // Precision issues with culling at large coordinate inputs might cause flickering.
        const shouldCull = s >= 0.2;

        // Sort items by zIndex
        // Filter out hidden items AND off-screen items
        // CRITICAL: Use effective position (Handle Ghosts) BEFORE Culling!
        // Use Refs to avoid stale closure in persistent loop
        const currentSelectedIds = selectedIdsRef.current;
        const sortedItems = [...itemsRef.current]
            .map(item => getItemPos(item)) // Get current visual position (including drag ghosts)
            .filter(item => {
                // Must not be hidden
                if (hiddenItemIdsRef.current.has(item.id)) return false;

                // ALWAYS render on canvas now (no more DCM/DOM visual switching)
                // Note: We might want to keepisActive check if we still use DOM for dragging,
                // but user wants unified 2D Canvas.


                // VISIBILITY FIX: Exempt ADs from culling to prevent them disappearing during zoom
                if (shouldCull && item.type !== 'ad') {
                    // Consider rotation? Bounding box would be safer, but for AABB check:
                    // If item rotates, its bounds expand. A simple margin helps.
                    // Or just calculating rotated bounds is better.
                    // For now, generous margin of largest dim is safe enough.
                    const margin = Math.max(item.width, item.height);

                    const itemRight = item.x + item.width;
                    const itemBottom = item.y + item.height;

                    // Simple AABB overlap test with margin
                    if (itemRight + margin < viewportX) return false;
                    if (item.x - margin > viewportX + viewportW) return false;
                    if (itemBottom + margin < viewportY) return false;
                    if (item.y - margin > viewportY + viewportH) return false;
                }

                return true;
            })
            .sort((a, b) => {
                // VISUAL FIX: Selected items should always appear on top
                const isASelected = selectedIds.includes(a.id);
                const isBSelected = selectedIds.includes(b.id);

                if (isASelected && !isBSelected) return 1;
                if (!isASelected && isBSelected) return -1;

                // Sort by zIndex
                const zDiff = (a.zIndex || 0) - (b.zIndex || 0);
                if (zDiff !== 0) return zDiff;

                // STABILITY FIX: If zIndex is equal, use id as tiebreaker
                // This prevents random order changes that cause flicker on overlapping images
                return a.id.localeCompare(b.id);
            });

        // DEBUG: Track Canvas LOD rendering
        let textRenderedCount = 0;
        let nodeRenderedCount = 0;
        const renderedTextIds: string[] = [];

        sortedItems.forEach(effectiveItem => {
            // effectiveItem is already the resolved position
            ctx.save();

            // Translate to item center for rotation
            const cx = effectiveItem.x + effectiveItem.width / 2;
            const cy = effectiveItem.y + effectiveItem.height / 2;

            ctx.translate(cx, cy);

            if (effectiveItem.type === 'image' || effectiveItem.type === 'ad' || effectiveItem.type === 'video') { // MediaItem types
                const mediaItem = effectiveItem as MediaItemData;
                if (mediaItem.rotation) ctx.rotate((mediaItem.rotation * Math.PI) / 180);
                if (mediaItem.flipHorizontal || mediaItem.flipVertical) {
                    ctx.scale(
                        mediaItem.flipHorizontal ? -1 : 1,
                        mediaItem.flipVertical ? -1 : 1
                    );
                }
            }

            // Move back to top-left relative to center
            ctx.translate(-effectiveItem.width / 2, -effectiveItem.height / 2);

            // 1. Queue Image Loading (LOD independent - always cache needed for canvas)
            if (effectiveItem.type === 'image' || effectiveItem.type === 'ad') {
                const sourceKey = (effectiveItem as any).driveFileId
                    ? `drive:${(effectiveItem as any).driveFileId}`
                    : effectiveItem.src;

                // Check Cache
                if (sourceKey && !imageCache.current.has(effectiveItem.id)) {
                    loadItemImage(effectiveItem);
                }
            }


            // Draw Item
            // NOTE: Videos are NEVER rendered on canvas - they're always DOM-only to prevent flickering
            // NOTE: Selected images are ONLY rendered in DOM to ensure proper z-index stacking
            if (effectiveItem.type === 'ad') {
                // AD RENDERING (Matches React MediaItem.tsx)
                // 1. Reset standard item transform (center-origin) to apply top-left origin + inverse scale
                ctx.restore();
                ctx.save();

                // 2. Apply Ad Transform (Top-Left Origin, Inverse Scale)
                const s = Math.max(0.0001, scaleRef.current); // Prevent div by zero
                ctx.translate(effectiveItem.x, effectiveItem.y);
                ctx.scale(1 / s, 1 / s);

                // 3. Draw Container (White BG, Yellow Border)
                // Width/Height are original dimensions (728x90), scaled up by 1/s to look constant on screen
                const w = effectiveItem.width;
                const h = effectiveItem.height;

                // Shadow (Simple)
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetY = 5;

                // Background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.shadowColor = 'transparent'; // Reset shadow

                // Yellow Border (Inner/Outer?) - React uses border-4 (inset-ish in DOM box model, takes space)
                // Canvas stroke is centered on path.
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#facc15'; // yellow-400
                ctx.strokeRect(0, 0, w, h);

                // Labels "AD"
                ctx.fillStyle = '#eab308'; // yellow-500
                ctx.beginPath();
                ctx.moveTo(w, 0);
                ctx.lineTo(w, 20);
                ctx.lineTo(w - 25, 20); // Rounded-bl-lg approx?
                ctx.lineTo(w - 25, 0);
                ctx.fill();

                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.fillText('AD', w - 18, 13);

                // Image or Placeholder
                const cached = imageCache.current.get(effectiveItem.id);
                // Check if image is valid
                let drawn = false;
                if (cached) {
                    let source = cached.thumbnail;
                    if (effectiveItem.width > 512 && (cached as any).original) source = (cached as any).original;
                    if (source instanceof ImageBitmap || (source instanceof HTMLImageElement && source.complete)) {
                        ctx.drawImage(source, 0, 0, w, h);
                        drawn = true;
                    }
                }

                if (!drawn) {
                    // Placeholder Text
                    ctx.fillStyle = '#9ca3af'; // gray-400
                    ctx.font = 'bold 14px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('AD SPACE', w / 2, h / 2 - 5);
                    ctx.fillStyle = '#d1d5db'; // gray-300
                    ctx.font = '10px Inter, sans-serif';
                    ctx.fillText('Waiting for content...', w / 2, h / 2 + 10);
                    ctx.textAlign = 'left'; // Reset
                }

            } else if (effectiveItem.type === 'image') {
                // Skip canvas rendering for selected images - they appear in DOM layer with high z-index
                const isItemSelected = currentSelectedIds.includes(effectiveItem.id);
                if (isItemSelected) {
                    // Selected images are handled by DOM layer only
                } else {
                    const cached = imageCache.current.get(effectiveItem.id);
                    if (cached) {
                        // LOD Logic: Use board logical size (not screen size)
                        // This ensures quality is maintained regardless of zoom level
                        // If user resized the item to 600px on board, always use original
                        // If user resized to 300px, thumbnail is sufficient

                        // Use board logical dimensions for LOD decision
                        const useOriginal = effectiveItem.width > 512 || effectiveItem.height > 512;
                        let source = cached.thumbnail;

                        // Dynamic Resolution & Memory Handling
                        if (useOriginal) {
                            const cachedData = cached as any;
                            if (cachedData.original) {
                                source = cachedData.original;
                                cachedData.lastUsed = Date.now(); // Touch: Mark as active
                            } else {
                                // Needed but missing (Lazy Load)
                                // Trigger load if not already loading (loadItemImage handles dup checks)
                                loadItemImage(effectiveItem);
                                // Fallback to thumbnail while loading
                            }
                        } else {
                            // Low res mode - do not touch lastUsed, let it expire
                        }

                        // Basic check for readiness
                        if (source instanceof ImageBitmap || (source instanceof HTMLImageElement && source.complete)) {
                            ctx.drawImage(source, 0, 0, effectiveItem.width, effectiveItem.height);
                        }
                    } else {
                        // Placeholder for images ONLY
                        ctx.fillStyle = '#333';
                        ctx.fillRect(0, 0, effectiveItem.width, effectiveItem.height);
                        ctx.fillStyle = '#666';
                        ctx.fillText('Loading...', 10, 20);
                    }
                }
            } else if (effectiveItem.type === 'text') {
                // Text is always rendered in DOM (not on Canvas) to ensure proper editing and positioning
                // Canvas rendering disabled due to positioning inconsistencies
                /*
                const isItemSelected = currentSelectedIds.includes(effectiveItem.id);
                if (!isItemSelected) {
                    textRenderedCount++;
                    renderedTextIds.push(effectiveItem.id);
                    const textItem = effectiveItem as TextItemData;
                    ctx.font = `${textItem.fontSize}px ${textItem.fontFamily}, sans-serif`;
```
                    ctx.fillStyle = textItem.color;
                    ctx.textBaseline = 'top';
                    ctx.fillText(textItem.content, 8, 8);
                }
                */
            } else if (effectiveItem.type === 'prompt_node') {
                // PromptNode: Only render as ghost during drag (always DOM otherwise)
                const isGhost = !!ghostPositionsRef.current[effectiveItem.id];

                if (isGhost) {
                    nodeRenderedCount++;
                    // Draw simple ghost placeholder
                    ctx.fillStyle = '#1e1e1e';
                    ctx.strokeStyle = '#444';
                    ctx.lineWidth = 1;
                    ctx.fillRect(0, 0, effectiveItem.width, effectiveItem.height);
                    ctx.strokeRect(0, 0, effectiveItem.width, effectiveItem.height);

                    // Header
                    ctx.fillStyle = '#333';
                    ctx.fillRect(0, 0, effectiveItem.width, 40);
                    ctx.fillStyle = '#fff';
                    ctx.font = '14px Inter, sans-serif';
                    ctx.fillText('Prompt', 10, 25);
                }
            }

            // Selection Outline - Apply to ANY selected item (EXCEPT text items which use DOM handles)
            if (currentSelectedIds.includes(effectiveItem.id) && effectiveItem.type !== 'text') {
                ctx.strokeStyle = '#3b82f6';
                // 3px constant visual thickness
                ctx.lineWidth = 3 / scaleRef.current;
                // Slightly inset/outset doesn't matter much on canvas, but let's draw exactly at bounds
                ctx.strokeRect(0, 0, effectiveItem.width, effectiveItem.height);
            }

            ctx.restore();
        });

        ctx.restore();

        // DEBUG: Log Canvas LOD rendering
        // const totalCanvasRendered = textRenderedCount + nodeRenderedCount;
        // if ((totalCanvasRendered > 0 || isLODActiveRef.current) && scaleRef.current < 0.3) {
        // const uniqueTextIds = new Set(renderedTextIds);
        // const hasDuplicates = uniqueTextIds.size !== renderedTextIds.length;
        // 
        // console.log(`[Canvas LOD] Zoom: ${Math.round(scaleRef.current * 100)}% | Text: ${textRenderedCount} | Nodes: ${nodeRenderedCount} | Total: ${totalCanvasRendered}${hasDuplicates ? ' ⚠️ DUPLICATES DETECTED!' : ''}`);
        // 
        // if (hasDuplicates) {
        //     const duplicates = renderedTextIds.filter((id, index) => renderedTextIds.indexOf(id) !== index);
        //     console.error('[Canvas LOD] Duplicate text IDs:', duplicates);
        // }
        // }

        if (onRender) onRender();
    };

    // Animate loop or Draw on updates
    // For now, draw on deps change.
    // Smart Loop State Refs
    const lastRenderStateRef = useRef({
        scale: 1,
        x: 0,
        y: 0,
        itemCount: 0,
        selectedCount: 0,
        ghostSignature: '',
        hiddenSignature: '',
        forceDraw: false
    });

    // Helper to generate signature for volatile hashmaps
    const getGhostSignature = () => {
        const keys = Object.keys(ghostPositionsRef.current);
        if (keys.length === 0) return '';
        // fast signature: length + first key + last key position? 
        // Safer: join all keys + one value. 
        // Since we only maintain active ghosts, simple key check + first val is reasonably fast check
        // Full JSON stringify is slow.
        return keys.length + keys.join(',') + (keys.length > 0 ? ghostPositionsRef.current[keys[0]].x : '');
    };

    const getHiddenSignature = () => {
        return hiddenItemIdsRef.current.size + Array.from(hiddenItemIdsRef.current).join(',');
    };

    // Imperative trigger for force redraws (e.g. image loaded)
    const triggerForceDraw = () => {
        lastRenderStateRef.current.forceDraw = true;
    };

    // Animate loop or Draw on updates
    useEffect(() => {
        // Unique ID for this loop instance to handle race conditions
        const loopId = Date.now() + Math.random();
        activeLoopIdRef.current = loopId;

        const loop = () => {
            // Only run if this is the currently active loop
            if (activeLoopIdRef.current !== loopId) return;

            // CHANGE DETECTION:
            // Check Viewport
            const currentScale = scaleRef.current;
            const currentPos = positionRef.current;

            // Check Data
            const currentItems = itemsRef.current;
            const currentSelected = selectedIdsRef.current;

            // Check Volatile State
            const ghostSig = getGhostSignature();
            const hiddenSig = getHiddenSignature();

            const last = lastRenderStateRef.current;

            const hasChanged =
                last.forceDraw ||
                currentScale !== last.scale ||
                currentPos.x !== last.x ||
                currentPos.y !== last.y ||
                currentItems.length !== last.itemCount ||
                currentSelected.length !== last.selectedCount ||
                ghostSig !== last.ghostSignature ||
                hiddenSig !== last.hiddenSignature;

            if (hasChanged) {
                // Update Cache
                lastRenderStateRef.current = {
                    scale: currentScale,
                    x: currentPos.x,
                    y: currentPos.y,
                    itemCount: currentItems.length,
                    selectedCount: currentSelected.length,
                    ghostSignature: ghostSig,
                    hiddenSignature: hiddenSig,
                    forceDraw: false
                };

                // Draw!
                draw();
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);

        return () => {
            if (activeLoopIdRef.current === loopId) {
                activeLoopIdRef.current = null;
            }
        };
    }, []); // Persistent loop

    useImperativeHandle(ref, () => ({
        updateTracker: (id: string, x: number, y: number, isActive: boolean = false) => {
            ghostPositionsRef.current[id] = { x, y, isActive } as any; // Cast to store extra prop
            requestAnimationFrame(draw);
        },
        clearTracker: (id: string) => {
            delete ghostPositionsRef.current[id];
            requestAnimationFrame(draw);
        },
        setHiddenItems: (ids: string[]) => {
            hiddenItemIdsRef.current = new Set(ids);
            requestAnimationFrame(draw);
        },
        getItemAt: (x: number, y: number) => {
            // Reverse iterate for hit testing (top items first)
            for (let i = items.length - 1; i >= 0; i--) {
                const item = getItemPos(items[i]);

                if (
                    x >= item.x &&
                    x <= item.x + item.width &&
                    y >= item.y &&
                    y <= item.y + item.height
                ) {
                    return item.id;
                }
            }
            return null;
        },
        forceRedraw: triggerForceDraw,
        setLODMode: (active: boolean) => {
            if (isLODActiveRef.current !== active) {
                isLODActiveRef.current = active;
                // Immediate draw/clear to prevent flickering during switch
                triggerForceDraw();
            }
        }
    }));

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', zIndex: 0 }}
        />
    );
});

export default CanvasItemLayer;
