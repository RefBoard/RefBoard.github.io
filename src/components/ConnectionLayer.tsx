import React, { useRef, useImperativeHandle, forwardRef } from 'react';

export interface Connection {
    id: string;
    fromNodeId: string;
    fromSocketId: string;
    toNodeId: string;
    toSocketId: string;
}

export interface ConnectionLayerRef {
    updateTracker: (id: string, x: number, y: number) => void;
    removeTracker: (id: string) => void;
}

interface ConnectionLayerProps {
    connections: Connection[];
    getItemPosition: (id: string, socketId: string) => { x: number; y: number } | null;
    tempConnection: { fromNodeId: string; fromSocketId: string; toPoint: { x: number; y: number } } | null;
    onConnectionContextMenu?: (id: string, e: React.MouseEvent) => void;
    items: any[];
    activeGenerationNodeIds?: string[];
    hoveredSocket?: { nodeId: string; socketId: string } | null;
}

const ConnectionLayer = forwardRef<ConnectionLayerRef, ConnectionLayerProps>(({
    connections,
    getItemPosition: _originalGetItemPosition,
    tempConnection,
    onConnectionContextMenu,
    items,
    activeGenerationNodeIds = [],
    hoveredSocket
}, ref) => {
    const ghostPositionsRef = useRef<Record<string, { x: number, y: number }>>({});

    const calculateBezierPath = (x1: number, y1: number, x2: number, y2: number, startType?: string, endType?: string) => {
        const dist = Math.abs(x2 - x1) * 0.5;
        const offset = Math.max(dist, 50);

        // Start direction: Output goes right (+1), Input goes left (-1)
        let startDir = 1;
        if (startType && (startType.includes('input') || startType.includes('Input'))) {
            startDir = -1;
        }

        // End direction: Output arrives from right (+1), Input arrives from left (-1)
        // Default to the opposite of startDir (if starting from input, target is likely output and vice versa)
        let endDir = startDir === -1 ? 1 : -1;
        if (endType) {
            // If ending at an output socket, arrive from the right
            if (endType.includes('output') || endType.includes('Output') ||
                endType === 'text-output' || endType === 'image-output') {
                endDir = 1;
            } else if (endType.includes('input') || endType.includes('Input') ||
                endType === 'text-input' || endType === 'image-input') {
                // If ending at an input socket, arrive from the left
                endDir = -1;
            }
        }

        const cp1x = x1 + (offset * startDir);
        const cp1y = y1;
        const cp2x = x2 + (offset * endDir);
        const cp2y = y2;
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2} `;
    };

    const getItemStartPos = (id: string) => {
        if (ghostPositionsRef.current[id]) {
            const item = items.find(i => i.id === id);
            if (!item) return { x: ghostPositionsRef.current[id].x, y: ghostPositionsRef.current[id].y, width: 200, height: 200, type: 'unknown' };
            return { ...item, x: ghostPositionsRef.current[id].x, y: ghostPositionsRef.current[id].y };
        }
        return items.find(i => i.id === id);
    };

    const getLocalSocketPosition = (id: string, socketId: string) => {
        const item = getItemStartPos(id);
        if (!item) return null;

        // w-12 h-12 container (48px), visual w-8 h-8 (32px) centered inside
        // So the CENTER is at 24px from the edge
        const xOffset = 24;

        if (item.type === 'generation_node') {
            if (socketId === 'output' || socketId === 'image-output') {
                // top-4: 16px from top, + 24px to center = 40px
                return {
                    x: item.x + item.width + xOffset,
                    y: item.y + 40
                };
            } else if (socketId === 'text-input') {
                // bottom-4: 16px from bottom, + 24px to center = 40px from bottom
                return {
                    x: item.x - xOffset,
                    y: item.y + item.height - 40
                };
            } else if (socketId === 'image-input') {
                // bottom-16: 64px from bottom, + 24px to center = 88px from bottom
                return {
                    x: item.x - xOffset,
                    y: item.y + item.height - 88
                };
            }
        } else if (item.type === 'prompt_node') {
            if (socketId === 'output' || socketId === 'text-output') {
                return {
                    x: item.x + item.width + xOffset,
                    y: item.y + 40
                };
            }
        }

        if (socketId === 'output' || socketId === 'image-output') {
            // MediaItem sockets: w-8 h-8 (32px), positioned at -right-12 top-4
            // Center at (x + width + 48 - 16, y + 16 + 16) = (x + width + 32, y + 32)
            return {
                x: item.x + item.width + 32,
                y: item.y + 32
            };
        } else if (socketId === 'image-input') {
            // MediaItem sockets: w-8 h-8 (32px), positioned at -left-12 top-4
            // Center at (x - 48 + 16, y + 16 + 16) = (x - 32, y + 32)
            return {
                x: item.x - 32,
                y: item.y + 32
            };
        } else if (socketId && socketId.startsWith('input')) {
            return {
                x: item.x - xOffset,
                y: item.y + (item.height / 2)
            };
        }

        return { x: item.x, y: item.y };
    };

    useImperativeHandle(ref, () => ({
        updateTracker: (id: string, x: number, y: number) => {
            ghostPositionsRef.current[id] = { x, y };
            const relevantConnections = connections.filter(c => c.fromNodeId === id || c.toNodeId === id);
            relevantConnections.forEach(conn => {
                const startPos = getLocalSocketPosition(conn.fromNodeId, conn.fromSocketId);
                const endPos = getLocalSocketPosition(conn.toNodeId, conn.toSocketId);
                if (startPos && endPos) {
                    const newPath = calculateBezierPath(
                        startPos.x, startPos.y,
                        endPos.x, endPos.y,
                        conn.fromSocketId, conn.toSocketId
                    );
                    const mainPath = document.getElementById(`conn-path-${conn.id}`);
                    if (mainPath) mainPath.setAttribute('d', newPath);
                    const bgPath = document.getElementById(`conn-bg-${conn.id}`);
                    if (bgPath) bgPath.setAttribute('d', newPath);
                    const flowPath = document.getElementById(`conn-flow-${conn.id}`);
                    if (flowPath) flowPath.setAttribute('d', newPath);
                }
            });
        },
        removeTracker: (id: string) => {
            delete ghostPositionsRef.current[id];
        }
    }));

    const getLineColor = (toSocketId?: string, fromSocketId?: string, toNodeId?: string) => {
        // Check for image-to-image connection
        if (fromSocketId === 'image-output' && toSocketId === 'image-input') {
            const targetNode = items.find(i => i.id === toNodeId);
            // If target is a generation node, it's a "Generation Reference" (Indigo)
            if (targetNode?.type === 'generation_node') {
                return "#6366f1"; // Indigo
            }
            // Otherwise it's a "Visual/Canvas Reference" (Yellow)
            return "#eab308"; // Yellow
        }

        if (toSocketId === 'text-input' || toSocketId === 'text-output') {
            return "#10b981"; // Green for text
        } else if (toSocketId === 'image-input' || toSocketId === 'image-output') {
            return "#6366f1"; // Indigo for image generation
        }
        return "#60a5fa"; // Blue default
    };

    const renderBezierLine = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        key: string,
        isTemp: boolean = false,
        toSocketId?: string,
        isFlowing: boolean = false,
        fromSocketId?: string,
        toNodeId?: string
    ) => {
        const pathData = calculateBezierPath(x1, y1, x2, y2, fromSocketId, toSocketId);
        const lineColor = isTemp ? "#3b82f6" : getLineColor(toSocketId, fromSocketId, toNodeId);

        return (
            <g key={key}>
                {!isTemp && (
                    <path
                        id={`conn-bg-${key}`}
                        d={pathData}
                        stroke="transparent"
                        fill="none"
                        style={{
                            strokeWidth: 'calc(15px / var(--canvas-scale, 1))',
                            pointerEvents: 'stroke',
                            cursor: 'context-menu'
                        }}
                        onContextMenu={(e) => {
                            if (onConnectionContextMenu) {
                                e.preventDefault();
                                e.stopPropagation();
                                onConnectionContextMenu(key, e);
                            }
                        }}
                    />
                )}

                <path
                    id={`conn-path-${key}`}
                    d={pathData}
                    stroke={lineColor}
                    strokeDasharray={isTemp ? "5,5" : "none"}
                    fill="none"
                    style={{
                        strokeWidth: isTemp ? 'calc(2px / var(--canvas-scale, 1))' : 'calc(3px / var(--canvas-scale, 1))',
                        pointerEvents: 'none',
                        opacity: isFlowing ? 0.3 : 1
                    }}
                />

                {isFlowing && (
                    <>
                        {/* Shooting Star Effect - Multi-Speed Light Packets */}
                        {[0, 1, 2].map((i) => {
                            // Stable random values per packet
                            const seed = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + i * 999;
                            const duration = 1.0 + (seed % 150) / 100; // 1.0s - 2.5s (Variable Speed)
                            const delay = -((seed * 17) % 300) / 100;  // Random start time

                            // Packet Lengths
                            const headLen = 40 + (seed % 30); // 40-70px
                            const tailLen = 150 + (seed % 50); // 150-200px
                            const gapLen = 600 + (seed % 200); // Distance between repeats
                            const cycleLen = headLen + gapLen;

                            return (
                                <React.Fragment key={i}>
                                    {/* Tail (Gradient Glow) */}
                                    <path
                                        d={pathData}
                                        stroke="url(#conn-led-gradient)"
                                        strokeWidth={6}
                                        fill="none"
                                        strokeDasharray={`${tailLen} ${gapLen}`}
                                        strokeLinecap="round"
                                        style={{
                                            opacity: 0.6,
                                            pointerEvents: 'none',
                                            filter: 'blur(4px)'
                                        }}
                                    >
                                        <animate
                                            attributeName="stroke-dashoffset"
                                            from={cycleLen}
                                            to="0"
                                            dur={`${duration}s`}
                                            begin={`${delay}s`}
                                            repeatCount="indefinite"
                                        />
                                    </path>

                                    {/* Head (White Core) */}
                                    <path
                                        d={pathData}
                                        stroke="#ffffff"
                                        strokeWidth={3}
                                        fill="none"
                                        strokeDasharray={`${headLen} ${gapLen}`}
                                        strokeLinecap="round"
                                        style={{
                                            opacity: 1,
                                            pointerEvents: 'none',
                                            filter: 'drop-shadow(0 0 2px white)'
                                        }}
                                    >
                                        <animate
                                            attributeName="stroke-dashoffset"
                                            from={cycleLen}
                                            to="0"
                                            dur={`${duration}s`}
                                            begin={`${delay}s`}
                                            repeatCount="indefinite"
                                        />
                                    </path>
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </g>
        );
    };

    return (
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', zIndex: 15, overflow: 'visible' }}>
            <defs>
                {/* Global Gradient for Connections (Green-Cyan-Indigo) */}
                <linearGradient id="conn-led-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
            </defs>

            {connections.map(conn => {
                const startPos = getLocalSocketPosition(conn.fromNodeId, conn.fromSocketId);
                const endPos = getLocalSocketPosition(conn.toNodeId, conn.toSocketId);
                const isFlowing = activeGenerationNodeIds.includes(conn.toNodeId);

                if (startPos && endPos) {
                    return renderBezierLine(
                        startPos.x,
                        startPos.y,
                        endPos.x,
                        endPos.y,
                        conn.id,
                        false,
                        conn.toSocketId,
                        isFlowing,
                        conn.fromSocketId,
                        conn.toNodeId
                    );
                }
                return null;
            })}

            {tempConnection && (() => {
                const startPos = getLocalSocketPosition(tempConnection.fromNodeId, tempConnection.fromSocketId);

                let endX = tempConnection.toPoint.x;
                let endY = tempConnection.toPoint.y;
                let endSocketType = undefined;
                let connectionColor = "#3b82f6"; // Default blue

                if (hoveredSocket) {
                    const snapPos = getLocalSocketPosition(hoveredSocket.nodeId, hoveredSocket.socketId);
                    if (snapPos) {
                        endX = snapPos.x;
                        endY = snapPos.y;
                        endSocketType = hoveredSocket.socketId;

                        // Validate connection type
                        const fromType = tempConnection.fromSocketId;
                        const toType = hoveredSocket.socketId;
                        let isValid = false;

                        // Check type compatibility
                        if (fromType === 'text-output' && toType === 'text-input') {
                            isValid = true;
                        } else if (fromType === 'image-output' && toType === 'image-input') {
                            isValid = true;
                        }

                        // Check not connecting to self
                        if (tempConnection.fromNodeId === hoveredSocket.nodeId) {
                            isValid = false;
                        }

                        // Set color based on validity
                        connectionColor = isValid ? "#22c55e" : "#ef4444"; // Green or Red
                    }
                }

                if (startPos) {
                    const pathData = calculateBezierPath(
                        startPos.x,
                        startPos.y,
                        endX,
                        endY,
                        tempConnection.fromSocketId,
                        endSocketType
                    );

                    return (
                        <g key="temp">
                            <path
                                d={pathData}
                                stroke={connectionColor}
                                strokeDasharray="5,5"
                                fill="none"
                                style={{
                                    strokeWidth: 'calc(3px / var(--canvas-scale, 1))',
                                    pointerEvents: 'none'
                                }}
                            />
                        </g>
                    );
                }
                return null;
            })()}
        </svg>
    );
});

export default React.memo(ConnectionLayer, (prevProps, nextProps) => {
    const prevConns = Array.isArray(prevProps.connections) ? prevProps.connections : [];
    const nextConns = Array.isArray(nextProps.connections) ? nextProps.connections : [];

    if (prevConns.length !== nextConns.length) return false;
    if (prevConns.some((conn, i) => conn.id !== nextConns[i]?.id)) return false;
    if (prevProps.items.length !== nextProps.items.length) return false;
    if (prevProps.items !== nextProps.items) return false;
    if (prevProps.tempConnection?.fromNodeId !== nextProps.tempConnection?.fromNodeId) return false;
    if (prevProps.tempConnection?.toPoint.x !== nextProps.tempConnection?.toPoint.x) return false;
    if (prevProps.tempConnection?.toPoint.y !== nextProps.tempConnection?.toPoint.y) return false;
    if (prevProps.hoveredSocket !== nextProps.hoveredSocket) return false;
    if (JSON.stringify(prevProps.activeGenerationNodeIds) !== JSON.stringify(nextProps.activeGenerationNodeIds)) return false;
    return true;
});
