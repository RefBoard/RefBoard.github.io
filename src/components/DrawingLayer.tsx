import React, { useRef, useEffect, useContext, useState, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import CanvasRefContext from '../contexts/CanvasRefContext';

export interface DrawingPath {
    id: string;
    points: { x: number; y: number; pressure?: number }[];
    color: string;
    size: number;
    isEraser: boolean;
}

interface DrawingLayerProps {
    paths: DrawingPath[];
    currentPath: DrawingPath | null;
}

export interface DrawingLayerRef {
    startPath: (path: DrawingPath) => void;
    addPoints: (points: { x: number; y: number; pressure?: number }[]) => void;
    endPath: () => void;
    syncView: () => void;
    updateTransform: (transform: string | { x: number; y: number; scale: number }) => void;
}

export const DrawingLayer = React.memo(React.forwardRef<DrawingLayerRef, DrawingLayerProps>(({ paths, currentPath }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const currentPathRef = useRef<DrawingPath | null>(null);

    const animationFrameRef = useRef<number | null>(null);
    const lastTransformRef = useRef<string>(''); // Persistence ref
    const renderStateRef = useRef<{ x: number, y: number, scale: number }>({ x: 0, y: 0, scale: 1 });

    // Get Canvas transform from context
    const canvasRefs = useContext(CanvasRefContext);

    // Portal Target
    const [container, setContainer] = useState<HTMLElement | null>(null);

    // Find container on mount
    useEffect(() => {
        // Try to get container from ref or selector
        const el = canvasRefs?.containerRef?.current || document.querySelector('.ref-board-canvas') as HTMLElement;
        if (el) {
            setContainer(el);
        } else {
            // Retry once in case of render timing
            const timer = setTimeout(() => {
                const elRetry = canvasRefs?.containerRef?.current || document.querySelector('.ref-board-canvas') as HTMLElement;
                if (elRetry) setContainer(elRetry);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [canvasRefs]);

    // Draw a smooth curve through points using quadratic bezier
    const drawSmoothPath = (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) => {
        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 2) {
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            // Quadratic Bezier smoothing
            for (let i = 1; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
            }
            // Connect to last point
            const last = points[points.length - 1];
            const prev = points[points.length - 2];
            ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
        }

        ctx.stroke();
    };

    // Draw a single path on the canvas
    const drawPath = (ctx: CanvasRenderingContext2D, path: DrawingPath) => {
        if (path.points.length < 2) return;

        ctx.save();

        // Setup stroke style
        ctx.strokeStyle = path.isEraser ? 'rgba(255, 0, 0, 0.3)' : path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Check if we need variable width (pressure sensitive)
        const isPressureVariable = path.points.some(p => Math.abs((p.pressure || 0.5) - 0.5) > 0.01);

        if (isPressureVariable) {
            // Draw variable width path (for stylus/pen with pressure)
            for (let i = 0; i < path.points.length - 1; i++) {
                const p1 = path.points[i];
                const p2 = path.points[i + 1];
                const pressure1 = p1.pressure ?? 0.5;
                const pressure2 = p2.pressure ?? 0.5;
                const width1 = path.size * (0.3 + pressure1 * 0.7);
                const width2 = path.size * (0.3 + pressure2 * 0.7);

                // Draw segment with variable width
                ctx.lineWidth = (width1 + width2) / 2;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        } else {
            // Draw smooth fixed-width path
            drawSmoothPath(ctx, path.points);
        }

        ctx.restore();
    };

    // Keep reference to latest paths to avoid stale closures in RAF
    const pathsRef = useRef(paths);
    pathsRef.current = paths;

    // ... (rest of code)

    // Redraw all paths on canvas
    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset transform to clear full canvas (Screen Space)
        // CRITICAL: Clear CSS transform that might have been applied during fast panning
        // Reset transform to clear full canvas (Screen Space)
        // CRITICAL: Clear CSS transform that might have been applied during fast panning
        canvas.style.transform = '';
        lastTransformRef.current = ''; // Clear persistence ref

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get FRESH values from refs for sync
        const scale = canvasRefs?.scaleRef?.current ?? 1;
        const position = canvasRefs?.positionRef?.current ?? { x: 0, y: 0 };

        // Apply World Transform (World -> Screen)
        ctx.setTransform(scale, 0, 0, scale, position.x, position.y);

        // Save state used for this render
        renderStateRef.current = { x: position.x, y: position.y, scale };

        // Draw all completed paths from REF (latest state)
        pathsRef.current.forEach(path => drawPath(ctx, path));

        // Draw current path from Prop (primary) or Ref (imperative fallback)
        const activePath = currentPath || currentPathRef.current;
        if (activePath && activePath.points.length > 0) {
            drawPath(ctx, activePath);
        }
    };

    const scheduleRedraw = () => {
        if (animationFrameRef.current) return;
        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = null;
            redrawCanvas();
        });
    };

    // Imperative handle for external drawing control
    useImperativeHandle(ref, () => ({
        startPath: (path: DrawingPath) => {
            currentPathRef.current = { ...path, points: [] };
        },
        addPoints: (points: { x: number; y: number; pressure?: number }[]) => {
            if (!currentPathRef.current) return;
            currentPathRef.current.points.push(...points);
            scheduleRedraw();
        },
        endPath: () => {
            currentPathRef.current = null;
            scheduleRedraw();
        },
        syncView: () => {
            // console.log('syncView called');
            scheduleRedraw();
        },
        updateTransform: (state: { x: number; y: number; scale: number } | string) => { // Allow object
            if (canvasRef.current) {
                // If string (legacy), ignore or handle? 
                // We shift to object protocol.
                if (typeof state === 'string') {
                    canvasRef.current.style.transform = state;
                    lastTransformRef.current = state;
                    return;
                }

                const target = state;
                const base = renderStateRef.current;

                // Calculate relative transform
                // We want: visible_pos = target_pos
                // We have: bitmap_pos (baked in base.pos)
                // Equation: target_pos = base_pos * scale_ratio + delta_translate

                const scaleRatio = target.scale / base.scale;
                const dx = target.x - (base.x * scaleRatio);
                const dy = target.y - (base.y * scaleRatio);

                // Use 4 decimal places for precision
                const transform = `translate3d(${dx.toFixed(4)}px, ${dy.toFixed(4)}px, 0) scale(${scaleRatio.toFixed(6)})`;

                canvasRef.current.style.transformOrigin = '0 0'; // CRITICAL
                canvasRef.current.style.transform = transform;
                lastTransformRef.current = transform;
            }
        }
    }));

    // CRITICAL: Re-apply transform after every render to survive React reconciliation
    // Use useLayoutEffect to ensure style is restored BEFORE browser paint
    React.useLayoutEffect(() => {
        if (canvasRef.current && lastTransformRef.current) {
            canvasRef.current.style.transform = lastTransformRef.current;
        }
    }); // No deps = run on every render

    // Resize canvas to match container
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !container) return;

        const updateSize = () => {
            const rect = container.getBoundingClientRect();

            // Set canvas size to match CSS pixels (no DPR scaling in coordinates)
            // This makes coordinates match screen coordinates directly
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            // Redraw after resize
            scheduleRedraw();
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [container, paths]); // Re-bind if container changes

    // Redraw when paths change (completed paths only)
    // Don't redraw on currentPath changes - those are handled incrementally
    useEffect(() => {
        scheduleRedraw();
    }, [paths]);

    if (!container) return null;

    return createPortal(
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{
                zIndex: 20000, // Above everything
                // No CSS transform - we use ctx transform
            }}
        />,
        container
    );
}));

DrawingLayer.displayName = 'DrawingLayer';
