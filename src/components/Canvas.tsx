import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CanvasContext from '../contexts/CanvasContext';
import CanvasRefContext from '../contexts/CanvasRefContext';
import { Minimap } from './Minimap';
import { Assence } from './Assence';
import { UISettings } from '../components/SettingsModal';

interface CanvasProps {
    children?: React.ReactNode;
    selectedItemId?: string | null;
    getItemPosition?: (id: string) => { x: number; y: number; width: number; height: number } | null;
    onSelectionBox?: (box: { x: number; y: number; width: number; height: number }) => void;
    onCanvasClick?: (e: React.MouseEvent & { canvasX?: number; canvasY?: number }) => void;
    onCanvasDrop?: (e: React.DragEvent & { canvasX?: number; canvasY?: number }) => void;
    onCanvasMouseDown?: (e: React.MouseEvent & { canvasX: number; canvasY: number; pressure?: number }) => void;
    onCanvasMouseMove?: (e: React.MouseEvent & { canvasX: number; canvasY: number; pressure?: number; coalescedPoints?: { x: number; y: number; pressure: number }[] }) => void;
    onCanvasMouseUp?: (e: React.MouseEvent & { canvasX: number; canvasY: number; pressure?: number }) => void;
    onCanvasPointerDown?: (e: React.PointerEvent & { canvasX: number; canvasY: number; pressure?: number }) => void;
    onCanvasPointerMove?: (e: React.PointerEvent & { canvasX: number; canvasY: number; pressure?: number }) => void;
    onCanvasPointerUp?: (e: React.PointerEvent & { canvasX: number; canvasY: number; pressure?: number }) => void;
    panSettings?: { keys: string[]; button: 'Left' | 'Middle' | 'Right' };
    zoomSettings?: { keys: string[]; button: 'Left' | 'Middle' | 'Right' };
    windowDragSettings?: { keys: string[]; button: 'Left' | 'Middle' | 'Right' };
    zoomWheelModifier?: string;
    pressedKeys?: Set<string>;
    activeTool?: 'select' | 'text' | 'arrow' | 'pen' | 'eraser';
    brushSize?: number;
    isEraser?: boolean;
    onContextMenu?: (e: React.MouseEvent & { canvasX?: number; canvasY?: number }) => void;
    zoomToFit?: { itemId: string; padding?: number } | null;
    isSelecting?: boolean;
    opacity?: number;
    onOpacityChange?: (opacity: number) => void;
    opacityDragSettings?: { keys: string[]; button: 'Left' | 'Middle' | 'Right' };
    items?: any[]; // For Minimap
    onViewportChange?: (viewport: { x: number; y: number; scale: number; width: number; height: number }) => void;
    onVisualUpdate?: (visualState?: { x: number; y: number; scale: number }) => void;
    navigateTo?: { x: number; y: number } | null;
    onNavigated?: () => void;
    uiSettings?: UISettings;
    fixedLayer?: React.ReactNode;
    onLODChange?: (isLowZoom: boolean) => void; // Synchronous LOD hook
    isUiVisible?: boolean; // Control UI element visibility (e.g., Minimap)
}

