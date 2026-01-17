import React, { useState, useRef, useEffect } from 'react';

export interface Bookmark {
    id: string;
    name: string;
    targetId: string | null; // If null, use x/y (fixed position)
    x: number;
    y: number;
    scale: number;
}

interface BookmarkPanelProps {
    bookmarks: Bookmark[];
    onNavigate: (bookmark: Bookmark) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onCopyUrl?: (bookmark: Bookmark) => void;
}

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ bookmarks, onNavigate, onRename, onDelete, onCopyUrl }) => {
    const PANEL_WIDTH = 250;
    const PANEL_HEIGHT = 300; // Max height
    const BUTTON_SIZE = 44;

    // Default position: Right side, above Minimap (assuming Minimap is at bottom-right)
    const [position, setPosition] = useState({ x: window.innerWidth - 270, y: 250 });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const hasDraggedRef = useRef(false);
    const mouseDownPosRef = useRef({ x: 0, y: 0 });
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    // Track window resize
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            setWindowSize({ width: newWidth, height: newHeight });

            // Always update position on resize, even when collapsed
            // This ensures the panel stays in the correct position when window is resized
            if (isCollapsed) {
                // When collapsed, update position for the button
                setPosition(prev => ({
                    x: newWidth - BUTTON_SIZE - 20,
                    y: Math.max(20, Math.min(newHeight - BUTTON_SIZE - 20, prev.y))
                }));
            } else {
                // When expanded, update position for the full panel
                setPosition(prev => ({
                    x: newWidth - PANEL_WIDTH - 20,
                    y: Math.max(20, Math.min(newHeight - PANEL_HEIGHT - 20, prev.y))
                }));
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isCollapsed]);

    // Handle Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 && (e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            hasDraggedRef.current = false;
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
            const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
            if (deltaX > 5 || deltaY > 5) hasDraggedRef.current = true;

            // Calculate naive position
            const naiveY = e.clientY - dragStart.y;

            if (isCollapsed) {
                // When collapsed, keep button on right edge, only allow Y movement
                const newX = windowSize.width - BUTTON_SIZE - 20;
                const newY = Math.max(20, Math.min(windowSize.height - BUTTON_SIZE - 20, naiveY));
                setPosition({ x: newX, y: newY });
            } else {
                // When expanded, force strict right alignment for full panel
                const newX = windowSize.width - PANEL_WIDTH - 20;
                const newY = Math.max(20, Math.min(windowSize.height - PANEL_HEIGHT - 20, naiveY));
                setPosition({ x: newX, y: newY });
            }
        };
        const handleMouseUp = () => {
            setTimeout(() => { setIsDragging(false); hasDraggedRef.current = false; }, 0);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart, isCollapsed, windowSize]);

    // Editing Logic
    const startEditing = (bookmark: Bookmark, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(bookmark.id);
        setEditName(bookmark.name);
    };

    const saveEditing = () => {
        if (editingId && editName.trim()) {
            onRename(editingId, editName.trim());
        }
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEditing();
        if (e.key === 'Escape') setEditingId(null);
    };

    // Calculate if panel is visible (auto-collapse when dragged off screen)
    const isPanelVisible = position.x >= 0 &&
        position.y >= 0 &&
        position.x + PANEL_WIDTH <= windowSize.width &&
        position.y + PANEL_HEIGHT <= windowSize.height;

    // Show expand button if explicitly collapsed OR panel is out of view
    const showExpandButton = isCollapsed || !isPanelVisible;

    // Collapse/Expand Button Position
    const buttonPosition = {
        x: Math.min(windowSize.width - BUTTON_SIZE - 12, position.x + PANEL_WIDTH - BUTTON_SIZE),
        y: Math.min(windowSize.height - BUTTON_SIZE - 12, position.y)
    };

    // When collapsed or out of view, show icon button
    if (showExpandButton) {
        return (
            <button
                onMouseDown={handleMouseDown}
                onClick={(e) => {
                    // Only expand if not dragged
                    if (!hasDraggedRef.current) {
                        setIsCollapsed(false);
                        // Ensure panel stays within window bounds when expanding
                        setPosition(prev => {
                            let newX = prev.x;
                            let newY = prev.y;
                            if (newX + PANEL_WIDTH > windowSize.width) newX = Math.max(12, windowSize.width - PANEL_WIDTH - 12);
                            if (newX < 0) newX = 12;
                            if (newY + PANEL_HEIGHT > windowSize.height) newY = Math.max(12, windowSize.height - PANEL_HEIGHT - 12);
                            if (newY < 0) newY = 12;
                            return { x: newX, y: newY };
                        });
                    }
                }}
                className="drag-handle fixed z-[50] flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-xl shadow-2xl hover:shadow-lg hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-300 -rotate-90 hover:rotate-0 active:scale-95 group cursor-grab active:cursor-grabbing"
                style={{
                    left: buttonPosition.x,
                    top: buttonPosition.y,
                    width: BUTTON_SIZE,
                    height: BUTTON_SIZE,
                }}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>

                {/* Tooltip - Starts on Left, rotates to Bottom */}
                <span className="absolute right-full mr-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Bookmarks
                </span>
            </button>
        );
    }

    return (
        <div
            className="fixed z-[50] transition-opacity duration-300 flex flex-col"
            style={{
                left: position.x,
                top: position.y,
                width: PANEL_WIDTH,
                maxHeight: PANEL_HEIGHT,
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-2 border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full">
                {/* Header / Drag Handle */}
                <div className="drag-handle px-3 py-2 bg-white/10 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing">
                    <div className="flex items-center gap-2 text-white font-medium text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Coordinates</span>
                    </div>
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setIsCollapsed(true)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {bookmarks.length === 0 && (
                        <div className="text-gray-500 text-xs text-center py-4">
                            Right-click canvas or items<br />to save coordinates
                        </div>
                    )}

                    {bookmarks.map((bookmark) => (
                        <div
                            key={bookmark.id}
                            className="group flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group"
                            onClick={() => onNavigate(bookmark)}
                        >
                            <div className="shrink-0 text-blue-400">
                                {bookmark.targetId ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                )}
                            </div>

                            {editingId === bookmark.id ? (
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={saveEditing}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    className="flex-1 bg-black/50 border border-blue-500 rounded px-1 text-sm text-white focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="flex-1 text-sm text-gray-200 truncate select-none">
                                    {bookmark.name}
                                </span>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => startEditing(bookmark, e)}
                                    className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400"
                                    title="Rename"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyUrl && onCopyUrl(bookmark);
                                    }}
                                    className="p-1 hover:bg-green-500/20 rounded text-gray-400 hover:text-green-400"
                                    title="Copy Link"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(bookmark.id);
                                    }}
                                    className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                                    title="Delete"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
