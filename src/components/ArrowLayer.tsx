
import React, { useRef, useImperativeHandle, forwardRef } from 'react';

// Reuse types from Arrow.tsx to avoid duplication if possible, 
// or redefine if we want to decouple. Let's redefine for now to be self-contained or import.
// Importing is better for consistency.
import { ArrowData } from './Arrow';

export interface ArrowLayerRef {
    updateTracker: (id: string, x: number, y: number) => void;
}

interface ArrowLayerProps {
    arrows: ArrowData[];
    items: any[]; // Need items to calculate initial positions
    onArrowSelect: (id: string) => void;
    selectedArrowIds: string[];
}

const ArrowLayer = forwardRef<ArrowLayerRef, ArrowLayerProps>(({
    arrows,
    items,
    onArrowSelect,
    selectedArrowIds
}, ref) => {
    // Track ghost positions for dragged items
    const ghostPositionsRef = useRef<Record<string, { x: number, y: number }>>({});

    // Helper to get item data (ghost or real)
    const getItemBox = (id: string) => {
        if (ghostPositionsRef.current[id]) {
            const item = items.find(i => i.id === id);
            if (!item) return { x: ghostPositionsRef.current[id].x, y: ghostPositionsRef.current[id].y, width: 100, height: 100 }; // Fallback
            return { ...item, x: ghostPositionsRef.current[id].x, y: ghostPositionsRef.current[id].y };
        }
        return items.find(i => i.id === id);
    };

    // Calculate Bezier path (same logic as Arrow.tsx)
    const calculatePath = (source: any, target: any) => {
        if (!source || !target) return '';

        // Start: Right middle of source
        const startX = source.x + source.width;
        const startY = source.y + source.height / 2;

        // End: Left middle of target
        const endX = target.x;
        const endY = target.y + target.height / 2;

        const deltaX = Math.abs(endX - startX);
        const controlPointOffset = Math.max(deltaX * 0.5, 50);

        const cp1X = startX + controlPointOffset;
        const cp1Y = startY;
        const cp2X = endX - controlPointOffset;
        const cp2Y = endY;

        return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    };

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
        updateTracker: (id: string, x: number, y: number) => {
            ghostPositionsRef.current[id] = { x, y };

            // Find relevant arrows
            const relevantArrows = arrows.filter(a => a.sourceId === id || a.targetId === id);

            // Update DOM directly
            relevantArrows.forEach(arrow => {
                const source = getItemBox(arrow.sourceId);
                const target = getItemBox(arrow.targetId);
                const newPath = calculatePath(source, target);

                if (newPath) {
                    const visiblePath = document.getElementById(`arrow-visible-${arrow.id}`);
                    const clickablePath = document.getElementById(`arrow-clickable-${arrow.id}`);


                    if (visiblePath) visiblePath.setAttribute('d', newPath);
                    if (clickablePath) clickablePath.setAttribute('d', newPath);
                }
            });
        }
    }));

    return (
        <svg className="absolute inset-0 pointer-events-auto" style={{ width: '100%', height: '100%', zIndex: 10, overflow: 'visible' }}>
            <defs>
                {arrows.map(arrow => (
                    <marker
                        key={`marker-${arrow.id}`}
                        id={`arrowhead-${arrow.id}`}
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon points="0 0, 10 3.5, 0 7" fill={arrow.color} />
                    </marker>
                ))}
            </defs>
            {arrows.map(arrow => {
                const source = getItemBox(arrow.sourceId);
                const target = getItemBox(arrow.targetId);
                const pathData = calculatePath(source, target);
                const isSelected = selectedArrowIds.includes(arrow.id);
                // Assume scale 1 for now or pass context? 
                // Arrow.tsx used scale for stroke width. We can use CSS variable if passed to container?
                // Or just use a reasonable default.
                const strokeWidth = arrow.strokeWidth || 2;

                if (!pathData) return null;

                return (
                    <g key={arrow.id}>
                        {/* Invisible wider path for easier clicking */}
                        <path
                            id={`arrow-clickable-${arrow.id}`}
                            d={pathData}
                            stroke="transparent"
                            strokeWidth="12"
                            fill="none"
                            onClick={(e) => {
                                e.stopPropagation();
                                onArrowSelect(arrow.id);
                            }}
                            style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                        />
                        {/* Visible arrow path */}
                        <path
                            id={`arrow-visible-${arrow.id}`}
                            d={pathData}
                            stroke={isSelected ? '#60a5fa' : arrow.color}
                            strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                            fill="none"
                            markerEnd={`url(#arrowhead-${arrow.id})`}
                            style={{ pointerEvents: 'none' }}
                        />
                    </g>
                );
            })}
        </svg>
    );
});

export default React.memo(ArrowLayer, (prev, next) => {
    // Optimization: Custom comparison slightly expensive but better than always re-rendering on item Drag/Move if handled imperatively.
    // However, if items update position via state (onDragStop), we DO want to re-render.
    // But during drag, items array DOES NOT change.
    // So default memo is fine IF items array reference is stable.
    // But items array changes strictly on drag stop.
    return prev.arrows === next.arrows &&
        prev.items === next.items &&
        prev.selectedArrowIds === next.selectedArrowIds;
});
