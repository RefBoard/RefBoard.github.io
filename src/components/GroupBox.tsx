import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';
import { useCanvasTransform } from '../contexts/CanvasContext';

export interface GroupData {
    id: string;
    name: string;
    childIds: string[];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    backgroundColor?: string; // Background color for the group content area
}

interface GroupBoxProps {
    group: GroupData;
    isSelected: boolean;
    onUpdate: (id: string, data: Partial<GroupData>) => void;
    onDrag?: (id: string, data: { x: number; y: number }) => void;
    onDragStart?: (id: string) => void;
    onSelect: (id: string) => void;
    onNameChange: (id: string, name: string) => void;
    onFormatMenuOpen?: (groupId: string) => void;
    onUngroup?: (id: string) => void;
    activeTool?: 'select' | 'text' | 'arrow' | 'pen' | 'eraser';
    onSaveCoordinate?: (id: string, x?: number, y?: number) => void;
}

const GroupBoxComponent: React.FC<GroupBoxProps> = ({
    group,
    isSelected,
    onUpdate,
    onDrag,
    onDragStart,
    onSelect,
    onNameChange,
    onFormatMenuOpen,
    onUngroup,
    activeTool = 'select',
    onSaveCoordinate
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(group.name);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
    const nameRef = React.useRef<HTMLDivElement>(null);
    const headerRef = React.useRef<HTMLDivElement>(null);
    const { scale } = useCanvasTransform();

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditingName(true);

        // Notify parent to show format menu
        if (onFormatMenuOpen) {
            onFormatMenuOpen(group.id);
        }
    };

    const handleGroupClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(group.id);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (activeTool === 'pen' || activeTool === 'eraser') return;
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0 });
    };

    const [isDragging, setIsDragging] = useState(false);

    return (
        <>
            <Rnd
                size={{ width: group.width, height: group.height }}
                position={isDragging ? undefined : { x: group.x, y: group.y }}
                scale={scale}
                enableResizing={isSelected && activeTool !== 'pen' && activeTool !== 'eraser'}
                onDragStart={(e) => {
                    // Only allow left-click dragging
                    // Prevent dragging with right-click (2) or middle-click (1) to allow panning
                    if ((e as any).button !== 0) {
                        return false;
                    }

                    // Prevent dragging in pen/eraser mode
                    if (activeTool === 'pen' || activeTool === 'eraser') {
                        return false;
                    }
                    setIsDragging(true);
                    if (onDragStart) {
                        onDragStart(group.id);
                    }
                }}
                onDrag={(_e, d) => {
                    // Prevent dragging in pen/eraser mode
                    if (activeTool === 'pen' || activeTool === 'eraser') {
                        return false;
                    }
                    // Immediately update position prop to keep react-rnd in sync
                    // This ensures the visual position matches the data position
                    if (onDrag) {
                        onDrag(group.id, { x: d.x, y: d.y });
                    }
                }}
                onDragStop={(_e, d) => {
                    setIsDragging(false);
                    // Prevent dragging in pen/eraser mode
                    if (activeTool === 'pen' || activeTool === 'eraser') {
                        return false;
                    }
                    onUpdate(group.id, { x: d.x, y: d.y });
                }}
                onResizeStop={(_e, _direction, ref, _delta, position) => {
                    onUpdate(group.id, {
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        ...position,
                    });
                }}
                onMouseDown={(e) => {
                    // Allow panning/zooming to work even on groups
                    // Check if Middle (pan), Right-click (pan), Alt+Right (zoom) is pressed
                    const isPanGesture = e.button === 1 || e.button === 2; // Middle mouse button OR right-click
                    const isZoomGesture = e.button === 2 && e.altKey; // Right + Alt

                    if (isPanGesture || isZoomGesture) {
                        // Let canvas handle panning/zooming
                        return;
                    }

                    // Don't interact with groups in pen/eraser mode
                    if (activeTool === 'pen' || activeTool === 'eraser') {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                    }

                    // Only select if clicking on the content area (not header)
                    if (!headerRef.current?.contains(e.target as Node)) {
                        e.stopPropagation();
                        onSelect(group.id);
                    }
                }}
                onContextMenu={handleContextMenu}
                className={`absolute ${isSelected ? 'ring-4 ring-yellow-400/50' : 'ring-2 ring-gray-500/30'} ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : ''}`}
                style={{ zIndex: 0 }}
                data-item-id={group.id}
            >
                {/* Header area - Group name */}
                <div
                    ref={headerRef}
                    className="absolute left-0 w-full bg-gray-800 pointer-events-none flex items-center px-2"
                    style={{
                        height: `${Math.max(32, (group.fontSize || 12) + 20)}px`,
                        top: `-${Math.max(32, (group.fontSize || 12) + 20)}px`,
                        // LOD: Always visible (Canvas doesn't render groups)
                        opacity: 1,
                        // Use explicit border properties to avoid artifacts
                        borderTopWidth: '2px',
                        borderRightWidth: '2px',
                        borderLeftWidth: '2px',
                        borderBottomWidth: '0',
                        borderStyle: 'solid',
                        borderColor: 'rgb(75, 85, 99)', // gray-600
                        borderTopLeftRadius: '0.5rem',
                        borderTopRightRadius: '0.5rem',
                        zIndex: 1000
                    }}
                >
                    <div
                        ref={nameRef}
                        className={`flex-1 text-white text-xs font-medium cursor-pointer ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleGroupClick(e);
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                        }}
                        onDoubleClick={handleDoubleClick}
                        style={{
                            fontSize: `${group.fontSize || 12}px`,
                            color: group.color || '#ffffff',
                            fontFamily: group.fontFamily || 'Inter, sans-serif'
                        }}
                    >
                        {isEditingName ? (
                            <input
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    onNameChange(group.id, tempName);
                                }}
                                onKeyDown={(e) => {
                                    // Prevent event propagation to avoid triggering delete/backspace handlers
                                    e.stopPropagation();

                                    if (e.key === 'Enter') {
                                        setIsEditingName(false);
                                        onNameChange(group.id, tempName);
                                    } else if (e.key === 'Escape') {
                                        setIsEditingName(false);
                                        setTempName(group.name); // Reset to original name
                                    }
                                }}
                                onClick={(e) => {
                                    // Prevent click from selecting the group
                                    e.stopPropagation();
                                }}
                                autoFocus
                                className="bg-gray-700 px-1 outline-none w-full"
                                style={{
                                    fontSize: `${group.fontSize || 12}px`,
                                    color: group.color || '#ffffff',
                                    fontFamily: group.fontFamily || 'Inter, sans-serif'
                                }}
                            />
                        ) : (
                            group.name
                        )}
                    </div>
                </div>

                {/* Content area - Background color */}
                <div
                    className="w-full h-full pointer-events-none"
                    style={{
                        // Use longhand properties to avoid React shorthand conflicts
                        borderTopWidth: '0',
                        // Scale-invariant border width: ensure at least 1px visible on screen, or thicker
                        borderRightWidth: `${Math.max(2, 1.5 / scale)}px`,
                        borderBottomWidth: `${Math.max(2, 1.5 / scale)}px`,
                        borderLeftWidth: `${Math.max(2, 1.5 / scale)}px`,

                        borderRightStyle: scale < 0.3 ? 'solid' : 'dashed',
                        borderBottomStyle: scale < 0.3 ? 'solid' : 'dashed',
                        borderLeftStyle: scale < 0.3 ? 'solid' : 'dashed',
                        borderRightColor: 'rgba(107, 114, 128, 0.5)',
                        borderBottomColor: 'rgba(107, 114, 128, 0.5)',
                        borderLeftColor: 'rgba(107, 114, 128, 0.5)',
                        borderBottomLeftRadius: '0.5rem',
                        borderBottomRightRadius: '0.5rem',
                        backgroundColor: (() => {
                            const color = group.backgroundColor || '#000000';
                            // Convert hex to rgba with 0.3 opacity
                            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                            return result
                                ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, 0.3)`
                                : 'rgba(0, 0, 0, 0.3)';
                        })()
                    }}
                />

                {/* Toolbar - Background Color & Delete */}
                {isSelected && ( // Always visible when selected, regardless of zoom level
                    <div
                        className="absolute -top-52 left-1/2 flex items-center gap-2 bg-gray-800 rounded-full shadow-xl border border-gray-600 px-3 py-1.5 z-[10002]"
                        style={{
                            transform: `translateX(-50%) scale(${1 / scale})`,
                            transformOrigin: 'bottom center',
                            pointerEvents: activeTool === 'pen' || activeTool === 'eraser' ? 'none' : 'auto'
                        }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Background Color Picker */}
                        <div
                            className="relative group/color w-5 h-5 cursor-pointer hover:scale-110 transition-transform"
                            title="배경색 변경"
                        >
                            <div
                                className="w-full h-full rounded-full border border-gray-400 shadow-sm"
                                style={{ backgroundColor: group.backgroundColor || '#374151' }}
                            />
                            <input
                                type="color"
                                value={group.backgroundColor || '#000000'}
                                onChange={(e) => onUpdate(group.id, { backgroundColor: e.target.value })}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>

                        <div className="w-px h-4 bg-gray-600" />

                        {/* Ungroup Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onUngroup) onUngroup(group.id);
                            }}
                            className="text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center p-0.5"
                            title="그룹 해제"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                )}
            </Rnd>
            {
                contextMenu.visible && createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[9998]"
                            onClick={closeContextMenu}
                            onContextMenu={(e) => e.preventDefault()}
                        />
                        <div
                            className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-1 z-[9999] min-w-[160px]"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            <button
                                onClick={() => {
                                    if (onUngroup) onUngroup(group.id);
                                    closeContextMenu();
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-2 border-b border-gray-700"
                            >
                                <span>Ungroup</span>
                                <span className="text-xs text-gray-400">Ctrl+Shift+G</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (onSaveCoordinate) onSaveCoordinate(group.id);
                                    closeContextMenu();
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-2"
                            >
                                <span>📍 Save Coordinate</span>
                            </button>
                        </div>
                    </>,
                    document.body
                )
            }
        </>
    );
};

// Memoize with custom comparison to detect group property changes
export const GroupBox = React.memo(GroupBoxComponent, (prevProps, nextProps) => {
    // If group reference changed, always re-render
    if (prevProps.group !== nextProps.group) {
        // Check if any meaningful properties changed
        const prev = prevProps.group;
        const next = nextProps.group;

        // Check all relevant properties
        if (prev.id !== next.id ||
            prev.name !== next.name ||
            prev.x !== next.x ||
            prev.y !== next.y ||
            prev.width !== next.width ||
            prev.height !== next.height ||
            prev.color !== next.color ||
            prev.backgroundColor !== next.backgroundColor ||
            prev.fontSize !== next.fontSize ||
            prev.fontFamily !== next.fontFamily ||
            prev.childIds.length !== next.childIds.length) {
            return false; // Props changed, re-render
        }
    }

    // Check other props
    if (prevProps.isSelected !== nextProps.isSelected ||
        prevProps.activeTool !== nextProps.activeTool) {
        return false; // Props changed, re-render
    }

    return true; // Props same, skip re-render
});
