import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TextItemData {
    id: string;
    type: 'text';
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    letterSpacing?: number;
    zIndex: number;
    rotation?: number;
    flipHorizontal?: boolean;
    flipVertical?: boolean;
}

interface TextItemProps {
    item: TextItemData;
    isSelected: boolean;
    onUpdate: (id: string, data: Partial<TextItemData>) => void;
    onSelect: (id: string, isCtrlPressed?: boolean, isShiftPressed?: boolean) => void;
    onGroup?: () => void;
    canGroup?: boolean;
    isCtrlPressed: boolean;
    activeTool?: 'select' | 'text' | 'arrow' | 'pen' | 'eraser';
    isNewlyCreated?: boolean;
    onEditStart?: (id: string) => void;
    onFormatMenuOpen?: (textId: string) => void;
    onInteractionStart?: (id: string) => void;
    onInteractionEnd?: (id: string, x: number, y: number) => void;
    onSaveCoordinate?: (id: string, x?: number, y?: number) => void;
    scale: number;
}

export const TextItem: React.FC<TextItemProps> = React.memo(({
    item,
    isSelected,
    onUpdate,
    onSelect,
    onGroup,
    activeTool = 'select',
    canGroup,
    isCtrlPressed,
    isNewlyCreated = false,
    onEditStart,
    onFormatMenuOpen,
    onSaveCoordinate,
    onInteractionStart,
    onInteractionEnd,
    scale
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState(item.content);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
    const [isResizing, setIsResizing] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && textRef.current) {
            if (textRef.current.textContent !== item.content) {
                textRef.current.textContent = item.content;
            }

            setTimeout(() => {
                if (textRef.current) {
                    textRef.current.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    let targetNode: Node = textRef.current;
                    let offset = textRef.current.textContent?.length || 0;

                    if (textRef.current.childNodes.length > 0) {
                        const lastNode = textRef.current.childNodes[textRef.current.childNodes.length - 1];
                        if (lastNode.nodeType === Node.TEXT_NODE) {
                            targetNode = lastNode;
                            offset = lastNode.textContent?.length || 0;
                        }
                    }

                    range.setStart(targetNode, offset);
                    range.setEnd(targetNode, offset);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                }
            }, 0);
        }
    }, [isEditing]);

    useEffect(() => {
        if (isNewlyCreated && textRef.current) {
            setIsEditing(true);
            if (onEditStart) onEditStart(item.id);
        }
    }, [isNewlyCreated, item.id, onEditStart]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsEditing(true);
        setTempContent(item.content);
        if (onFormatMenuOpen) onFormatMenuOpen(item.id);
    };

    const handleBlur = () => {
        setIsEditing(false);
        const finalContent = tempContent.trim() === '' ? 'Text' : tempContent;
        onUpdate(item.id, { content: finalContent });
    };

    // Update tempContent when item.content change from outside
    useEffect(() => {
        if (!isEditing) {
            setTempContent(item.content);
        }
    }, [item.content, isEditing]);

    // Auto-size effect: Expand/Shrink bounding box to fit text content
    // Disabled during manual resize to prevent flicker
    useEffect(() => {
        if (textRef.current && !isResizing) {
            // Measure the content size
            // We temporarily set width/height to auto to get the natural size
            const originalWidth = textRef.current.style.width;
            const originalHeight = textRef.current.style.height;
            const originalWhiteSpace = textRef.current.style.whiteSpace;
            const originalDisplay = textRef.current.style.display;

            // Remove constraints to measure "natural" size
            textRef.current.style.width = 'auto';
            textRef.current.style.height = 'auto';
            textRef.current.style.display = 'inline-block';
            textRef.current.style.whiteSpace = 'pre';

            const newWidth = textRef.current.scrollWidth + 24; // Padding for visual comfort
            const newHeight = textRef.current.scrollHeight + 12;

            // Restore styles immediately
            textRef.current.style.width = originalWidth;
            textRef.current.style.height = originalHeight;
            textRef.current.style.display = originalDisplay;
            textRef.current.style.whiteSpace = originalWhiteSpace;

            // Sync with state only if there's a meaningful change
            if (Math.abs(newWidth - item.width) > 2 || Math.abs(newHeight - item.height) > 2) {
                onUpdate(item.id, { width: newWidth, height: newHeight });
            }
        }
    }, [item.content, item.fontFamily, tempContent, isResizing]); // Only auto-size on content/font family change, not fontSize

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) {
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
        }
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0 });
    };

    // UI Scaling Optimization:
    const uiScale = Math.min(5, Math.max(0.4, 1 / scale));

    return (
        <div
            className={`media-item-wrapper absolute type-text ${isSelected ? 'selected' : ''} ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : ''}`}
            data-item-id={item.id}
            style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                zIndex: Math.max(5000, item.zIndex + 1000), // Ensure text is always above images (min 5000)
                pointerEvents: 'auto',
                opacity: 1,
                overflow: 'visible',
                transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipHorizontal ? -1 : 1}) scaleY(${item.flipVertical ? -1 : 1}) translateZ(0)`, // translateZ creates new stacking context
                transformOrigin: 'center center',
                willChange: 'transform' // Force GPU layer
            }}
            onMouseDown={(e) => {
                const isPanGesture = e.button === 1;
                const isZoomGesture = e.button === 2 && e.altKey;
                if (isPanGesture || isZoomGesture) return;
                if (activeTool === 'pen' || activeTool === 'eraser') return;

                if (!isEditing) {
                    onInteractionStart?.(item.id);
                    onSelect(item.id, isCtrlPressed, e.shiftKey);
                }
            }}
        >
            <div
                ref={textRef}
                contentEditable={isEditing}
                suppressContentEditableWarning
                onDoubleClick={handleDoubleClick}
                onClick={(e) => { if (isEditing) e.stopPropagation(); }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e);
                }}
                onBlur={handleBlur}
                onInput={(e) => setTempContent(e.currentTarget.textContent || '')}
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a', 'x'].includes(e.key.toLowerCase())) return;
                    if (e.key === 'Delete' || e.key === 'Backspace') e.stopPropagation();
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        textRef.current?.blur();
                    }
                }}
                className={`w-full h-full p-2 outline-none ${isEditing ? 'bg-white/10 border-2 border-[#3b82f6]' : ''} ${isSelected && !isEditing ? 'border-2 border-[#3b82f6]' : ''}`}
                style={{
                    fontSize: `${item.fontSize}px`,
                    color: item.color,
                    WebkitTextFillColor: item.color, // Force color override for webkit
                    fontFamily: item.fontFamily,
                    letterSpacing: item.letterSpacing ? `${item.letterSpacing}px` : 'normal',
                    cursor: isEditing ? 'text' : 'move',
                    whiteSpace: 'pre',
                    overflow: 'visible',
                    userSelect: isEditing ? 'text' : 'none',
                    wordBreak: 'normal'
                } as React.CSSProperties}
            >
                {isEditing ? null : tempContent}
            </div>

            {isSelected && !isEditing && (
                <>
                    {/* Rotation Handle */}
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
                        <div style={{ width: 2 * uiScale, height: 20 * uiScale, background: '#3b82f6', opacity: 0.6 }} />
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
                                const startX = e.clientX;
                                const startRotation = item.rotation || 0;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = moveEvent.clientX - startX;
                                    const rawRotation = (startRotation - (deltaX * 0.5) + 360) % 360;
                                    const newRotation = moveEvent.shiftKey ? Math.round(rawRotation / 25) * 25 : rawRotation;
                                    onUpdate(item.id, { rotation: newRotation });
                                };

                                const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                    onInteractionEnd?.(item.id, item.x, item.y);
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                        >
                            <svg width={16 * uiScale} height={16 * uiScale} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                            </svg>
                        </div>
                    </div>

                    {/* Resize Handles */}
                    {(['tl', 'tr', 'bl', 'br'] as const).map(corner => {
                        const isTop = corner.startsWith('t');
                        const isLeft = corner.endsWith('l');
                        const rotations = { tl: 180, tr: 270, bl: 90, br: 0 };

                        return (
                            <div
                                key={corner}
                                className={`resize-handle handle-${corner}`}
                                style={{
                                    position: 'absolute',
                                    top: isTop ? -12 * uiScale : 'auto',
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
                                    opacity: 0,
                                    transition: 'opacity 0.2s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setIsResizing(true); // Disable auto-sizing
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
                                        const dx_scr = (moveEvent.clientX - startMouseX) / scale;
                                        const dy_scr = (moveEvent.clientY - startMouseY) / scale;
                                        const localDx = dx_scr * Math.cos(rad) + dy_scr * Math.sin(rad);
                                        const localDy = -dx_scr * Math.sin(rad) + dy_scr * Math.cos(rad);

                                        let dw = 0, dh = 0;
                                        if (corner === 'br') { dw = localDx; dh = localDy; }
                                        else if (corner === 'bl') { dw = -localDx; dh = localDy; }
                                        else if (corner === 'tr') { dw = localDx; dh = -localDy; }
                                        else if (corner === 'tl') { dw = -localDx; dh = -localDy; }

                                        let newWidth = Math.max(200, startWidth + dw);
                                        let newHeight = Math.max(50, startHeight + dh);

                                        // Scaling fontSize with width
                                        const scaleFactor = newWidth / startWidth;
                                        const newFontSize = Math.round(item.fontSize * scaleFactor);

                                        if (Math.abs(dw) > Math.abs(dh)) {
                                            newHeight = newWidth / aspectRatio;
                                            if (corner === 'tl' || corner === 'bl') dw = startWidth - newWidth; else dw = newWidth - startWidth;
                                            if (corner === 'tl' || corner === 'tr') dh = startHeight - newHeight; else dh = newHeight - startHeight;
                                        } else {
                                            newWidth = newHeight * aspectRatio;
                                            if (corner === 'tl' || corner === 'bl') dw = startWidth - newWidth; else dw = newWidth - startWidth;
                                            if (corner === 'tl' || corner === 'tr') dh = startHeight - newHeight; else dh = newHeight - startHeight;
                                        }

                                        let localTransX = 0, localTransY = 0;
                                        if (corner === 'br') { localTransX = dw / 2; localTransY = dh / 2; }
                                        else if (corner === 'bl') { localTransX = -dw / 2; localTransY = dh / 2; }
                                        else if (corner === 'tr') { localTransX = dw / 2; localTransY = -dh / 2; }
                                        else if (corner === 'tl') { localTransX = -dw / 2; localTransY = -dh / 2; }

                                        const worldTransX = localTransX * Math.cos(rad) - localTransY * Math.sin(rad);
                                        const worldTransY = localTransX * Math.sin(rad) + localTransY * Math.cos(rad);
                                        const newX = (startX + startWidth / 2 + worldTransX) - newWidth / 2;
                                        const newY = (startY + startHeight / 2 + worldTransY) - newHeight / 2;

                                        onUpdate(item.id, {
                                            width: newWidth,
                                            height: newHeight,
                                            x: newX,
                                            y: newY,
                                            fontSize: newFontSize
                                        });
                                    };

                                    const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                        setIsResizing(false); // Re-enable auto-sizing
                                        onInteractionEnd?.(item.id, item.x, item.y);
                                    };

                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                }}
                            >
                                <svg width={28 * uiScale} height={28 * uiScale} viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))', opacity: 0.9, transform: `rotate(${rotations[corner]}deg)` }}>
                                    <path d="M28 12 A 16 16 0 0 1 12 28" />
                                </svg>
                            </div>
                        );
                    })}
                </>
            )}

            {contextMenu.visible && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={closeContextMenu} onContextMenu={(e) => e.preventDefault()} />
                    <div className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-1 z-[9999] min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
                        {canGroup && (
                            <button onClick={() => { if (onGroup) onGroup(); closeContextMenu(); }} className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-2 border-b border-gray-700">
                                <span>Group</span>
                                <span className="text-xs text-gray-400">Ctrl+G</span>
                            </button>
                        )}
                        <button onClick={() => { if (onSaveCoordinate) onSaveCoordinate(item.id); closeContextMenu(); }} className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-2">
                            <span>📍 Save Coordinate</span>
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
});
