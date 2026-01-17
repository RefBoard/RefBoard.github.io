import React, { useState, useRef, useEffect } from 'react';

interface MinimapItem {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'image' | 'video' | 'text' | 'group';
}

interface MinimapProps {
    items: MinimapItem[];
    viewport: {
        x: number;
        y: number;
        scale: number;
        width: number;
        height: number;
    };
    onNavigate: (x: number, y: number) => void;
    visualRef?: React.MutableRefObject<{ x: number, y: number, scale: number }>; // New prop for real-time sync
}

export const Minimap: React.FC<MinimapProps> = ({ items, viewport, onNavigate, visualRef }) => {
    const PANEL_WIDTH = 250;
    const MINIMAP_SIZE = 250;
    const HEADER_HEIGHT = 40; // Approximate height of the header
    const BUTTON_SIZE = 44;

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [minimapPosition, setMinimapPosition] = useState({ x: window.innerWidth - 270, y: window.innerHeight - 320 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);
    const mouseDownPosRef = useRef({ x: 0, y: 0 });
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Ref for the viewport indicator to update it directly
    const indicatorRef = useRef<HTMLDivElement>(null);

    // Calculate world bounds (SQUARE)
    const worldBounds = React.useMemo(() => {
        if (!items || items.length === 0) {
            return { minX: -500, minY: -500, maxX: 500, maxY: 500, width: 1000, height: 1000 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        items.forEach(item => {
            if (typeof item.x === 'number' && typeof item.y === 'number' &&
                typeof item.width === 'number' && typeof item.height === 'number') {
                minX = Math.min(minX, item.x);
                minY = Math.min(minY, item.y);
                maxX = Math.max(maxX, item.x + item.width);
                maxY = Math.max(maxY, item.y + item.height);
            }
        });

        if (minX === Infinity) {
            return { minX: -500, minY: -500, maxX: 500, maxY: 500, width: 1000, height: 1000 };
        }

        const padding = 200;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Force SQUARE
        const width = maxX - minX;
        const height = maxY - minY;
        const maxDimension = Math.max(width, height);

        if (width < maxDimension) {
            const diff = (maxDimension - width) / 2;
            minX -= diff;
            maxX += diff;
        }
        if (height < maxDimension) {
            const diff = (maxDimension - height) / 2;
            minY -= diff;
            maxY += diff;
        }

        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }, [items]);

    const scaleFactor = MINIMAP_SIZE / worldBounds.width;

    // Helper functions for coordinate conversion
    const worldToMinimap = (worldX: number, worldY: number) => ({
        x: (worldX - worldBounds.minX) * scaleFactor,
        y: (worldY - worldBounds.minY) * scaleFactor
    });

    const minimapToWorld = (minimapX: number, minimapY: number) => ({
        x: (minimapX / scaleFactor) + worldBounds.minX,
        y: (minimapY / scaleFactor) + worldBounds.minY
    });

    // Real-time Viewport Sync Effect
    useEffect(() => {
        if (!visualRef || !indicatorRef.current) return;

        let rafId: number;

        const updateIndicator = () => {
            const currentVis = visualRef.current;
            if (!currentVis || !indicatorRef.current) return;

            // Calculate current world viewport based on visual transform
            // Note: Canvas transform is T(x,y) S(s). content = T * S * world.
            // Viewport is -x/s, -y/s, w/s, h/s
            const vpX = -currentVis.x / currentVis.scale;
            const vpY = -currentVis.y / currentVis.scale;
            const vpW = viewport.width / currentVis.scale; // Assuming viewport.width/height (window size) doesn't change fast
            const vpH = viewport.height / currentVis.scale;

            const pos = worldToMinimap(vpX, vpY);
            const w = vpW * scaleFactor;
            const h = vpH * scaleFactor;

            // Apply straight to DOM
            indicatorRef.current.style.left = `${pos.x}px`;
            indicatorRef.current.style.top = `${pos.y}px`;
            indicatorRef.current.style.width = `${w}px`;
            indicatorRef.current.style.height = `${h}px`;

            rafId = requestAnimationFrame(updateIndicator);
        };

        rafId = requestAnimationFrame(updateIndicator);
        return () => cancelAnimationFrame(rafId);
    }, [visualRef, worldBounds, scaleFactor, viewport.width, viewport.height]); // Re-bind if bounds change

    // Track window resize to detect when minimap goes out of view and adjust position
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            setWindowSize({ width: newWidth, height: newHeight });

            // Always update position on resize, even when collapsed
            // This ensures the panel stays in the correct position when window is resized
            if (isCollapsed) {
                // When collapsed, update position for the button
                setMinimapPosition(prev => ({
                    x: newWidth - BUTTON_SIZE - 20,
                    y: Math.max(20, Math.min(newHeight - BUTTON_SIZE - 20, prev.y))
                }));
            } else {
                // When expanded, update position for the full panel
                setMinimapPosition(prev => ({
                    x: newWidth - PANEL_WIDTH - 20,
                    y: Math.max(20, Math.min(newHeight - MINIMAP_SIZE - HEADER_HEIGHT - 20, prev.y))
                }));
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isCollapsed, PANEL_WIDTH]); // PANEL_WIDTH is constant but good practice

    // Calculate if minimap is visible
    const isMinimapVisible = minimapPosition.x >= 0 &&
        minimapPosition.y >= 0 &&
        minimapPosition.x + MINIMAP_SIZE <= windowSize.width &&
        minimapPosition.y + MINIMAP_SIZE + HEADER_HEIGHT <= windowSize.height;

    // Calculate button position (bottom-right corner, or where minimap should be)
    const buttonPosition = {
        x: Math.min(windowSize.width - BUTTON_SIZE - 12, minimapPosition.x + PANEL_WIDTH - BUTTON_SIZE),
        y: Math.min(windowSize.height - BUTTON_SIZE - 12, minimapPosition.y)
    };

    // Show expand button if collapsed OR if minimap is not visible
    const showExpandButton = isCollapsed || !isMinimapVisible;

    // Initial static calculation for fallback
    const viewportWorldX = -viewport.x / viewport.scale;
    const viewportWorldY = -viewport.y / viewport.scale;
    const viewportWorldW = viewport.width / viewport.scale;
    const viewportWorldH = viewport.height / viewport.scale;

    const viewportMinimapPos = worldToMinimap(viewportWorldX, viewportWorldY);
    const viewportMinimapSize = {
        width: viewportWorldW * scaleFactor,
        height: viewportWorldH * scaleFactor
    };

    const handleMinimapMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) { // Left click only
            setIsDragging(true);
            hasDraggedRef.current = false;
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
            setDragStart({ x: e.clientX - minimapPosition.x, y: e.clientY - minimapPosition.y });
        }
    };

    const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Don't navigate if we just finished dragging
        if (hasDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const minimapX = e.clientX - rect.left;
        const minimapY = e.clientY - rect.top;
        const worldCoords = minimapToWorld(minimapX, minimapY);
        onNavigate(worldCoords.x, worldCoords.y);
    };

    React.useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Check if mouse has moved significantly (more than 5px)
            const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
            const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
            if (deltaX > 5 || deltaY > 5) {
                hasDraggedRef.current = true;
            }

            // Calculate naive position
            const naiveY = e.clientY - dragStart.y;

            if (isCollapsed) {
                // When collapsed, keep button on right edge, only allow Y movement
                const newX = windowSize.width - BUTTON_SIZE - 20;
                const newY = Math.max(20, Math.min(windowSize.height - BUTTON_SIZE - 20, naiveY));
                setMinimapPosition({ x: newX, y: newY });
            } else {
                // When expanded, force strict right alignment for full panel
                const newX = windowSize.width - PANEL_WIDTH - 20;
                const newY = Math.max(20, Math.min(windowSize.height - MINIMAP_SIZE - HEADER_HEIGHT - 20, naiveY));
                setMinimapPosition({ x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            // Reset after a short delay to allow click event to check hasDraggedRef
            setTimeout(() => {
                setIsDragging(false);
                hasDraggedRef.current = false;
            }, 0);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, isCollapsed, windowSize]);

    return (
        <>
            {/* Expand Button */}
            {showExpandButton && (
                <button
                    onMouseDown={handleMinimapMouseDown}
                    onClick={() => {
                        // Only expand if not dragged
                        if (!hasDraggedRef.current) {
                            setIsCollapsed(false);
                            // Ensure minimap stays within window bounds logic if needed, 
                            // but usually position state is preserved or re-calculated if out of bounds on resize.
                            // We'll rely on current position unless out of bounds.
                            setMinimapPosition(prev => {
                                let newX = prev.x;
                                let newY = prev.y;
                                if (newX + PANEL_WIDTH > windowSize.width) newX = Math.max(12, windowSize.width - PANEL_WIDTH - 12);
                                if (newX < 0) newX = 12;
                                if (newY + MINIMAP_SIZE + HEADER_HEIGHT > windowSize.height) newY = Math.max(12, windowSize.height - MINIMAP_SIZE - HEADER_HEIGHT - 12);
                                if (newY < 0) newY = 12;
                                return { x: newX, y: newY };
                            });
                        }
                    }}
                    className="drag-handle fixed z-[10005] flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-xl shadow-2xl hover:shadow-lg hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-300 -rotate-90 hover:rotate-0 active:scale-95 group cursor-grab active:cursor-grabbing"
                    style={{
                        left: buttonPosition.x,
                        top: buttonPosition.y,
                        width: BUTTON_SIZE,
                        height: BUTTON_SIZE,
                    }}
                >
                    <svg
                        className="w-6 h-6 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                    </svg>

                    {/* Tooltip - Starts on Left, rotates to Bottom */}
                    <span className="absolute right-full mr-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Navigation
                    </span>
                </button>
            )}

            {/* Minimap Panel */}
            {!isCollapsed && isMinimapVisible && (
                <div
                    className="fixed z-[10005] transition-opacity duration-300 flex flex-col"
                    style={{
                        left: minimapPosition.x,
                        top: minimapPosition.y,
                        width: PANEL_WIDTH,
                        // Height isn't fixed here but bounded by layout
                    }}
                >
                    <div className="bg-gradient-to-br from-gray-900/70 to-gray-800/70 backdrop-blur-xl border-2 border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col">

                        {/* Header / Drag Handle */}
                        <div
                            className="drag-handle px-3 py-2 bg-white/10 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
                            onMouseDown={handleMinimapMouseDown}
                        >
                            <div className="flex items-center gap-2 text-white font-medium text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <span>Navigation</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCollapsed(true);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                        </div>

                        {/* Map Area */}
                        <div
                            className="relative"
                            style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
                            onClick={handleMinimapClick}
                        >
                            {items.filter(item =>
                                typeof item.x === 'number' && typeof item.y === 'number' &&
                                typeof item.width === 'number' && typeof item.height === 'number'
                            ).map((item, index) => {
                                const pos = worldToMinimap(item.x, item.y);
                                const size = {
                                    width: Math.max(2, item.width * scaleFactor),
                                    height: Math.max(2, item.height * scaleFactor)
                                };

                                return (
                                    <div
                                        key={item.id || `item-${index}`}
                                        className={`absolute rounded-sm ${item.type === 'text' ? 'bg-blue-400' :
                                            item.type === 'group' ? 'border-2 border-green-400/60 bg-green-400/10' :
                                                'bg-gray-400'
                                            }`}
                                        style={{
                                            left: pos.x,
                                            top: pos.y,
                                            width: size.width,
                                            height: size.height,
                                            opacity: item.type === 'group' ? 0.6 : 0.5,
                                            zIndex: item.type === 'group' ? 0 : 1
                                        }}
                                    />
                                );
                            })}

                            {/* Viewport Indicator */}
                            <div
                                ref={indicatorRef}
                                className="absolute border-2 border-dashed border-yellow-400 pointer-events-none"
                                style={{
                                    left: viewportMinimapPos.x,
                                    top: viewportMinimapPos.y,
                                    width: viewportMinimapSize.width,
                                    height: viewportMinimapSize.height,
                                    boxShadow: '0 0 10px rgba(250, 204, 21, 0.5)'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