export const Canvas: React.FC<CanvasProps> = ({
    children,
    getItemPosition,
    onSelectionBox,
    onCanvasClick,
    onCanvasDrop,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onContextMenu,
    panSettings = { keys: ['Alt'], button: 'Middle' },
    zoomSettings = { keys: ['Alt'], button: 'Right' },
    windowDragSettings = { keys: [], button: 'Right' },
    zoomWheelModifier = 'None',
    pressedKeys = new Set(),
    activeTool = 'select',
    brushSize = 5,
    isEraser = false,
    zoomToFit = null,
    opacity = 1.0,
    onOpacityChange,
    opacityDragSettings = { keys: ['CTRL', 'ALT'], button: 'Right' },
    items = [],
    onViewportChange,
    onVisualUpdate,
    navigateTo,
    onNavigated,
    uiSettings = { canvasBackgroundColor: '#1f1f1f', canvasBackgroundGradientColor: '#192024', dotPatternColor: '#999999', dotPatternSpacing: 120, dotPatternSize: 1, enableGradient: true, enablePattern: true },
    fixedLayer,
    onLODChange,
    isUiVisible = true
}) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const [isWindowDragging, setIsWindowDragging] = useState(false);
    const [isOpacityDragging, setIsOpacityDragging] = useState(false); // New state
    const [windowDragEndTime, setWindowDragEndTime] = useState(0);
    const [zoomEndTime, setZoomEndTime] = useState(0);
    const [opacityDragEndTime, setOpacityDragEndTime] = useState(0);
    const [panEndTime, setPanEndTime] = useState(0);
    const [windowDragStartPos, setWindowDragStartPos] = useState<{ x: number; y: number } | null>(null);

    const [zoomAnchor, setZoomAnchor] = useState({ x: 0, y: 0 }); // Anchor point for zoom
    const containerRef = useRef<HTMLDivElement>(null);
    const fixedLayerContainerRef = useRef<HTMLDivElement>(null); // New ref for fixed layer optimization
    const lastViewportUpdateRef = useRef(0); // For throttling viewport updates (Minimap sync)

    // Refs for stable access in event listeners
    const pressedKeysRef = useRef(pressedKeys);
    const zoomWheelModifierRef = useRef(zoomWheelModifier);
    // Update refs on render so listeners always get fresh values without re-binding
    pressedKeysRef.current = pressedKeys;
    zoomWheelModifierRef.current = zoomWheelModifier;

    // Performance optimization: Refs for context to avoid re-renders
    const scaleRef = useRef(1);
    const positionRef = useRef({ x: 0, y: 0 });
    const visualTransformRef = useRef({ x: 0, y: 0, scale: 1 }); // Ensure visualTransformRef is defined if missing

    // Sync refs with state
    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    const canvasRefsValue = useMemo(() => ({
        scaleRef,
        positionRef,
        visualTransformRef, // Add to context
        containerRef
    }), []);

    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
    const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    // Use ref for lastMousePos to prevent re-renders during drag
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const [containerDimensions, setContainerDimensions] = useState({ width: 1000, height: 1000 });

    // Ref for tracking visual transform during drag operations (avoiding re-renders)

    const dragZoomRafId = useRef<number | null>(null);
    const wheelDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const panDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const wheelTempStateRef = useRef<{ scale: number; x: number; y: number } | null>(null);
    const canvasContentRef = useRef<HTMLElement | null>(null);

    // Track container dimensions for minimap
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerDimensions({ width: rect.width, height: rect.height });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, []);
    // Handle navigateTo prop for bookmark navigation
    useEffect(() => {
        if (navigateTo) {
            const winW = containerDimensions.width || window.innerWidth;
            const winH = containerDimensions.height || window.innerHeight;

            // Center the target coordinates in viewport
            const newX = (winW / 2) - (navigateTo.x * scale);
            const newY = (winH / 2) - (navigateTo.y * scale);

            if (isFinite(newX) && isFinite(newY)) {
                // Update React State
                setPosition({ x: newX, y: newY });

                // CRITICAL: Update Refs immediately for Minimap sync
                const currentScale = scaleRef.current; // Use ref for consistency
                positionRef.current = { x: newX, y: newY };
                visualTransformRef.current = { x: newX, y: newY, scale: currentScale }; // Minimap reads this!

                // Apply direct DOM transform for instant visual update
                const transform = `translate3d(${newX}px, ${newY}px, 0) scale(${currentScale})`;
                if (canvasContentRef.current) {
                    canvasContentRef.current.style.transform = transform;
                }
                if (fixedLayerContainerRef.current) {
                    fixedLayerContainerRef.current.style.transform = transform;
                }

                // Notify Minimap to re-render visible area
                onVisualUpdate?.();

                // Notify parent that navigation is complete so it can clear the prop
                if (onNavigated) {
                    onNavigated();
                }
            }
        }
    }, [navigateTo, scale, containerDimensions.width, containerDimensions.height, onNavigated]);




    // Notify parent of viewport changes
    useEffect(() => {
        if (onViewportChange) {
            onViewportChange({
                x: position.x,
                y: position.y,
                scale: scale,
                width: containerDimensions.width,
                height: containerDimensions.height
            });
        }
    }, [position.x, position.y, scale, containerDimensions.width, containerDimensions.height, onViewportChange]);

    // DEBUG: Log DOM visible count
    useEffect(() => {
        if (!containerRef.current) return;

        const totalItems = containerRef.current.querySelectorAll('.media-item-wrapper').length;
        const hiddenByCSS = containerRef.current.querySelectorAll('.low-zoom .media-item-wrapper:not(.selected)').length;
        const visibleDOMCount = totalItems - hiddenByCSS;

        console.log(`[DOM Render] Zoom: ${Math.round(scale * 100)}% | Total: ${totalItems} | Visible: ${visibleDOMCount} | Hidden: ${hiddenByCSS}`);
    }, [scale]);


    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let rafId: number | null = null;
        let debounceTimer: NodeJS.Timeout | null = null;

        // Track visual state for continuous zooming
        // IMPORTANT: These accumulate across wheel events for smooth continuous zoom
        let tempScale = scaleRef.current;
        let tempPosition = { ...positionRef.current };



        const onWheel = (e: WheelEvent) => {
            // If no pending debounce, sync with refs (handles navigation)
            // If debounce pending, keep accumulating (continuous zoom)
            if (!wheelDebounceTimerRef.current) {
                // FIX: Use visualTransformRef as the source of truth for the start of a zoom gesture
                // This ensures we start zooming from the CURRENT VISUAL state, even if the React state (positionRef/scaleRef) 
                // hasn't settled yet (e.g., due to pan debounce).
                if (visualTransformRef.current) {
                    tempScale = visualTransformRef.current.scale;
                    tempPosition = { x: visualTransformRef.current.x, y: visualTransformRef.current.y };
                } else {
                    tempScale = scaleRef.current;
                    tempPosition = { ...positionRef.current };
                }
            }

            // Check zoom modifier using REF to avoid re-binding
            const currentModifier = zoomWheelModifierRef.current;
            const currentKeys = pressedKeysRef.current;

            if (currentModifier !== 'None') {
                const mod = currentModifier.toUpperCase();
                const isModifierPressed = currentKeys.has(mod) ||
                    (mod === 'CTRL' && (e.ctrlKey || e.metaKey)) ||
                    (mod === 'ALT' && e.altKey) ||
                    (mod === 'SHIFT' && e.shiftKey);

                if (!isModifierPressed) return;
            }

            e.preventDefault();

            // Cancel previous RAF and debounce
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            const scaleSensitivity = 0.001;
            const delta = e.deltaY * -scaleSensitivity;
            const newScale = tempScale + delta;
            const clampedScale = Math.min(Math.max(0.01, newScale), 5);

            // Mouse position relative to the container
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate new position using temp values
            const scaleRatio = clampedScale / tempScale;
            const newX = mouseX - (mouseX - tempPosition.x) * scaleRatio;
            const newY = mouseY - (mouseY - tempPosition.y) * scaleRatio;

            // Update temp state
            tempScale = clampedScale;
            tempPosition = { x: newX, y: newY };

            // Apply transform directly to DOM for smooth 60fps zoom
            const transform = `translate3d(${newX}px, ${newY}px, 0) scale(${clampedScale})`;

            // CRITICAL FIX: Update visualTransformRef immediately
            // This allows Minimap (via RAF) to stay in sync during the wheel action
            visualTransformRef.current = {
                x: newX,
                y: newY,
                scale: clampedScale
            };

            if (canvasContentRef.current) {
                canvasContentRef.current.style.transform = transform;

                // LOD SYNCHRONIZATION FIX:
                if (clampedScale < 0.3) {
                    canvasContentRef.current.classList.add('low-zoom');
                    onLODChange?.(true);
                } else {
                    canvasContentRef.current.classList.remove('low-zoom');
                    onLODChange?.(false);
                }
            }
            // Also apply to fixed layer (CanvasItemLayer) so it scales visually
            if (fixedLayerContainerRef.current) {
                fixedLayerContainerRef.current.style.transform = transform;
            }

            // Sync DrawingLayer
            onVisualUpdate?.(visualTransformRef.current);

            // Debounce React state update (100ms)
            debounceTimer = setTimeout(() => {
                setScale(tempScale);
                setPosition({ x: tempPosition.x, y: tempPosition.y });
                // Update refs ONLY after debounce
                scaleRef.current = tempScale;
                positionRef.current = { x: tempPosition.x, y: tempPosition.y };
                wheelDebounceTimerRef.current = null;
                wheelTempStateRef.current = null;

                if (fixedLayerContainerRef.current) {
                    fixedLayerContainerRef.current.style.transform = '';
                }

                // End visual update (sync drawing layer)
                onVisualUpdate?.();
            }, 100);

            // Store refs for external access (e.g., flush on pan start)
            wheelDebounceTimerRef.current = debounceTimer;
            wheelTempStateRef.current = { scale: tempScale, x: tempPosition.x, y: tempPosition.y };
        };

        container.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', onWheel);
            if (rafId) cancelAnimationFrame(rafId);
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }, []); // FIXED: Empty deps array! No re-binding on key press. Refs handle stable access.

    // Handle zoom to fit
    useEffect(() => {
        if (!zoomToFit || !getItemPosition || !containerRef.current) return;

        const { itemId, padding = 40 } = zoomToFit;
        const itemBounds = getItemPosition(itemId);

        if (itemBounds) {
            const container = containerRef.current;
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;

            // Calculate scale to fit
            const scaleX = (containerW - padding * 2) / itemBounds.width;
            const scaleY = (containerH - padding * 2) / itemBounds.height;
            const newScale = Math.min(Math.max(0.01, Math.min(scaleX, scaleY)), 5); // Clamp

            // Calculate position to center
            const itemCenterX = itemBounds.x + itemBounds.width / 2;
            const itemCenterY = itemBounds.y + itemBounds.height / 2;

            const newX = (containerW / 2) - (itemCenterX * newScale);
            const newY = (containerH / 2) - (itemCenterY * newScale);

            setScale(newScale);
            setPosition({ x: newX, y: newY });

            // CRITICAL FIX: Immediately sync refs to ensure next gesture (Pan/Zoom) starts from correct state
            // This prevents "reset to previous zoom" bugs if user Pans immediately after Double Click
            scaleRef.current = newScale;
            positionRef.current = { x: newX, y: newY };
            visualTransformRef.current = { scale: newScale, x: newX, y: newY };

            // Notify parent of viewport change
            if (onViewportChange) {
                onViewportChange({
                    x: newX,
                    y: newY,
                    scale: newScale,
                    width: containerW,
                    height: containerH
                });
            }
        }
    }, [zoomToFit, getItemPosition, onViewportChange]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // Allow interaction if clicking on container, canvas-content, or the SVG background layer
        const isCanvasBackground = target === e.currentTarget ||
            target.classList.contains('canvas-content') ||
            target.tagName.toLowerCase() === 'svg';

        // Update mouse position for brush cursor
        setMousePos({ x: e.clientX, y: e.clientY });

        // Check Pan Settings
        let isPanButton = false;
        if (panSettings.button === 'Left' && e.button === 0) isPanButton = true;
        else if (panSettings.button === 'Middle' && e.button === 1) isPanButton = true;
        else if (panSettings.button === 'Right' && e.button === 2) isPanButton = true;

        let isPanModifierPressed = false;
        if (panSettings.keys.length === 0 || panSettings.keys[0] === 'None') {
            isPanModifierPressed = true;
        } else {
            isPanModifierPressed = panSettings.keys.every(k => {
                const mod = k.toUpperCase();
                return pressedKeys.has(mod) ||
                    (mod === 'ALT' && e.altKey) ||
                    (mod === 'CTRL' && (e.ctrlKey || e.metaKey)) ||
                    (mod === 'SHIFT' && e.shiftKey);
            });
        }

        // Pan Triggered - allow panning even on items
        if (isPanButton && isPanModifierPressed) {
            e.preventDefault();
            e.stopPropagation();
            setIsPanning(true);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Check Opacity Drag Settings
        let isOpacityDragButton = false;
        if (opacityDragSettings.button === 'Left' && e.button === 0) isOpacityDragButton = true;
        else if (opacityDragSettings.button === 'Middle' && e.button === 1) isOpacityDragButton = true;
        else if (opacityDragSettings.button === 'Right' && e.button === 2) isOpacityDragButton = true;

        let isOpacityDragModifierPressed = false;
        if (opacityDragSettings.keys.length === 0 || opacityDragSettings.keys[0] === 'None') {
            isOpacityDragModifierPressed = !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey;
        } else {
            isOpacityDragModifierPressed = opacityDragSettings.keys.every(k => {
                const mod = k.toUpperCase();
                return pressedKeys.has(mod) ||
                    (mod === 'ALT' && e.altKey) ||
                    (mod === 'CTRL' && (e.ctrlKey || e.metaKey)) ||
                    (mod === 'SHIFT' && e.shiftKey);
            });
        }

        // Opacity Drag Triggered
        if (isOpacityDragButton && isOpacityDragModifierPressed && onOpacityChange) {
            e.preventDefault();
            setIsOpacityDragging(true);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Check Zoom Settings
        let isZoomButton = false;
        if (zoomSettings.button === 'Left' && e.button === 0) isZoomButton = true;
        else if (zoomSettings.button === 'Middle' && e.button === 1) isZoomButton = true;
        else if (zoomSettings.button === 'Right' && e.button === 2) isZoomButton = true;

        let isZoomModifierPressed = false;
        if (zoomSettings.keys.length === 0 || zoomSettings.keys[0] === 'None') {
            isZoomModifierPressed = true;
        } else {
            isZoomModifierPressed = zoomSettings.keys.every(k => {
                const mod = k.toUpperCase();
                return pressedKeys.has(mod) ||
                    (mod === 'ALT' && e.altKey) ||
                    (mod === 'CTRL' && (e.ctrlKey || e.metaKey)) ||
                    (mod === 'SHIFT' && e.shiftKey);
            });
        }

        // Check Window Drag Settings
        let isWindowDragButton = false;
        if (windowDragSettings.button === 'Left' && e.button === 0) isWindowDragButton = true;
        else if (windowDragSettings.button === 'Middle' && e.button === 1) isWindowDragButton = true;
        else if (windowDragSettings.button === 'Right' && e.button === 2) isWindowDragButton = true;

        let isWindowDragModifierPressed = false;
        if (windowDragSettings.keys.length === 0 || windowDragSettings.keys[0] === 'None') {
            // If no keys are configured, strictly require NO modifiers
            isWindowDragModifierPressed = !e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey;
        } else {
            isWindowDragModifierPressed = windowDragSettings.keys.every(k => {
                const mod = k.toUpperCase();
                return pressedKeys.has(mod) ||
                    (mod === 'ALT' && e.altKey) ||
                    (mod === 'CTRL' && (e.ctrlKey || e.metaKey)) ||
                    (mod === 'SHIFT' && e.shiftKey);
            });
        }

        // Zoom Triggered (priority over window drag if both use right click)
        // Check zoom first if it uses the same button as window drag
        if (isZoomButton && isZoomModifierPressed) {
            e.preventDefault();
            setIsZooming(true);

            setZoomAnchor({ x: e.clientX, y: e.clientY }); // Set anchor to current mouse pos
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };

            // Initialize visual ref on zoom start
            visualTransformRef.current = { scale, x: position.x, y: position.y };
            return;
        }

        // Window Drag Triggered
        // Store start position for right click, but only start dragging after movement
        // IMPORTANT: Only trigger if modifier keys match settings
        if (isWindowDragButton && isWindowDragModifierPressed) {
            setWindowDragStartPos({ x: e.screenX, y: e.screenY });
            lastMousePosRef.current = { x: e.screenX, y: e.screenY };

            // Prevent default to block context menu when window drag is active
            e.preventDefault();
            return;
        }

        // Pan Triggered
        if (isPanButton && isPanModifierPressed) {
            e.preventDefault();

            // CRITICAL FIX: Flush pending wheel zoom state immediately
            // This prevents viewport from reverting to pre-wheel-zoom position
            if (wheelDebounceTimerRef.current && wheelTempStateRef.current) {
                clearTimeout(wheelDebounceTimerRef.current);
                const wheelState = wheelTempStateRef.current;

                // Update React state
                setScale(wheelState.scale);
                setPosition({ x: wheelState.x, y: wheelState.y });

                // CRITICAL: Also update refs so pan uses correct base
                scaleRef.current = wheelState.scale;
                positionRef.current = { x: wheelState.x, y: wheelState.y };

                // Sync visualTransformRef to match the flushed state
                visualTransformRef.current = { scale: wheelState.scale, x: wheelState.x, y: wheelState.y };

                wheelDebounceTimerRef.current = null;
                wheelTempStateRef.current = null;
            } else {
                // If no pending wheel state, sync visualTransformRef with current stable refs
                // This ensures pan starts from the actual current position
                // Check if we need to sync to handle cases where other tools might have moved canvas
                if (!wheelDebounceTimerRef.current) {
                    visualTransformRef.current = {
                        scale: scaleRef.current,
                        x: positionRef.current.x,
                        y: positionRef.current.y
                    };
                }
            }

            setIsPanning(true);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Custom Mouse Down (e.g., Drawing)
        if (onCanvasMouseDown && !isPanning && !isZooming && !isWindowDragging) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // FIX: Use visualTransformRef for real-time coordinates
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const canvasX = (e.clientX - canvasRect.left - currentX) / currentScale;
                const canvasY = (e.clientY - canvasRect.top - currentY) / currentScale;
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onCanvasMouseDown(extendedEvent);
                // Don't start selection if using pen or eraser tool
                if (activeTool === 'pen' || activeTool === 'eraser') {
                    return;
                }
            }
        }

        // Default Selection (Left Click only, if not panning/zooming/window dragging, and not pen/eraser)
        // Only start selection if clicking on canvas background, not on items
        const clickTarget = e.target as HTMLElement;
        const isClickingOnItem = clickTarget.closest('[data-item-id]') || clickTarget.closest('.group');

        if (e.button === 0 && !isPanning && !isZooming && !isWindowDragging && activeTool !== 'pen' && activeTool !== 'eraser' && isCanvasBackground && !isClickingOnItem && !e.defaultPrevented) {
            setIsSelecting(true);
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // Convert screen coordinates to canvas coordinates
                // Transform order is: translate(position.x, position.y) scale(scale)
                // Screen = position + canvas * scale
                // Canvas = (Screen - position) / scale
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const x = (e.clientX - canvasRect.left - currentX) / currentScale;
                const y = (e.clientY - canvasRect.top - currentY) / currentScale;
                setSelectionStart({ x, y });
                setSelectionEnd({ x, y });
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSelecting) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // FIX: Use visualTransformRef
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const x = (e.clientX - canvasRect.left - currentX) / currentScale;
                const y = (e.clientY - canvasRect.top - currentY) / currentScale;
                setSelectionEnd({ x, y });
            }
        } else if (isPanning) {
            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;

            // Use visualTransformRef to accumulate movement from the VISUAL state
            // This works because we update visualTransformRef.current immediately below
            // and positionRef (stable state) is untouched until debounce.
            const currentVisX = visualTransformRef.current.x;
            const currentVisY = visualTransformRef.current.y;

            const newX = currentVisX + dx;
            const newY = currentVisY + dy;

            // Update Visual Ref immediately
            visualTransformRef.current.x = newX;
            visualTransformRef.current.y = newY;

            // Apply transform directly to DOM using VISUAL state
            const transform = `translate3d(${newX}px, ${newY}px, 0) scale(${visualTransformRef.current.scale})`;
            if (canvasContentRef.current) {
                canvasContentRef.current.style.transform = transform;
            }
            // Apply to fixed layer too
            if (fixedLayerContainerRef.current) {
                fixedLayerContainerRef.current.style.transform = transform;
            }

            // Sync DrawingLayer
            onVisualUpdate?.(visualTransformRef.current);

            // FIX: Throttle viewport updates for Minimap (e.g. 60fps)
            // This ensures Minimap updates smoothly without waiting for debounce
            const now = Date.now();
            if (onViewportChange && now - (lastViewportUpdateRef.current || 0) > 16) {
                onViewportChange({
                    x: newX,
                    y: newY,
                    scale: visualTransformRef.current.scale,
                    width: containerRef.current?.clientWidth || 0,
                    height: containerRef.current?.clientHeight || 0
                });
                lastViewportUpdateRef.current = now;
            }

            // Debounce state update (100ms) to minimize re-renders during pan
            if (panDebounceTimerRef.current) {
                clearTimeout(panDebounceTimerRef.current);
            }
            panDebounceTimerRef.current = setTimeout(() => {
                setPosition({ x: newX, y: newY });
                // Update refs here to settle the state
                positionRef.current = { x: newX, y: newY };
                scaleRef.current = visualTransformRef.current.scale; // Ensure scale is consistent

                panDebounceTimerRef.current = null;
                if (fixedLayerContainerRef.current) {
                    fixedLayerContainerRef.current.style.transform = '';
                }

                // End visual update (sync drawing layer)
                onVisualUpdate?.();
            }, 100);

            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        } else if (isZooming) {
            // Changed from vertical (dy) to horizontal (dx)
            // Left drag = zoom out (negative), Right drag = zoom in (positive)
            const dx = e.clientX - lastMousePosRef.current.x;
            const zoomSensitivity = 0.0035; // Reduced by 30% from 0.005
            const delta = dx * zoomSensitivity;

            // CRITICAL: Sync visualTransformRef with current viewport on first drag frame
            // This ensures drag zoom starts from current position (after pan) not stale values
            // Only do this on first frame (when visualTransformRef differs significantly from current)
            // Or if we just started zooming

            // NOTE: We moved the initialization to MouseDown, so visualTransformRef should be fresh.
            // But let's double check if it drifted (e.g. pan happened).
            // Actually, Pan now updates visualTransformRef, so it should be fine!

            // FIX: Use visualTransformRef.current.scale directly
            const effectiveScale = visualTransformRef.current.scale;
            const effectiveNewScale = Math.min(Math.max(0.01, effectiveScale + delta), 30);
            const effectiveScaleRatio = effectiveNewScale / effectiveScale;

            // Calculate new position based on anchor
            const zoomPoint = zoomAnchor;
            const canvasRect = containerRef.current?.getBoundingClientRect();

            if (canvasRect) {
                const relX = zoomPoint.x - canvasRect.left;
                const relY = zoomPoint.y - canvasRect.top;

                // New pos = Mouse - (Mouse - OldPos) * Ratio
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const newX = relX - (relX - currentX) * effectiveScaleRatio;
                const newY = relY - (relY - currentY) * effectiveScaleRatio;

                // OPTIMIZED: Update Ref and DOM directly, do NOT set state
                visualTransformRef.current = {
                    scale: effectiveNewScale,
                    x: newX,
                    y: newY
                };

                // CRITICAL: Also update scaleRef/positionRef for consistency with wheel zoom
                // OPTIMIZATION: Do NOT update refs immediately
                // scaleRef.current = effectiveNewScale;
                // positionRef.current = { x: newX, y: newY };

                // Apply visual transform immediately via DOM (RAF)
                if (dragZoomRafId.current !== null) {
                    cancelAnimationFrame(dragZoomRafId.current);
                }

                dragZoomRafId.current = requestAnimationFrame(() => {
                    const content = containerRef.current?.querySelector('.canvas-content') as HTMLElement;
                    if (content) {
                        content.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${effectiveNewScale})`;
                    }
                    if (fixedLayerContainerRef.current) {
                        fixedLayerContainerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${effectiveNewScale})`;
                    }

                    // Sync DrawingLayer
                    onVisualUpdate?.(visualTransformRef.current);
                });
                dragZoomRafId.current = null;
                // Also update background pattern
                // const bgPattern = containerRef.current?.children[1] as HTMLElement; // Dot Pattern is 2nd child?
                // Need a reliable selector. 
                // Let's rely on React state update at the end to fix background.
            }

            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        } else if (windowDragStartPos) {
            // Check if mouse has moved enough to start window dragging
            const dx = e.screenX - windowDragStartPos.x;
            const dy = e.screenY - windowDragStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only start dragging if moved more than 5 pixels
            if (distance > 5 && !isWindowDragging) {
                setIsWindowDragging(true);
                // Notify main process that dragging started
                if (window.electronAPI?.startWindowMove) {
                    window.electronAPI.startWindowMove(windowDragStartPos.x, windowDragStartPos.y);
                }
            }

            if (isWindowDragging) {
                // Send current mouse position to main process
                if (window.electronAPI?.moveWindow) {
                    window.electronAPI.moveWindow(e.screenX, e.screenY);
                }
            }
            lastMousePosRef.current = { x: e.screenX, y: e.screenY };
        } else if (isOpacityDragging && onOpacityChange) {
            const dx = e.clientX - lastMousePosRef.current.x;
            // Sensitivity: 100px = 0.5 change? 
            // 0.005 per pixel.
            const delta = dx * 0.005;
            // FIX: Limit minimum opacity to 0.1 (10%) so it doesn't become invisible/lost
            const newOpacity = Math.max(0.01, Math.min(1.0, opacity + delta));
            onOpacityChange(newOpacity);
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        } else if (onCanvasMouseMove && !isPanning && !isZooming && !isWindowDragging && !isOpacityDragging) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // FIX: Use visualTransformRef for real-time coordinates
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const canvasX = (e.clientX - canvasRect.left - currentX) / currentScale;
                const canvasY = (e.clientY - canvasRect.top - currentY) / currentScale;
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onCanvasMouseMove(extendedEvent);
            }
        }

        // Always update brush cursor position when using pen or eraser
        if (activeTool === 'pen' || activeTool === 'eraser') {
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        const wasSelecting = isSelecting;
        const selectionDistance = Math.sqrt(
            Math.pow(selectionEnd.x - selectionStart.x, 2) +
            Math.pow(selectionEnd.y - selectionStart.y, 2)
        );

        if (onCanvasMouseUp) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // FIX: Use visualTransformRef for real-time coordinates
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const canvasX = (e.clientX - canvasRect.left - currentX) / currentScale;
                const canvasY = (e.clientY - canvasRect.top - currentY) / currentScale;
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onCanvasMouseUp(extendedEvent);
            }
        }

        if (wasSelecting && onSelectionBox) {
            const box = {
                x: Math.min(selectionStart.x, selectionEnd.x),
                y: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y)
            };

            // If box is very small, treat as click
            if (box.width < 5 && box.height < 5) {
                if (onCanvasClick) {
                    // Transform click coordinates to canvas space
                    const canvasRect = containerRef.current?.getBoundingClientRect();
                    if (canvasRect) {
                        // FIX: Use visualTransformRef
                        const currentScale = visualTransformRef.current.scale;
                        const currentX = visualTransformRef.current.x;
                        const currentY = visualTransformRef.current.y;

                        const canvasX = (e.clientX - canvasRect.left - currentX) / currentScale;
                        const canvasY = (e.clientY - canvasRect.top - currentY) / currentScale;
                        // Extend the original event to preserve methods
                        const extendedEvent = Object.assign(e, { canvasX, canvasY });
                        onCanvasClick(extendedEvent);
                    } else {
                        onCanvasClick(e);
                    }
                }
            } else {
                onSelectionBox(box);
            }
        } else if (!wasSelecting && !isPanning && !isZooming && !isWindowDragging && selectionDistance < 5 && onCanvasClick) {
            // Handle click when not selecting (e.g., text tool)
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                // FIX: Use visualTransformRef
                const currentScale = visualTransformRef.current.scale;
                const currentX = visualTransformRef.current.x;
                const currentY = visualTransformRef.current.y;

                const canvasX = (e.clientX - canvasRect.left - currentX) / currentScale;
                const canvasY = (e.clientY - canvasRect.top - currentY) / currentScale;
                // Extend the original event to preserve methods
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onCanvasClick(extendedEvent);
            } else {
                onCanvasClick(e);
            }
        }

        setIsSelecting(false);

        // Flush any pending pan/zoom state updates immediately
        if (wheelDebounceTimerRef.current) {
            clearTimeout(wheelDebounceTimerRef.current);
            setScale(scaleRef.current);
            setPosition({ x: positionRef.current.x, y: positionRef.current.y });
            wheelDebounceTimerRef.current = null;
        }
        if (panDebounceTimerRef.current) {
            clearTimeout(panDebounceTimerRef.current);
            panDebounceTimerRef.current = null;
        }

        // FIX: When stopping pan, ALWAYS sync from visualTransformRef
        // This handles cases where debounce hadn't fired yet, or where
        // a re-render might have used stale state.
        if (isPanning) {
            const finalX = visualTransformRef.current.x;
            const finalY = visualTransformRef.current.y;

            // Update refs first
            positionRef.current = { x: finalX, y: finalY };
            scaleRef.current = visualTransformRef.current.scale;

            // Force state update
            setPosition({ x: finalX, y: finalY });
            // Record pan end time
            setPanEndTime(Date.now());
        }

        setIsPanning(false);

        // Record end times before resetting states
        if (isZooming) {
            setZoomEndTime(Date.now());
            // Commit the final zoom state
            if (dragZoomRafId.current) {
                cancelAnimationFrame(dragZoomRafId.current);
                dragZoomRafId.current = null;
            }
            // Update React State with final values
            // Update React State with final values
            setScale(visualTransformRef.current.scale);
            setPosition({ x: visualTransformRef.current.x, y: visualTransformRef.current.y });

            // Sync Refs
            scaleRef.current = visualTransformRef.current.scale;
            positionRef.current = { x: visualTransformRef.current.x, y: visualTransformRef.current.y };

            // Clean up transforms
            if (fixedLayerContainerRef.current) fixedLayerContainerRef.current.style.transform = '';
        }
        if (isOpacityDragging) {
            setOpacityDragEndTime(Date.now());
            setIsOpacityDragging(false);
        }

        if (isZooming) {
            setZoomEndTime(Date.now());
            // Commit the visual transform to React state
            setScale(visualTransformRef.current.scale);
            setPosition({ x: visualTransformRef.current.x, y: visualTransformRef.current.y });
            setIsZooming(false);
        }

        // Check if window was actually dragged
        if (windowDragStartPos) {
            const dx = e.screenX - windowDragStartPos.x;
            const dy = e.screenY - windowDragStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (isWindowDragging || distance > 5) {
                // Window was dragged
                if (isWindowDragging && window.electronAPI?.endWindowMove) {
                    window.electronAPI.endWindowMove();
                }
                // Record the time when window drag ended to prevent immediate context menu
                setWindowDragEndTime(Date.now());
            }
        }

        setIsWindowDragging(false);
        setWindowDragStartPos(null);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        // Don't show context menu if panning, window is being dragged, zooming, or adjusting opacity
        if (isPanning || isWindowDragging || isZooming || isOpacityDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Don't show context menu immediately after pan, zoom, or opacity drag (within 300ms)
        const timeSincePan = Date.now() - panEndTime;
        const timeSinceZoom = Date.now() - zoomEndTime;
        const timeSinceOpacityDrag = Date.now() - opacityDragEndTime;
        if ((timeSincePan < 300 && panEndTime > 0) ||
            (timeSinceZoom < 300 && zoomEndTime > 0) ||
            (timeSinceOpacityDrag < 300 && opacityDragEndTime > 0)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Don't show context menu immediately after window drag ends (within 200ms)
        const timeSinceDragEnd = Date.now() - windowDragEndTime;
        if (timeSinceDragEnd < 200 && windowDragEndTime > 0) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // MOVED: Check if the event target is an item AFTER drag state checks
        // Now it's safe to let items handle their own context menu
        const target = e.target as HTMLElement;
        if (target.closest('[data-item-id]') || target.closest('.group') || target.closest('img') || target.closest('video') || target.closest('[class*="MediaItem"]') || target.closest('[class*="TextItem"]')) {
            // Let the item handle its own context menu
            return;
        }

        // If window drag was started but not actually dragged (moved less than 5px), allow context menu
        if (windowDragStartPos) {
            const dx = e.screenX - windowDragStartPos.x;
            const dy = e.screenY - windowDragStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If moved less than 5 pixels, allow context menu
            if (distance < 5) {
                // Allow context menu to show
            } else {
                // Moved too much, prevent context menu
                e.preventDefault();
                return;
            }
        }

        e.preventDefault();

        // Only show context menu if clicking on canvas background
        const isCanvasBackground = target === e.currentTarget ||
            target.classList.contains('canvas-content') ||
            target.tagName.toLowerCase() === 'svg';

        if (isCanvasBackground && onContextMenu) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                const canvasX = (e.clientX - canvasRect.left - position.x) / scale;
                const canvasY = (e.clientY - canvasRect.top - position.y) / scale;
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onContextMenu(extendedEvent);
            } else {
                onContextMenu(e);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onCanvasDrop) {
            const canvasRect = containerRef.current?.getBoundingClientRect();
            if (canvasRect) {
                const canvasX = (e.clientX - canvasRect.left - position.x) / scale;
                const canvasY = (e.clientY - canvasRect.top - position.y) / scale;
                const extendedEvent = Object.assign(e, { canvasX, canvasY });
                onCanvasDrop(extendedEvent);
            } else {
                onCanvasDrop(e);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    };

    const selectionBoxStyle = {
        left: Math.min(selectionStart.x, selectionEnd.x) * scale + position.x,
        top: Math.min(selectionStart.y, selectionEnd.y) * scale + position.y,
        width: Math.abs(selectionEnd.x - selectionStart.x) * scale,
        height: Math.abs(selectionEnd.y - selectionStart.y) * scale
    };

    // Calculate brush cursor size in screen pixels
    const brushCursorSize = brushSize * scale;

    // 배경색: opacity가 1.0 (100%)일 때만 표시, 99% 이하일 때는 완전히 투명하게
    // 이미지와 UI는 설정된 opacity 값을 유지하지만, 배경만 별도로 처리
    // opacity < 1.0이면 배경을 완전히 투명하게


    // Minimap Navigation Handlers
    const handleMinimapNavigate = useCallback((worldX: number, worldY: number) => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();

        // We want to center the viewport at (worldX, worldY)
        // ScreenPos = WorldPos * Scale + Translation
        // Translation = ScreenPos - WorldPos * Scale
        // We want WorldPos (worldX, worldY) to be at ScreenPos (width/2, height/2)

        const newX = (width / 2) - (worldX * scale);
        const newY = (height / 2) - (worldY * scale);

        // FIX: Force immediate visual update to prevent desync
        positionRef.current = { x: newX, y: newY };
        visualTransformRef.current = { x: newX, y: newY, scale: scale };

        // Apply to DOM immediately
        const transform = `translate3d(${newX}px, ${newY}px, 0) scale(${scale})`;
        if (canvasContentRef.current) {
            canvasContentRef.current.style.transform = transform;
        }
        if (fixedLayerContainerRef.current) {
            fixedLayerContainerRef.current.style.transform = transform;
        }

        // Sync DrawingLayer if needed
        onVisualUpdate?.();

        setPosition({ x: newX, y: newY });
    }, [scale, onVisualUpdate]);



    return (
        <div
            ref={containerRef}
            className={`canvas-container w-full h-full overflow-hidden bg-[#1e1e1e] relative touch-none select-none ${isPanning ? 'cursor-grabbing' :
                isWindowDragging ? 'cursor-move' :
                    isOpacityDragging ? 'cursor-ns-resize' :
                        pressedKeys.has('ALT') || pressedKeys.has(' ') ? 'cursor-grab' : 'cursor-default'
                }`}
            style={{ '--canvas-scale': scale } as React.CSSProperties}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onPointerMove={(e) => {
                // Use pointer events for pressure-sensitive devices
                // Only allow move if left button is pressed (buttons & 1)
                if ((activeTool === 'pen' || activeTool === 'eraser') && (e.buttons & 1) && onCanvasMouseMove) {
                    const canvasRect = containerRef.current?.getBoundingClientRect();
                    if (canvasRect) {
                        const getCanvasPoint = (clientX: number, clientY: number, pressure: number) => ({
                            x: (clientX - canvasRect.left - position.x) / scale,
                            y: (clientY - canvasRect.top - position.y) / scale,
                            pressure: pressure || 0.5
                        });

                        // Get coalesced events for high-frequency input (smoother curves)
                        // Note: getCoalescedEvents is on the native event
                        const nativeEvent = e.nativeEvent as PointerEvent;
                        const coalescedEvents = nativeEvent.getCoalescedEvents ? nativeEvent.getCoalescedEvents() : [];

                        let coalescedPoints: { x: number; y: number; pressure: number }[] = [];

                        if (coalescedEvents.length > 0) {
                            coalescedPoints = coalescedEvents.map(ce => getCanvasPoint(ce.clientX, ce.clientY, ce.pressure));
                        } else {
                            // Fallback if no coalesced events
                            coalescedPoints.push(getCanvasPoint(e.clientX, e.clientY, e.pressure));
                        }

                        // Use the last point for the main event properties
                        const lastPoint = coalescedPoints[coalescedPoints.length - 1];

                        const extendedEvent = Object.assign(e, {
                            canvasX: lastPoint.x,
                            canvasY: lastPoint.y,
                            pressure: lastPoint.pressure,
                            coalescedPoints
                        });
                        onCanvasMouseMove(extendedEvent as any);
                    }
                }
            }}
            onPointerUp={(e) => {
                // Use pointer events for pressure-sensitive devices
                if ((activeTool === 'pen' || activeTool === 'eraser') && onCanvasMouseUp) {
                    const canvasRect = containerRef.current?.getBoundingClientRect();
                    if (canvasRect) {
                        const canvasX = (e.clientX - canvasRect.left - position.x) / scale;
                        const canvasY = (e.clientY - canvasRect.top - position.y) / scale;
                        const pressure = e.pressure || 0.5; // Default to 0.5 if not available
                        const extendedEvent = Object.assign(e, { canvasX, canvasY, pressure });
                        onCanvasMouseUp(extendedEvent as any);
                    }
                }
            }}
            onContextMenuCapture={handleContextMenu}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <CanvasContext.Provider value={{ scale, position, isSelecting, scaleRef, positionRef }}>
                <CanvasRefContext.Provider value={canvasRefsValue}>
                    {/* Brush cursor indicator */}
                    {
                        (activeTool === 'pen' || activeTool === 'eraser') && (
                            <div
                                className="absolute pointer-events-none z-[10001]"
                                style={{
                                    left: `${mousePos.x}px`,
                                    top: `${mousePos.y}px`,
                                    width: `${brushCursorSize}px`,
                                    height: `${brushCursorSize}px`,
                                    borderRadius: '50%',
                                    border: `2px solid ${isEraser ? '#ef4444' : '#ffffff'}`,
                                    backgroundColor: isEraser ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                    transform: 'translate(-50%, -50%)',
                                    transition: 'none'
                                }}
                            />
                        )
                    }

                    {/* Simple Solid Background - Fixed to viewport */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            zIndex: 0,
                            backgroundColor: uiSettings.canvasBackgroundColor,
                            opacity: 1
                        }}
                    />


                    <div
                        ref={(el) => {
                            if (el && !canvasContentRef.current) {
                                canvasContentRef.current = el;
                                // Set initial transform via DOM
                                el.style.transform = `translate3d(${visualTransformRef.current.x}px, ${visualTransformRef.current.y}px, 0) scale(${visualTransformRef.current.scale})`;
                            }
                        }}
                        className="absolute origin-top-left canvas-content"
                        style={{
                            // CRITICAL FIX: Do NOT set transform here - it's managed via direct DOM manipulation
                            // to prevent React re-renders from causing flickering during zoom
                            transformOrigin: '0 0',
                            width: '100%',
                            height: '100%',
                            zIndex: 1 // Ensure canvas-content (with TextItem) renders above fixedLayer (Canvas)
                        }}
                    >

                        <Assence />
                        {children}
                    </div>

                    {
                        isSelecting && (
                            <div
                                className="absolute pointer-events-none z-[10000]"
                                style={{
                                    ...selectionBoxStyle,
                                    border: '2px solid rgba(96, 165, 250, 0.9)', // Solid Blue
                                    backgroundColor: 'rgba(96, 165, 250, 0.2)'  // Translucent Blue
                                }}
                            />
                        )
                    }


                    {/* Status Overlay */}
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-medium tracking-wide pointer-events-none z-[50] border border-white/10 flex items-center gap-2">
                        <span className="opacity-60">ZOOM</span>
                        <span className="text-blue-400">{Math.round(scale * 100)}%</span>
                        <span className="w-px h-2 bg-white/20 mx-1" />
                        <span className="opacity-60">PAN</span>
                        <span className="text-gray-300">X:{Math.round(position.x)}, Y:{Math.round(position.y)}</span>
                        <span className="w-px h-2 bg-white/20 mx-1" />
                        <span className="opacity-60">ITEMS</span>
                        <span>{items.length}</span>
                    </div>

                    {/* Minimap rendering */}
                    {isUiVisible && (
                        <Minimap
                            items={items}
                            viewport={{
                                x: position.x,
                                y: position.y,
                                scale: scale,
                                width: containerDimensions.width,
                                height: containerDimensions.height
                            }}
                            onNavigate={handleMinimapNavigate}
                            visualRef={visualTransformRef}
                        />
                    )}


                    {/* Fixed Layer (CanvasItemLayer) - Renders in screen coordinates */}
                    {/* Wrap in container for CSS transform optimization */}
                    <div ref={fixedLayerContainerRef} className="absolute inset-0 pointer-events-none origin-top-left">
                        {fixedLayer}
                    </div>
                </CanvasRefContext.Provider>
            </CanvasContext.Provider>
        </div >
    );


};
