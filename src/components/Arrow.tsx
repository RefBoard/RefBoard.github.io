import React, { useMemo } from 'react';

export interface ArrowData {
    id: string;
    sourceId: string;
    targetId: string;
    color: string;
    strokeWidth: number;
}

interface ArrowProps {
    arrow: ArrowData;
    getItemPosition: (id: string) => { x: number; y: number; width: number; height: number } | null;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    onDelete?: (id: string) => void;
    items?: any[]; // Add items to trigger re-render when items change
    scale?: number; // Zoom scale for dynamic stroke width
}

const ArrowComponent: React.FC<ArrowProps> = ({ arrow, getItemPosition, isSelected = false, onSelect, items, scale = 1 }) => {
    // Use useMemo to recalculate positions when items change
    const sourcePos = useMemo(() => getItemPosition(arrow.sourceId), [getItemPosition, arrow.sourceId, items]);
    const targetPos = useMemo(() => getItemPosition(arrow.targetId), [getItemPosition, arrow.targetId, items]);

    if (!sourcePos || !targetPos) return null;

    // Start: Right middle of source
    const startX = sourcePos.x + sourcePos.width;
    const startY = sourcePos.y + sourcePos.height / 2;

    // End: Left middle of target
    const endX = targetPos.x;
    const endY = targetPos.y + targetPos.height / 2;

    // Calculate control points for Bezier curve
    const deltaX = Math.abs(endX - startX);
    const controlPointOffset = Math.max(deltaX * 0.5, 50);

    const cp1X = startX + controlPointOffset;
    const cp1Y = startY;
    const cp2X = endX - controlPointOffset;
    const cp2Y = endY;

    const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    // Create a wider invisible path for easier clicking
    const clickablePathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    // Dynamic stroke width based on zoom level
    // When zoomed out (scale < 1), make stroke thicker to stay visible
    // When zoomed in (scale > 1), make stroke relatively thinner
    const dynamicStrokeWidth = Math.max(arrow.strokeWidth / scale, 1.5);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect(arrow.id);
        }
    };

    return (
        <g>
            <defs>
                <marker
                    id={`arrowhead-${arrow.id}`}
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3.5, 0 7" fill={arrow.color} />
                </marker>
            </defs>
            {/* Invisible wider path for easier clicking */}
            <path
                d={clickablePathData}
                stroke="transparent"
                strokeWidth={Math.max(dynamicStrokeWidth * 3, 10)}
                fill="none"
                onClick={handleClick}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
            />
            {/* Visible arrow path */}
            <path
                d={pathData}
                stroke={isSelected ? '#60a5fa' : arrow.color}
                strokeWidth={isSelected ? dynamicStrokeWidth + 1 : dynamicStrokeWidth}
                fill="none"
                markerEnd={`url(#arrowhead-${arrow.id})`}
                onClick={handleClick}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
            />
        </g>
    );
};

// Memoize to prevent re-renders when arrow props haven't changed
export const Arrow = React.memo(ArrowComponent);


