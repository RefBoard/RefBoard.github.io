import React, { useEffect, useRef, useState, useContext } from 'react';
import CanvasRefContext from '../contexts/CanvasRefContext';

export interface SelectionBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SelectionBoundingBoxProps {
    bounds: SelectionBounds;
    onScaleStart: () => void;
    onScale: (scaleFactor: number, corner: string) => void;
    onScaleEnd: () => void;
}

export const SelectionBoundingBox: React.FC<SelectionBoundingBoxProps> = ({
    bounds,
    onScaleStart,
    onScale,
    onScaleEnd
}) => {
    const { visualTransformRef } = useContext(CanvasRefContext);
    const [isScaling, setIsScaling] = useState(false);
    const [activeCorner, setActiveCorner] = useState<string | null>(null);
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

    // CRITICAL FIX: Force re-render on zoom by tracking scale in state
    // React doesn't re-render when ref.current changes, so we need a RAF loop
    const [currentScale, setCurrentScale] = useState(1);
    const lastScaleRef = useRef(1);

    const scaleStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

    // Synchronize with visualTransformRef via RAF
    // OPTIMIZATION: Only update state if scale actually changed to avoid excessive re-renders
    useEffect(() => {
        let rafId: number;

        const updateScale = () => {
            const newScale = visualTransformRef.current.scale;
            // Only update if changed significantly (avoid floating point noise)
            if (Math.abs(newScale - lastScaleRef.current) > 0.0001) {
                lastScaleRef.current = newScale;
                setCurrentScale(newScale);
            }
            rafId = requestAnimationFrame(updateScale);
        };

        rafId = requestAnimationFrame(updateScale);

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [visualTransformRef]);

    const handleSize = 12 / currentScale; // Fixed size in screen pixels

    const corners = [
        { id: 'tl', x: bounds.x, y: bounds.y, cursor: 'nwse-resize' },
        { id: 'tr', x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize' },
        { id: 'bl', x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize' },
        { id: 'br', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize' }
    ];

    const handleScaleMouseDown = (e: React.MouseEvent, corner: string) => {
        e.stopPropagation();
        e.preventDefault();

        setIsScaling(true);
        setActiveCorner(corner);
        scaleStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: bounds.width,
            startHeight: bounds.height
        };

        onScaleStart();
    };

    useEffect(() => {
        if (!isScaling) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isScaling && scaleStartRef.current && activeCorner) {
                const dx = e.clientX - scaleStartRef.current.startX;

                // Fixed pixel-based scaling: 500px drag = 2x scale (linear, no acceleration)
                let scaleFactor = 1 + (dx / 13000);

                // Invert for left corners
                if (activeCorner === 'bl' || activeCorner === 'tl') {
                    scaleFactor = 1 - (dx / 13000);
                }

                scaleFactor = Math.max(0.1, scaleFactor);
                onScale(scaleFactor, activeCorner);
            }
        };

        const handleMouseUp = () => {
            if (isScaling) {
                setIsScaling(false);
                setActiveCorner(null);
                scaleStartRef.current = null;
                onScaleEnd();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isScaling, activeCorner, bounds, onScale, onScaleEnd]);

    return (
        <>
            {/* Bounding box border */}
            <div
                style={{
                    position: 'absolute',
                    left: `${bounds.x}px`,
                    top: `${bounds.y}px`,
                    width: `${bounds.width}px`,
                    height: `${bounds.height}px`,
                    border: `${2 / currentScale}px dashed #3b82f6`,
                    pointerEvents: 'none',
                    zIndex: 9999
                }}
            />

            {/* Corner resize handles */}
            {corners.map(corner => (
                <div
                    key={corner.id}
                    onMouseDown={(e) => handleScaleMouseDown(e, corner.id)}
                    onMouseEnter={() => setHoveredHandle(corner.id)}
                    onMouseLeave={() => setHoveredHandle(null)}
                    style={{
                        position: 'absolute',
                        left: `${corner.x - handleSize / 2}px`,
                        top: `${corner.y - handleSize / 2}px`,
                        width: `${handleSize}px`,
                        height: `${handleSize}px`,
                        backgroundColor: hoveredHandle === corner.id || activeCorner === corner.id ? '#3b82f6' : '#ffffff',
                        border: `${2 / currentScale}px solid #3b82f6`,
                        cursor: corner.cursor,
                        zIndex: 10000
                    }}
                />
            ))}
        </>
    );
};
