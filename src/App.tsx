import React, { useState, useCallback, useEffect, useRef } from 'react';
import ConnectionLayer, { Connection, ConnectionLayerRef } from './components/ConnectionLayer';
import ArrowLayer, { ArrowLayerRef } from './components/ArrowLayer'; // Optimization: Imperative Arrow Layer
import CanvasItemLayer, { CanvasItemLayerRef } from './components/CanvasItemLayer';
import { Canvas } from './components/Canvas';
import { MediaItem, MediaItemData } from './components/MediaItem';
import { GroupBox, GroupData } from './components/GroupBox';
import { TextItem, TextItemData } from './components/TextItem';
import { ArrowData } from './components/Arrow';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { SettingsModal, ShortcutSettings, UISettings } from './components/SettingsModal';
import { PenSettingsBar } from './components/PenSettingsBar';

import { DrawingLayer, DrawingPath } from './components/DrawingLayer';
import { LoginScreen } from './components/LoginScreen';
import { BoardListScreen } from './components/BoardListScreen';
import { ShareDialog } from './components/ShareDialog';
import { CollaboratorCursors } from './components/CollaboratorCursors';
import { TitleBar } from './components/TitleBar';
import { LandingPage } from './components/LandingPage';
import { generateContent } from './services/gemini';
import { unregisterBoardInteraction, registerBoardInteraction } from './services/boardInteractions';
// import { registerBlob, unregisterBlob } from './utils/blobRegistry';
import {
    updateCursor,
    subscribeToCursors,
    setPresence,
    removePresence,
    CursorPosition,
    subscribeToBoardData,
    updateRemoteItem,
    updateRemoteItems,
    deleteRemoteItem,
    updateRemoteData,
    syncBoardToFirebase
} from './services/collaboration';
import { useGroups } from './hooks/useGroups';
import { useArrows } from './hooks/useArrows';
import { useKeyboard } from './hooks/useKeyboard';
import { BookmarkPanel, Bookmark } from './components/BookmarkPanel';
import { DrawingLayerRef } from './components/DrawingLayer';
import { SelectionBoundingBox, SelectionBounds } from './components/SelectionBoundingBox';

import { onAuthChange, AuthUser, refreshAuthToken, onTokenChange, getCurrentUser } from './services/firebaseAuth';
import { saveBoardToDrive, loadBoardFromDrive, uploadImageToDrive, loadImageFromDrive, uploadOrUpdateImageInDrive, uploadOrUpdateMediaInDrive, deleteImageFromDrive, getFileMetadata } from './services/googleDrive';
import { findOrphanFiles, cleanupFiles } from './services/cleanup';
import { loadGoogleFont, getCustomFonts, addCustomFont, autoLoadBoardFonts } from './utils/fontLoader';
import { searchFonts } from './utils/googleFontsList';
import html2canvas from 'html2canvas';

const isShortcutMatch = (e: KeyboardEvent, combo: string): boolean => {
    if (!combo) return false;
    const parts = combo.split('+').map(p => p.trim());

    const requiredModifiers = new Set<string>();
    let triggerKey = '';

    parts.forEach(part => {
        const upperPart = part.toUpperCase();
        if (['CTRL', 'ALT', 'SHIFT', 'META'].includes(upperPart)) {
            requiredModifiers.add(upperPart);
        } else {
            triggerKey = part; // Keep original case for special characters like [ and ]
        }
    });

    // Compare keys directly (special characters like [ and ] are case-sensitive)
    if (e.key !== triggerKey && e.key.toUpperCase() !== triggerKey.toUpperCase()) return false;

    const hasCtrl = e.ctrlKey || e.metaKey;
    if (hasCtrl !== requiredModifiers.has('CTRL') && hasCtrl !== requiredModifiers.has('META')) {
        // Handle META/CTRL equivalence or strictness? 
        // Let's rely on checking if either matches if looking for CTRL?
        // Simpler: Check if e.ctrlKey matches required CTRL.

        if (requiredModifiers.has('CTRL')) {
            if (!e.ctrlKey && !e.metaKey) return false;
        } else {
            if (e.ctrlKey || e.metaKey) return false;
        }
    }

    if (e.altKey !== requiredModifiers.has('ALT')) return false;
    if (e.shiftKey !== requiredModifiers.has('SHIFT')) return false;

    return true;
};

type BoardItem = MediaItemData | TextItemData;





function App() {
    // Authentication state
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [isExiting, setIsExiting] = useState(false); // Track exit process for UI feedback

    // AdSense: Show Landing Page for default web visitors
    const [showLanding, setShowLanding] = useState(() => {
        const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');
        const params = new URLSearchParams(window.location.search);
        // Only show landing on root web visit without boardId
        return !isElectron && !params.has('boardId');
    });

    // Board state - start with null to show board list
    const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
    const [boardName, setBoardName] = useState('Untitled Board');
    const [driveFileId, setDriveFileId] = useState<string | null>(null);

    const [items, setItems] = useState<BoardItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTool, setActiveTool] = useState<'select' | 'text' | 'arrow' | 'pen' | 'eraser'>('select');
    const [isUiVisible, setIsUiVisible] = useState(true); // Toggle UI visibility

    // Font State
    const [showFontModal, setShowFontModal] = useState(false);
    const [newFontName, setNewFontName] = useState('');
    const [customFonts, setCustomFonts] = useState<Array<{ name: string, value: string }>>([]);
    const [fontLoadingState, setFontLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [fontErrorMessage, setFontErrorMessage] = useState('');
    const [fontSuggestions, setFontSuggestions] = useState<string[]>([]);
    const [selectedFontFromList, setSelectedFontFromList] = useState<string>('');

    // Handle Deep Linking (Bookmarks)
    // Load custom fonts on mount

    // Load custom fonts on mount
    useEffect(() => {
        setCustomFonts(getCustomFonts());
    }, []);

    // Auto-load fonts used in the board
    useEffect(() => {
        autoLoadBoardFonts(items);
    }, [items]);

    // Socket hover state for connection snapping
    const [hoveredSocket, setHoveredSocket] = useState<{ nodeId: string; socketId: string } | null>(null);

    const handleSocketMouseEnter = (nodeId: string, socketId: string) => {
        setHoveredSocket({ nodeId, socketId });
    };

    const handleSocketMouseLeave = () => {
        setHoveredSocket(null);
    };
    const [penSettings, setPenSettings] = useState({ color: '#ffffff', size: 5, eraserSize: 10 });
    const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
    const [clipboard, setClipboard] = useState<BoardItem[]>([]);
    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
    const drawingLayerRef = useRef<DrawingLayerRef>(null);

    // Multi-selection bounding box state
    const [multiSelectionBounds, setMultiSelectionBounds] = useState<{
        x: number; y: number; width: number; height: number
    } | null>(null);

    // Bookmarks state
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [navigateTo, setNavigateTo] = useState<{ x: number; y: number } | null>(null);

    // Node System State
    const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set());
    const [connections, setConnections] = useState<Connection[]>([]);
    const [tempConnection, setTempConnection] = useState<{ fromNodeId: string; fromSocketId: string; toPoint: { x: number; y: number } } | null>(null);



    // Calculate socket position based on item coordinates
    // Match CSS positioning from GenerationNode/PromptNode/MediaItem
    // Sockets are w-12 h-12 (48x48px), so radius is 24px.
    const getNodeSocketPosition = (id: string, socketId: string) => {
        const item = items.find(i => i.id === id);
        if (!item) return null;

        const SOCKET_OFFSET_X = 24; // Center of the 48px socket sticking out (starts at 0 or width)

        if (item.type === 'generation_node') {
            if (socketId === 'image-output') {
                return {
                    x: item.x + item.width + SOCKET_OFFSET_X,
                    y: item.y + 40
                };
            } else if (socketId === 'text-input') {
                return {
                    x: item.x - SOCKET_OFFSET_X,
                    y: item.y + item.height - 40
                };
            } else if (socketId === 'image-input') {
                return {
                    x: item.x - SOCKET_OFFSET_X,
                    y: item.y + item.height - 88
                };
            }
        } else if (item.type === 'prompt_node') {
            if (socketId === 'text-output') {
                return {
                    x: item.x + item.width + SOCKET_OFFSET_X,
                    y: item.y + 40
                };
            }
        } else if (item.type === 'image') {
            // MediaItem sockets: w-8 h-8 (32px), positioned at:
            // - Input: -left-12 top-4 → center at (x - 48 + 16, y + 16 + 16) = (x - 32, y + 32)
            // - Output: -right-12 top-4 → center at (x + width + 48 - 16, y + 16 + 16) = (x + width + 32, y + 32)

            if (socketId === 'image-input') {
                return {
                    x: item.x - 32,
                    y: item.y + 32
                };
            } else if (socketId === 'image-output') {
                return {
                    x: item.x + item.width + 32,
                    y: item.y + 32
                };
            }
        }
        return null;
    };

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Collaboration state
    const [collaboratorCursors, setCollaboratorCursors] = useState<CursorPosition[]>([]);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [settings, setSettings] = useState<ShortcutSettings>({
        pan: { keys: [], button: 'Middle' }, // 미들마우스만으로 패닝
        zoom: { keys: ['Alt'], button: 'Right' },
        zoomWheelModifier: 'None',
        windowDrag: { keys: [], button: 'Right' },
        alwaysOnTop: 'CTRL+SHIFT+A',
        opacity: 'CTRL+ALT+O',
        opacityDrag: { keys: ['CTRL', 'ALT'], button: 'Right' },
        alignItems: 'CTRL+A'
    });
    const [uiSettings, setUiSettings] = useState<UISettings>({
        canvasBackgroundColor: '#1f1f1f',
        canvasBackgroundGradientColor: '#192024',
        dotPatternColor: '#999999'
    });
    const [opacity, setOpacity] = useState(1);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
    const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1, width: 0, height: 0 });

    // Refs for accessing latest state in intervals without resetting timers
    const itemsRef = useRef(items);
    const viewportRef = useRef(viewport);
    const currentBoardIdRef = useRef(currentBoardId);

    // Performance Refs (Imperative Updates)
    const arrowLayerRef = useRef<ArrowLayerRef>(null);
    const connectionLayerRef = useRef<ConnectionLayerRef>(null);
    const canvasItemLayerRef = useRef<CanvasItemLayerRef>(null);

    const opacityRef = useRef(opacity);
    const currentPathRef = useRef<DrawingPath | null>(null);
    const itemDragStartRef = useRef<Record<string, { x: number; y: number }>>({});
    const activeDragItemIdRef = useRef<string | null>(null); // For imperative drag tracking
    const rotationStartRef = useRef<{ startX: number; itemRotations: Record<string, number> } | null>(null);
    const scaleStartRef = useRef<{
        startX: number;
        itemDimensions: Record<string, { x: number; y: number; width: number; height: number }>;
        centerX: number;
        centerY: number;
    } | null>(null);

    // Track global mouse position for paste operations
    const lastMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => { opacityRef.current = opacity; }, [opacity]);
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { currentBoardIdRef.current = currentBoardId; }, [currentBoardId]);

    // Sync opacity to Electron window
    useEffect(() => {
        if (window.electronAPI?.setOpacity) {
            window.electronAPI.setOpacity(opacity);
        }
    }, [opacity]);

    const { groups, createGroup, updateGroup, updateGroupName, deleteGroup, addItemToGroup, removeItemFromGroup, getItemGroup, setGroups } = useGroups(currentBoardId);
    const { arrows, createArrow, deleteArrow, deleteArrowsForItem, setArrows } = useArrows(currentBoardId);

    // Real-time sync for connections (similar to arrows/groups)
    useEffect(() => {
        if (currentBoardId && currentBoardId !== 'new' && connections.length > 0) {
            // Sync connections to Firebase in real-time
            updateRemoteData(currentBoardId, 'connections', connections);
        }
    }, [connections, currentBoardId]);

    // Load connections when board loads
    useEffect(() => {
        if (currentBoardId && currentBoardId !== 'new') {
            const loadConnections = async () => {
                try {
                    const boardDoc = await getRemoteData(currentBoardId);
                    if (boardDoc?.connections) {
                        setConnections(boardDoc.connections);
                    } else {
                        setConnections([]);
                    }
                } catch (error) {
                    console.error('Failed to load connections:', error);
                    setConnections([]);
                }
            };
            loadConnections();
        } else {
            // Clear connections when no board is selected
            setConnections([]);
        }
    }, [currentBoardId]);

    const pressedKeys = useKeyboard();
    const [selectedArrowIds, setSelectedArrowIds] = useState<string[]>([]);
    // Reusing existing contextMenu variable but updating type to allow null for cleaner conditional rendering
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId?: string } | null>(null);
    const [groupFormatMenuGroupId, setGroupFormatMenuGroupId] = useState<string | null>(null);
    const [isGroupFontSizeDropdownOpen, setIsGroupFontSizeDropdownOpen] = useState(false);
    const [isGroupFontFamilyDropdownOpen, setIsGroupFontFamilyDropdownOpen] = useState(false);
    const [textFormatMenuTextId, setTextFormatMenuTextId] = useState<string | null>(null);
    const [isTextFontSizeDropdownOpen, setIsTextFontSizeDropdownOpen] = useState(false);
    const [isTextFontFamilyDropdownOpen, setIsTextFontFamilyDropdownOpen] = useState(false);

    // Track group drag start positions to maintain relative positions
    const groupDragStartRef = useRef<{ [groupId: string]: { groupX: number; groupY: number; items: { [itemId: string]: { x: number; y: number } } } }>({});
    const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);

    // Undo/Redo state
    const [history, setHistory] = useState<{ items: BoardItem[]; groups: GroupData[]; arrows: ArrowData[]; paths: DrawingPath[] }[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedoRef = useRef(false); // Prevent saving history during undo/redo
    const dragStartStateRef = useRef<{ items: BoardItem[]; groups: GroupData[]; arrows: ArrowData[]; paths: DrawingPath[] } | null>(null); // Store state at drag start
    const [newlyCreatedTextIds, setNewlyCreatedTextIds] = useState<Set<string>>(new Set());

    // Save state
    const [_isSaving, setIsSaving] = useState(false);
    const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
    const saveToHistory = useCallback(() => {
        if (isUndoRedoRef.current) return; // Don't save history during undo/redo

        const currentState = {
            items: JSON.parse(JSON.stringify(items)), // Deep clone
            groups: JSON.parse(JSON.stringify(groups)),
            arrows: JSON.parse(JSON.stringify(arrows)),
            paths: JSON.parse(JSON.stringify(paths))
        };

        setHistory(prev => {
            // Remove any history after current index (when undoing and then making new changes)
            const newHistory = prev.slice(0, historyIndex + 1);
            // Add new state
            newHistory.push(currentState);
            // Limit history to 50 states
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setHistoryIndex(prev => {
            const newIndex = prev + 1;
            // Limit index to match history length
            return Math.min(newIndex, 49);
        });
    }, [items, groups, arrows, paths, historyIndex]);

    const syncStateToFirebase = useCallback((state: any) => {
        if (!currentBoardId || currentBoardId === 'new') return;

        const itemsObj: any = {};
        state.items.forEach((item: any) => {
            itemsObj[item.id] = item;
        });

        const groupsObj: any = {};
        state.groups.forEach((group: any) => {
            groupsObj[group.id] = group;
        });

        const arrowsObj: any = {};
        state.arrows.forEach((arrow: any) => {
            arrowsObj[arrow.id] = arrow;
        });

        const pathsObj: any = {};
        state.paths.forEach((path: any) => {
            pathsObj[path.id] = path;
        });

        syncBoardToFirebase(currentBoardId, {
            items: itemsObj,
            groups: groupsObj,
            arrows: arrowsObj,
            paths: pathsObj,
            boardName // keep board name
        });
    }, [currentBoardId, boardName]);

    const handleUndo = useCallback(() => {
        if (historyIndex < 0 || history.length === 0) return;

        isUndoRedoRef.current = true;

        const previousState = history[historyIndex];
        if (previousState) {
            setItems(previousState.items);
            setGroups(previousState.groups);
            setArrows(previousState.arrows);
            setPaths(previousState.paths);
            setHistoryIndex(prev => prev - 1);

            // Sync formatted state to Firebase
            syncStateToFirebase(previousState);
        }

        setTimeout(() => {
            isUndoRedoRef.current = false;
        }, 0);
    }, [history, historyIndex, syncStateToFirebase]);

    // Redo function
    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        isUndoRedoRef.current = true;

        const nextState = history[historyIndex + 1];
        if (nextState) {
            setItems(nextState.items);
            setGroups(nextState.groups);
            setArrows(nextState.arrows);
            setPaths(nextState.paths);
            setHistoryIndex(prev => prev + 1);

            // Sync formatted state to Firebase
            syncStateToFirebase(nextState);
        }

        setTimeout(() => {
            isUndoRedoRef.current = false;
        }, 0);
    }, [history, historyIndex, syncStateToFirebase]);

    const handleInteractionStart = useCallback((_id: string) => {
        // Only save the BEFORE state once per interaction
        if (!dragStartStateRef.current) {
            const beforeState = {
                items: JSON.parse(JSON.stringify(itemsRef.current)),
                groups: JSON.parse(JSON.stringify(groups)),
                arrows: JSON.parse(JSON.stringify(arrows)),
                paths: JSON.parse(JSON.stringify(paths))
            };

            // Save BEFORE state to history immediately
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(beforeState);
                return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
            });
            setHistoryIndex(prev => Math.min(prev + 1, 49));

            // Mark that we're in an interaction
            dragStartStateRef.current = beforeState;
        }
    }, [groups, arrows, paths, historyIndex]);

    const handleInteractionEnd = useCallback((id: string) => {
        if (dragStartStateRef.current) {
            // Clear the interaction flag
            dragStartStateRef.current = null;
        }

        // Sync to Firebase (explicitly send the final state of the modified item)
        const item = itemsRef.current.find(i => i.id === id);
        if (item && currentBoardId && currentBoardId !== 'new') {
            updateRemoteItem(currentBoardId, id, item);
        }
    }, [currentBoardId]);

    // Calculate bounding box for multiple selected items
    const calculateMultiSelectionBounds = useCallback((itemIds: string[]): SelectionBounds | null => {
        if (itemIds.length <= 1) return null;

        const selectedItems = items.filter(i => itemIds.includes(i.id));
        if (selectedItems.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        selectedItems.forEach(item => {
            minX = Math.min(minX, item.x);
            minY = Math.min(minY, item.y);
            maxX = Math.max(maxX, item.x + item.width);
            maxY = Math.max(maxY, item.y + item.height);
        });

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }, [items]);

    // Update bounds when selection changes
    useEffect(() => {
        if (selectedIds.length > 1) {
            const bounds = calculateMultiSelectionBounds(selectedIds);
            setMultiSelectionBounds(bounds);
        } else {
            setMultiSelectionBounds(null);
        }
    }, [selectedIds, items, calculateMultiSelectionBounds]);

    // Multi-selection transform handlers
    const multiScaleStartStateRef = useRef<{ items: BoardItem[]; groups: GroupData[]; arrows: ArrowData[]; paths: DrawingPath[] } | null>(null);

    const handleMultiScaleStart = useCallback(() => {
        multiScaleStartStateRef.current = {
            items: JSON.parse(JSON.stringify(itemsRef.current)),
            groups: JSON.parse(JSON.stringify(groups)),
            arrows: JSON.parse(JSON.stringify(arrows)),
            paths: JSON.parse(JSON.stringify(paths))
        };
    }, [groups, arrows, paths]);

    const handleMultiScale = useCallback((scaleFactor: number, _corner: string) => {
        if (!multiSelectionBounds) return;

        const centerX = multiSelectionBounds.x + multiSelectionBounds.width / 2;
        const centerY = multiSelectionBounds.y + multiSelectionBounds.height / 2;

        setItems(prevItems => prevItems.map(item => {
            if (!selectedIds.includes(item.id)) return item;

            const newWidth = item.width * scaleFactor;
            const newHeight = item.height * scaleFactor;

            const offsetX = item.x - centerX;
            const offsetY = item.y - centerY;

            const newX = centerX + offsetX * scaleFactor;
            const newY = centerY + offsetY * scaleFactor;

            return { ...item, x: newX, y: newY, width: newWidth, height: newHeight };
        }));
    }, [multiSelectionBounds, selectedIds]);

    const handleMultiScaleEnd = useCallback(() => {
        if (multiScaleStartStateRef.current) {
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(multiScaleStartStateRef.current!);
                return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
            });
            setHistoryIndex(prev => Math.min(prev + 1, 49));
            multiScaleStartStateRef.current = null;
        }

        if (currentBoardId && currentBoardId !== 'new') {
            const scaledItems = items.filter(item => selectedIds.includes(item.id));
            if (scaledItems.length > 0) {
                updateRemoteItems(currentBoardId, scaledItems);
            }
        }
    }, [historyIndex, currentBoardId, items, selectedIds]);

    const multiRotationStartStateRef = useRef<{ items: BoardItem[]; groups: GroupData[]; arrows: ArrowData[]; paths: DrawingPath[] } | null>(null);

    const handleMultiRotationStart = useCallback(() => {
        multiRotationStartStateRef.current = {
            items: JSON.parse(JSON.stringify(itemsRef.current)),
            groups: JSON.parse(JSON.stringify(groups)),
            arrows: JSON.parse(JSON.stringify(arrows)),
            paths: JSON.parse(JSON.stringify(paths))
        };
    }, [groups, arrows, paths]);

    const handleMultiRotation = useCallback((deltaAngle: number) => {
        if (!multiSelectionBounds) return;

        const centerX = multiSelectionBounds.x + multiSelectionBounds.width / 2;
        const centerY = multiSelectionBounds.y + multiSelectionBounds.height / 2;
        const rad = deltaAngle * (Math.PI / 180);

        setItems(prevItems => prevItems.map(item => {
            if (!selectedIds.includes(item.id)) return item;

            const offsetX = item.x - centerX;
            const offsetY = item.y - centerY;

            const rotatedX = offsetX * Math.cos(rad) - offsetY * Math.sin(rad);
            const rotatedY = offsetX * Math.sin(rad) + offsetY * Math.cos(rad);

            const newX = centerX + rotatedX;
            const newY = centerY + rotatedY;

            const currentRotation = (item as any).rotation || 0;
            const newRotation = (currentRotation + deltaAngle + 360) % 360;

            return { ...item, x: newX, y: newY, rotation: newRotation };
        }));
    }, [multiSelectionBounds, selectedIds]);

    const handleMultiRotationEnd = useCallback(() => {
        if (multiRotationStartStateRef.current) {
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(multiRotationStartStateRef.current!);
                return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
            });
            setHistoryIndex(prev => Math.min(prev + 1, 49));
            multiRotationStartStateRef.current = null;
        }

        if (currentBoardId && currentBoardId !== 'new') {
            const rotatedItems = items.filter(item => selectedIds.includes(item.id));
            if (rotatedItems.length > 0) {
                updateRemoteItems(currentBoardId, rotatedItems);
            }
        }
    }, [historyIndex, currentBoardId, items, selectedIds]);

    // Align Selected Items (Grid Layout)
    const handleAlignSelectedItems = useCallback(() => {
        if (selectedIds.length < 2) return;

        const selectedItems = items.filter(item => selectedIds.includes(item.id));
        if (selectedItems.length < 2) return;

        // Save state for undo
        const beforeState = {
            items: JSON.parse(JSON.stringify(itemsRef.current)),
            groups: JSON.parse(JSON.stringify(groups)),
            arrows: JSON.parse(JSON.stringify(arrows)),
            paths: JSON.parse(JSON.stringify(paths))
        };

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(beforeState);
            return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));

        // Calculate grid dimensions
        const count = selectedItems.length;
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        // Sort items by position (top-left to bottom-right)
        const sortedItems = [...selectedItems].sort((a, b) => {
            const diffY = a.y - b.y;
            if (Math.abs(diffY) > 50) return diffY; // Major vertical difference
            return a.x - b.x; // Otherwise sort by X
        });

        // Determine max width for each column and max height for each row
        const colWidths = new Array(cols).fill(0);
        const rowHeights = new Array(rows).fill(0);

        sortedItems.forEach((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            colWidths[col] = Math.max(colWidths[col], item.width);
            rowHeights[row] = Math.max(rowHeights[row], item.height);
        });

        // Cell padding
        const GAP = 20;

        // Calculate cumulative offsets
        const colOffsets = new Array(cols).fill(0);
        const rowOffsets = new Array(rows).fill(0);

        for (let i = 1; i < cols; i++) {
            colOffsets[i] = colOffsets[i - 1] + colWidths[i - 1] + GAP;
        }
        for (let i = 1; i < rows; i++) {
            rowOffsets[i] = rowOffsets[i - 1] + rowHeights[i - 1] + GAP;
        }

        // Start position (top-left of first selected item)
        const startX = Math.min(...selectedItems.map(item => item.x));
        const startY = Math.min(...selectedItems.map(item => item.y));

        // Arrange items in grid with dynamic offsets
        const updatedItems = sortedItems.map((item, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);

            const newX = startX + colOffsets[col];
            const newY = startY + rowOffsets[row];

            return { ...item, x: newX, y: newY };
        });

        // Update items state
        setItems(prevItems => prevItems.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated || item;
        }));

        // Sync to Firebase
        if (currentBoardId && currentBoardId !== 'new') {
            updatedItems.forEach(item => {
                updateRemoteItem(currentBoardId, item.id, item);
            });
        }
    }, [selectedIds, items, groups, arrows, paths, historyIndex, currentBoardId]);


    // Listen for auth state changes
    useEffect(() => {
        // Check if user is already authenticated immediately
        const currentUser = getCurrentUser();
        if (currentUser) {
            setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
            });
            setIsAuthChecking(false);
        }

        // Listen for auth state changes
        const unsubscribe = onAuthChange((authUser) => {
            setUser(authUser);
            setIsAuthChecking(false);
        });
        return () => unsubscribe();
    }, []);

    // Auto-refresh auth token to prevent logout (Firebase tokens expire after 1 hour)
    useEffect(() => {
        if (!user) return;

        // Use onIdTokenChanged to automatically refresh tokens
        const unsubscribeToken = onTokenChange((token: string | null) => {
            if (token) {
                console.log('Firebase token updated automatically');
            } else {
                console.warn('Firebase token became null');
            }
        });

        // Also manually refresh token every 15 minutes as backup (reduced from 30min for better reliability)
        const refreshInterval = setInterval(async () => {
            console.log('[Token Refresh] Starting scheduled refresh...');
            const success = await refreshAuthToken();
            if (!success) {
                console.warn('[Token Refresh] Failed to refresh Firebase auth token');
            } else {
                console.log('[Token Refresh] Firebase token refreshed successfully');
            }

            // Should match logic in background refresh: Silent refresh
            try {
                const { refreshDriveAccessToken } = await import('./services/googleIdentity');
                const clientId = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';
                // Pass allowPrompt: false for silent refresh
                const driveSuccess = await refreshDriveAccessToken(clientId, false);
                if (driveSuccess) {
                    console.log('[Token Refresh] Drive token refreshed successfully');
                } else {
                    console.warn('[Token Refresh] Drive token refresh returned false (silent refresh may have failed)');
                }
            } catch (error) {
                console.error('[Token Refresh] Failed to refresh Drive token:', error);
            }
        }, 15 * 60 * 1000); // 15 minutes (reduced from 30 for better reliability)

        // Refresh immediately on mount if user is logged in (silent)
        console.log('[Token Refresh] Initial token refresh on mount...');
        refreshAuthToken();

        return () => {
            unsubscribeToken();
            clearInterval(refreshInterval);
        };
    }, [user]);

    // Listen for Google Auth errors (401)
    useEffect(() => {
        const handleAuthError = async () => {
            console.log('Google Auth error detected, attempting to recover session...');

            try {
                const { refreshDriveAccessToken } = await import('./services/googleIdentity');
                const clientId = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';

                // Attempt interactive refresh (allow popup to fix the error)
                // This replaces the aggressive window.location.reload()
                const success = await refreshDriveAccessToken(clientId, true);

                if (success) {
                    console.log('Session successfully recovered via interactive refresh');
                } else {
                    console.warn('Session recovery failed or cancelled by user');
                }
            } catch (err) {
                console.error('Failed to recover session:', err);
                // If interactive recovery fails severely, maybe then we reload, but let's avoid it for now
                // window.location.reload(); 
            }
        };

        window.addEventListener('google_auth_error', handleAuthError);
        return () => window.removeEventListener('google_auth_error', handleAuthError);
    }, []);

    // PERFORMANCE: Manual save function (replaced auto-save)
    const saveBoard = useCallback(async (withThumbnail: boolean = true) => {
        if (!user || currentBoardId === null) return;

        // Skip saving if board is completely empty
        if (items.length === 0 && groups.length === 0 && arrows.length === 0 && paths.length === 0 && connections.length === 0) {
            console.log('Skipping save: board is empty');
            return;
        }

        setIsSaving(true);
        try {
            // Upload images/videos to Google Drive and store only file IDs
            // IMPORTANT: Exclude PSD files - they should not be uploaded to Drive
            // IMPORTANT: Include ad items - they should be saved with their position
            const itemsForSave = await Promise.all(
                items.map(async (item) => {
                    // Ad items should be saved as-is (no Drive upload needed)
                    if (item.type === 'ad') {
                        return item;
                    }

                    if ('src' in item && (item.type === 'image' || item.type === 'video')) {
                        const mediaItem = item as MediaItemData;

                        // Handle PSD files: convert PNG to Drive and store driveFileId
                        if (mediaItem.fileName?.toLowerCase().endsWith('.psd') || mediaItem.originalFilePath) {
                            // If already has driveFileId, keep it
                            if (mediaItem.driveFileId) {
                                return { ...mediaItem, src: undefined }; // Remove src, keep driveFileId
                            }

                            // Convert PNG (src) to Drive
                            if (typeof mediaItem.src === 'string') {
                                try {
                                    let base64Data: string;

                                    if (mediaItem.src.startsWith('blob:')) {
                                        // Convert blob URL to base64
                                        const response = await fetch(mediaItem.src);
                                        const blob = await response.blob();
                                        base64Data = await new Promise<string>((resolve) => {
                                            const reader = new FileReader();
                                            reader.onloadend = () => resolve(reader.result as string);
                                            reader.readAsDataURL(blob);
                                        });
                                    } else if (mediaItem.src.startsWith('data:')) {
                                        // Already base64
                                        base64Data = mediaItem.src;
                                    } else {
                                        // Unknown format, skip
                                        return item;
                                    }

                                    // Upload PNG to Drive (overwrite existing file)
                                    const pngFileName = (mediaItem.fileName || `psd-${mediaItem.id}.png`).replace(/\.psd$/i, '.png');
                                    // Use overwrite=true for saving board (same file should be updated)
                                    const driveFileId = await uploadOrUpdateImageInDrive(base64Data, pngFileName, true, currentBoardId || undefined);
                                    console.log('PSD PNG uploaded/updated to Drive:', driveFileId, pngFileName);

                                    // Return item with driveFileId, remove src
                                    return { ...mediaItem, driveFileId, src: undefined };
                                } catch (err) {
                                    console.error('Failed to upload PSD PNG to Drive:', err);
                                    return item;
                                }
                            }
                            return item;
                        }

                        // If already has driveFileId, keep it and remove src
                        if (mediaItem.driveFileId) {
                            return { ...mediaItem, src: undefined }; // Remove src, keep driveFileId
                        }

                        // Handle videos: upload file directly (no base64 conversion)
                        if (item.type === 'video' && typeof mediaItem.src === 'string' && mediaItem.src.startsWith('blob:')) {
                            try {
                                // Fetch the video file from blob URL
                                const response = await fetch(mediaItem.src);
                                const blob = await response.blob();
                                const videoFile = new File([blob], mediaItem.fileName || `video-${mediaItem.id}.mp4`, { type: blob.type });

                                // Upload video to Drive
                                const fileName = mediaItem.fileName || `video-${mediaItem.id}.mp4`;
                                const driveFileId = await uploadOrUpdateMediaInDrive(videoFile, fileName, false, true, currentBoardId || undefined);
                                console.log('Video uploaded to Drive during save:', driveFileId);

                                // Return item with driveFileId, remove src
                                return { ...mediaItem, driveFileId, src: undefined };
                            } catch (err) {
                                console.error('Failed to upload video to Drive:', err);
                                return item;
                            }
                        }

                        // Handle images: If src is blob URL or base64, upload to Drive
                        if (item.type === 'image' && typeof mediaItem.src === 'string') {
                            try {
                                let base64Data: string;

                                if (mediaItem.src.startsWith('blob:')) {
                                    // Convert blob URL to base64
                                    const response = await fetch(mediaItem.src);
                                    const blob = await response.blob();
                                    base64Data = await new Promise<string>((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result as string);
                                        reader.readAsDataURL(blob);
                                    });
                                } else if (mediaItem.src.startsWith('data:')) {
                                    // Already base64
                                    base64Data = mediaItem.src;
                                } else {
                                    // Unknown format, skip Drive upload
                                    return item;
                                }

                                // Upload to Drive
                                const fileName = mediaItem.fileName || `image-${mediaItem.id}.png`;
                                const driveFileId = await uploadImageToDrive(base64Data, fileName, currentBoardId || undefined);
                                console.log('Image uploaded to Drive during save:', driveFileId);

                                // Return item with driveFileId, remove src
                                return { ...mediaItem, driveFileId, src: undefined };
                            } catch (err) {
                                console.error('Failed to upload image to Drive:', err);
                                // Fallback: keep src as base64
                                if (mediaItem.src.startsWith('blob:')) {
                                    try {
                                        const response = await fetch(mediaItem.src);
                                        const blob = await response.blob();
                                        const base64 = await new Promise<string>((resolve) => {
                                            const reader = new FileReader();
                                            reader.onloadend = () => resolve(reader.result as string);
                                            reader.readAsDataURL(blob);
                                        });
                                        return { ...mediaItem, src: base64 };
                                    } catch (base64Err) {
                                        console.error('Failed to convert blob to base64:', base64Err);
                                        return item;
                                    }
                                }
                                return item;
                            }
                        }
                    }
                    return item;
                })
            );

            const boardData = {
                version: '2.0',
                boardId: currentBoardId,
                items: itemsForSave,
                groups,
                arrows,
                paths,
                connections,
            };

            // Generate thumbnail only when requested
            let thumbnail: string | undefined;
            if (withThumbnail) {
                try {
                    const canvas = await html2canvas(document.body, {
                        useCORS: true,
                        allowTaint: true,
                        scale: 0.1, // Reduced from 0.2 for better performance
                        backgroundColor: '#111827',
                        ignoreElements: (_element) => false
                    });
                    thumbnail = canvas.toDataURL('image/jpeg', 0.5); // Reduced from 0.6
                } catch (err) {
                    console.error('Failed to generate thumbnail:', err);
                }
            }

            const targetFileId = (currentBoardId && currentBoardId !== 'new') ? currentBoardId : driveFileId;
            const fileId = await saveBoardToDrive(boardData, boardName, targetFileId || undefined, thumbnail);

            if (!driveFileId || driveFileId !== fileId) {
                setDriveFileId(fileId);
                if (currentBoardId === 'new') {
                    setCurrentBoardId(fileId);
                }
            }

            console.log('Board saved:', fileId, thumbnail ? '(with thumbnail)' : '(no thumbnail)');
        } catch (error) {
            console.error('Failed to save:', error);
            alert('저장 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSaving(false);
        }
    }, [items, groups, arrows, paths, connections, user, currentBoardId, boardName, driveFileId]);

    // Auto-save with debounce
    useEffect(() => {
        if (!currentBoardId || currentBoardId === 'new' || !user) return;

        // DISABLED: LocalStorage backup removed due to quota issues with large boards
        // All data is already synced to Firebase in real-time, so this backup is redundant
        // Users can rely on Firebase for crash recovery
        /* 
        try {
            const backupKey = `backup_${currentBoardId}`;
            const lightweightItems = items.map(item => {
                if ((item.type === 'image' || item.type === 'ad' || item.type === 'video') && item.url) {
                    const isBlobOrBase64 = item.url.startsWith('blob:') || item.url.startsWith('data:');
                    if (isBlobOrBase64) {
                        return { ...item, url: undefined };
                    }
                }
                return item;
            });
            
            const backupData = {
                timestamp: Date.now(),
                items: lightweightItems,
                groups,
                arrows,
                paths,
                connections
            };
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            localStorage.setItem('last_active_board_id', currentBoardId);
        } catch (e) {
            console.error('Failed to save local backup:', e);
        }
        */

        /* 
        // PERFORMANCE: Disabled frequent auto-save content to Drive/Cloud
        // User prefers to save only on exit or manually (Ctrl+S)
        const autoSaveTimer = setTimeout(() => {
            console.log('Auto-saving board...');
            saveBoard(false); // No thumbnail for auto-save
        }, 1000); // Reduced to 1000ms for faster persistence
     
        return () => clearTimeout(autoSaveTimer);
        */
        return () => { };
    }, [items, groups, arrows, paths, connections, currentBoardId, user, saveBoard]);

    // Save on Window Close / Refresh (Best Effort)
    useEffect(() => {
        const handleBeforeUnload = (_e: BeforeUnloadEvent) => {
            // Attempt to save state synchronously to localStorage one last time
            // (Already handled by item change effects, but good for safety)

            // Trigger cloud save (Async, might be cancelled by browser but worth trying)
            // Note: For critical data, we rely on the localStorage backup restored on next load
            if (currentBoardId && currentBoardId !== 'new') {
                saveBoard(false);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentBoardId, saveBoard]);

    // Save on Ctrl+S (manual save)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                console.log('Manual save triggered (Ctrl+S)');
                saveBoard(false); // No thumbnail for quick save
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveBoard]);

    // Listen for Global Shortcuts (Always On Top / Opacity)
    useEffect(() => {
        const handleGlobalShortcuts = async (e: KeyboardEvent) => {
            // Don't handle if settings modal is open or editing text
            if (isSettingsOpen) return;
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

            // Check Always On Top
            if (settings.alwaysOnTop && isShortcutMatch(e, settings.alwaysOnTop)) {
                e.preventDefault();
                if (window.electronAPI) {
                    const newState = await window.electronAPI.toggleAlwaysOnTop();
                    setIsAlwaysOnTop(newState);
                }
            }

            // Check Opacity
            if (settings.opacity && isShortcutMatch(e, settings.opacity)) {
                e.preventDefault();
                // Calculate new opacity value based on current opacity (same pattern as mouse slider)
                const currentOpacity = opacityRef.current;
                const newOpacity = currentOpacity >= 0.9 ? 0.5 : 1; // Toggle between 100% and 50%
                setOpacity(newOpacity);
            }

            // Align Selected Items
            if (settings.alignItems && isShortcutMatch(e, settings.alignItems)) {
                e.preventDefault();
                handleAlignSelectedItems();
            }
        };

        window.addEventListener('keydown', handleGlobalShortcuts);
        return () => window.removeEventListener('keydown', handleGlobalShortcuts);
    }, [settings, isSettingsOpen, handleAlignSelectedItems]);

    // Handle clipboard paste (Ctrl+V)
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            // Don't handle if user is editing text
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            // Find image in clipboard
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();

                    const blob = items[i].getAsFile();
                    if (!blob) continue;

                    console.log('Pasting image from clipboard:', blob.type);

                    // Convert blob to data URL
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const dataUrl = event.target?.result as string;

                        // Get actual image dimensions
                        const img = new Image();
                        img.onload = () => {
                            // Calculate position based on mouse or viewport center
                            let targetX: number;
                            let targetY: number;

                            const mouseX = lastMousePositionRef.current.x;
                            const mouseY = lastMousePositionRef.current.y;
                            console.log('Paste using Mouse Pos:', mouseX, mouseY);

                            // Use mouse position if available (and not 0,0 which implies initial state)
                            if (mouseX !== 0 || mouseY !== 0) {
                                targetX = (mouseX - viewport.x) / viewport.scale;
                                targetY = (mouseY - viewport.y) / viewport.scale;
                            } else {
                                // Fallback to center
                                targetX = (window.innerWidth / 2 - viewport.x) / viewport.scale;
                                targetY = (window.innerHeight / 2 - viewport.y) / viewport.scale;
                            }

                            // Use actual image dimensions, but limit max size
                            const maxSize = 800;
                            let width = img.width;
                            let height = img.height;

                            if (width > maxSize || height > maxSize) {
                                const ratio = Math.min(maxSize / width, maxSize / height);
                                width = Math.round(width * ratio);
                                height = Math.round(height * ratio);
                            }

                            // Create new image item
                            const newItem: MediaItemData = {
                                id: `img-${Date.now()}`,
                                type: 'image',
                                src: dataUrl,
                                url: dataUrl,
                                x: targetX - width / 2, // Center the image on target
                                y: targetY - height / 2,
                                width: width,
                                height: height,
                                zIndex: items.length,
                                rotation: 0,
                                flipHorizontal: false,
                                flipVertical: false,
                                fileName: `clipboard-${Date.now()}.png`
                            };

                            // Save to history
                            saveToHistory();

                            // Add to canvas
                            setItems(prev => [...prev, newItem]);

                            // Sync to Firebase
                            if (currentBoardId && currentBoardId !== 'new') {
                                updateRemoteItem(currentBoardId, newItem.id, newItem);
                            }

                            console.log('Image pasted successfully:', newItem.id);
                        };
                        img.src = dataUrl;
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };

        const updateMousePos = (e: MouseEvent) => {
            lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
            // console.log('Global Mouse Tracking:', e.clientX, e.clientY); // Uncomment for debugging if needed
        };

        window.addEventListener('paste', handlePaste);
        // Move mouse tracking to separate effect to avoid frequent re-binding
        // but keep it here if we want to bind/unbind together? 
        // Actually, let's keep it separate to be safe.

        return () => window.removeEventListener('paste', handlePaste);
    }, [viewport, items.length, currentBoardId, saveToHistory]);

    // Dedicated global mouse tracker to ensure we always have the latest position
    useEffect(() => {
        const updateMousePos = (e: MouseEvent) => {
            lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', updateMousePos);
        return () => window.removeEventListener('mousemove', updateMousePos);
    }, []);

    // Handle clipboard copy (Ctrl+C)
    useEffect(() => {
        const handleCopy = async (e: ClipboardEvent) => {
            // Don't handle if user is editing text
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            // Only handle if exactly one item is selected (for now, to avoid complexity)
            if (selectedIds.length !== 1) return;

            const selectedItem = items.find(i => i.id === selectedIds[0]);
            if (!selectedItem || selectedItem.type !== 'image') return;

            // Stop propagation to prevent duplicate handling
            // But verify if we actually handled it first?
            // Actually, we should prevent default only if we are going to write to clipboard

            try {
                // Determine source URL
                const src = selectedItem.src || selectedItem.url;
                if (!src) {
                    console.log('Copy failed: No source URL');
                    return;
                }

                console.log('Attempting to copy image:', src);
                e.preventDefault(); // We are handling the copy

                // 1. Try Electron Native Copy (Best for CORS/Drive images)
                if (window.electronAPI?.copyImageToClipboard) {
                    try {
                        let targetUrl = src;

                        // Critical: Main process cannot fetch blob: URLs. Convert to base64 first.
                        if (src.startsWith('blob:')) {
                            console.log('Converting blob URL to base64 for IPC...');
                            const response = await fetch(src);
                            const blob = await response.blob();
                            targetUrl = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                        }

                        console.log('Using Electron Native Clipboard Copy...');
                        const result = await window.electronAPI.copyImageToClipboard(targetUrl);
                        if (result.success) {
                            console.log('Image copied via Electron:', selectedItem.id);
                            // Visual feedback could be added here
                            return;
                        } else {
                            console.warn('Electron copy failed, falling back to Web API:', result.error);
                        }
                    } catch (ipcErr) {
                        console.error('IPC preparation failed:', ipcErr);
                    }
                }

                // 2. Web API Fallback
                const response = await fetch(src);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

                const blob = await response.blob();

                if (blob) {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob
                        })
                    ]);
                    console.log('Image copied to system clipboard (Web API):', selectedItem.id);
                }
            } catch (err) {
                console.error('Failed to copy image to clipboard:', err);
                alert('이미지 복사 실패: ' + (err instanceof Error ? err.message : String(err)));
            }
        };

        // Removed redundant window.addEventListener('copy', handleCopy);
        // We now handle copy logic inside the central handleKeyDown (Ctrl+C) handler 
        // to avoid conflict with e.preventDefault/e.stopPropagation there.
        return () => { };
    }, [selectedIds, items]);



    // Listen for PSD file changes
    useEffect(() => {
        if (window.electronAPI?.onPSDFileChanged) {
            window.electronAPI.onPSDFileChanged(async (data: { path: string }) => {
                console.log('PSD file changed event received:', data.path);

                // Normalize paths for comparison (handle Windows path differences)
                const normalizePath = (path: string) => {
                    return path.replace(/\\/g, '/').toLowerCase();
                };

                const normalizedChangedPath = normalizePath(data.path);

                // Find the item with this file path
                const item = items.find(i => {
                    const itemPath = (i as MediaItemData).originalFilePath;
                    if (!itemPath) return false;
                    return normalizePath(itemPath) === normalizedChangedPath;
                }) as MediaItemData | undefined;

                if (item && item.fileName?.toLowerCase().endsWith('.psd')) {
                    console.log('Found matching PSD item:', item.fileName, 'Updating...');
                    try {
                        // Add a small delay to ensure file is fully written
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Re-read the PSD file via IPC
                        if (window.electronAPI?.readPSDFile) {
                            const result = await window.electronAPI.readPSDFile(data.path);
                            if (result.success && result.data) {
                                const file = new File([result.data], item.fileName || 'image.psd', { type: 'application/octet-stream' });

                                const { convertPSDToImage } = await import('./utils/psdParser');
                                const imageUrl = await convertPSDToImage(file);

                                if (imageUrl) {
                                    // Upload/update PNG to Drive (overwrite existing file)
                                    let driveFileId = item.driveFileId;
                                    try {
                                        const pngFileName = (item.fileName || `psd-${item.id}.png`).replace(/\.psd$/i, '.png');
                                        // Use overwrite=true for PSD file changes (same file should be updated)
                                        driveFileId = await uploadOrUpdateImageInDrive(imageUrl, pngFileName, true, currentBoardId || undefined);
                                        console.log('PSD PNG updated in Drive:', driveFileId, pngFileName);
                                    } catch (driveErr) {
                                        console.error('Failed to update PSD PNG in Drive:', driveErr);
                                    }

                                    // Update the item's src and driveFileId
                                    setItems(prev => prev.map(prevItem => {
                                        if (prevItem.id === item.id) {
                                            const updatedItem = { ...prevItem, src: imageUrl, driveFileId } as BoardItem;

                                            // Sync to Firebase
                                            if (currentBoardId && currentBoardId !== 'new') {
                                                updateRemoteItem(currentBoardId, item.id, { src: imageUrl, driveFileId });
                                            }

                                            return updatedItem;
                                        }
                                        return prevItem;
                                    }));
                                    console.log('PSD file updated successfully:', item.fileName);
                                } else {
                                    console.warn('Failed to convert PSD to image');
                                }
                            } else {
                                console.error('Failed to read PSD file:', result.error);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to update PSD file:', error);
                    }
                } else {
                    console.warn('No matching PSD item found for path:', data.path);
                }
            });
        }

        return () => {
            if (window.electronAPI?.removePSDFileChangedListener) {
                window.electronAPI.removePSDFileChangedListener();
            }
        };
    }, [items, currentBoardId]);
    // Initialize & Maintain Ad Item Position (Personal Ad)
    // Updates whenever viewport changes to stay in view
    // Ad Banner Timer: 10 Seconds (10,000 ms)
    // - Spawns initially at center
    // - User can move it freely
    // - Every 10 seconds, it re-centers to the top of the CURRENT viewport


    // Load board from Drive (modified to NOT clear Ad Item)
    useEffect(() => {
        async function loadBoard() {
            if (currentBoardId && currentBoardId !== 'new') {
                // Skip if we already have the correct file ID (e.g. just created/saved)
                if (currentBoardId === driveFileId) {
                    return;
                }

                try {
                    const boardData = await loadBoardFromDrive(currentBoardId);

                    // Load items and settings
                    if (boardData.items) {
                        // Load images/videos from Drive if driveFileId is set
                        // If driveFileId exists, ignore src (even if it's a blob URL) and load from Drive
                        const itemsWithLoadedMedia = await Promise.all(
                            boardData.items.map(async (item: any) => {
                                // Create a copy
                                const safeItem = { ...item };

                                // Remove expired blob URLs (check both src and url properties)
                                if (safeItem.src && typeof safeItem.src === 'string' && safeItem.src.startsWith('blob:')) {
                                    safeItem.src = undefined;
                                }
                                if (safeItem.url && typeof safeItem.url === 'string' && safeItem.url.startsWith('blob:')) {
                                    safeItem.url = undefined;
                                }

                                // Restore media from Drive
                                if ((safeItem.type === 'image' || safeItem.type === 'video') && safeItem.driveFileId) {
                                    // Retry logic with exponential backoff
                                    const MAX_RETRIES = 3;
                                    let lastError: any = null;

                                    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                                        try {
                                            const blobUrl = await loadImageFromDrive(safeItem.driveFileId);
                                            // Update BOTH properties to ensure compatibility
                                            return { ...safeItem, src: blobUrl, url: blobUrl };
                                        } catch (error) {
                                            lastError = error;
                                            // Exponential backoff: 500ms, 1000ms, 2000ms
                                            const delay = 500 * Math.pow(2, attempt);
                                            if (attempt < MAX_RETRIES - 1) {
                                                console.warn(`Drive load failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, safeItem.id);
                                                await new Promise(resolve => setTimeout(resolve, delay));
                                            }
                                        }
                                    }

                                    // All retries failed
                                    console.error('Failed to load media from Drive after retries:', {
                                        itemId: safeItem.id,
                                        error: lastError instanceof Error ? lastError.message : String(lastError)
                                    });
                                    // Return item with empty url to prevent errors
                                    return { ...safeItem, url: '', src: '' };
                                }
                                return safeItem;
                            })
                        );

                        // FIX: Ad Item is managed by dedicated effect
                        setItems(itemsWithLoadedMedia);

                        // Start watching PSD files if originalFilePath exists and file is accessible
                        // Only watch if the file actually exists (don't fail if file is missing on different computer)
                        itemsWithLoadedMedia.forEach(async (item: any) => {
                            if (item.type === 'image' && item.fileName?.toLowerCase().endsWith('.psd') && item.originalFilePath) {
                                if (window.electronAPI?.watchPSDFile) {
                                    try {
                                        // Check if file exists before watching (optional - don't fail if missing)
                                        // The watchPSDFile function should handle missing files gracefully
                                        await window.electronAPI.watchPSDFile(item.originalFilePath);
                                        console.log('Started watching PSD file:', item.originalFilePath);
                                    } catch (error) {
                                        // File doesn't exist on this computer - that's okay, just log it
                                        console.log('PSD file not found on this computer (expected on different computers):', item.originalFilePath);
                                        // Don't throw error - image will still load from Drive via driveFileId
                                    }
                                }
                            }
                        });
                    }
                    if (boardData.groups) {
                        // Ensure all groups have valid childIds arrays
                        const normalizedGroups = boardData.groups.map((group: any) => ({
                            ...group,
                            childIds: Array.isArray(group.childIds) ? group.childIds : []
                        }));
                        setGroups(normalizedGroups);
                    }
                    if (boardData.arrows) setArrows(boardData.arrows);
                    if (boardData.paths) setPaths(boardData.paths);
                    if (boardData.connections) {
                        console.log('Loading connections from board:', boardData.connections);
                        setConnections(Array.isArray(boardData.connections) ? boardData.connections : Object.values(boardData.connections));
                    } else {
                        console.log('No connections found in board data');
                    }

                    // Reset history when loading a board
                    setHistory([]);
                    setHistoryIndex(-1);

                    // Set board name from file metadata (if available) or content
                    if (boardData.name) setBoardName(boardData.name);

                    setDriveFileId(currentBoardId);
                    console.log('Board loaded:', boardData);
                    console.log('Connections in board data:', boardData.connections);

                    // Ensure images folder exists for this board
                    // This creates the folder if it doesn't exist when entering an existing board
                    try {
                        const { getOrCreateBoardImagesFolder } = await import('./services/googleDrive');
                        await getOrCreateBoardImagesFolder(currentBoardId, boardData.name || boardName);
                        console.log(`Ensured images folder exists for board: ${boardData.name || boardName}`);
                    } catch (error) {
                        // Don't fail board load if folder creation fails
                        console.warn('Failed to ensure images folder exists:', error);
                    }

                    // RECOVERY CHECK: Check for local backup (Alt+F4 safety)
                    try {
                        const backupKey = `backup_${currentBoardId}`;
                        const localBackupJson = localStorage.getItem(backupKey);
                        if (localBackupJson) {
                            const backup = JSON.parse(localBackupJson);
                            // Only restore if backup has items and is essentially "valid"
                            // We heavily rely on this for Alt+F4 recovery since cloud save is async/slow
                            if (backup.items && Array.isArray(backup.items)) {
                                console.log('Found local backup, restoring to ensure latest state...');

                                // Merge backup items with boardData to fix dead blob URLs
                                const mergedItems = backup.items.map((bItem: any) => {
                                    // If src is a blob (dead after reload) and we have cloud data, try to recover
                                    if (bItem.src && bItem.src.startsWith('blob:') && boardData?.items) {
                                        const cloudItem = boardData.items.find((cItem: any) => cItem.id === bItem.id);
                                        if (cloudItem && cloudItem.src && !cloudItem.src.startsWith('blob:')) {
                                            console.log(`Recovered src for item ${bItem.id} from cloud data`);
                                            return { ...bItem, src: cloudItem.src };
                                        }
                                    }
                                    return bItem;
                                });

                                setItems(mergedItems);

                                if (backup.groups) setGroups(backup.groups);
                                if (backup.arrows) setArrows(backup.arrows);
                                if (backup.paths) setPaths(backup.paths);
                                if (backup.connections) setConnections(backup.connections);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to restore from backup:', err);
                    }
                } catch (error) {
                    console.error('Failed to load board:', error);
                }
            } else if (currentBoardId === 'new') {
                // Reset board for new one
                setItems([]);
                setGroups([]);
                setArrows([]);
                setPaths([]);
                setDriveFileId(null);

                // Immediately save empty board so share button appears
                try {
                    const emptyBoardData = {
                        version: '2.0',
                        boardId: 'new',
                        items: [],
                        groups: [],
                        arrows: [],
                        paths: [],
                    };

                    const fileId = await saveBoardToDrive(emptyBoardData, boardName, undefined);
                    setDriveFileId(fileId);
                    setCurrentBoardId(fileId);
                    console.log('Empty board created and saved:', fileId);
                } catch (error) {
                    console.error('Failed to create empty board:', error);
                }
            }
        }
        loadBoard();
    }, [currentBoardId]);

    // Parse URL parameters for deep linking (bookmark sharing)
    // Unified Deep Link Handler
    const handleDeepLinkParams = useCallback((params: URLSearchParams) => {
        const boardIdParam = params.get('boardId');
        const x = params.get('x');
        const y = params.get('y');
        const scale = params.get('scale');
        const name = params.get('name');

        if (boardIdParam && x && y) {
            console.log('Deep link processing:', { boardIdParam, x, y, scale, name });

            // 1. If Board ID doesn't match, Switch Board
            if (boardIdParam !== currentBoardId) {
                // Only switch if we aren't already loading it
                if (currentBoardIdRef.current !== boardIdParam) {
                    console.log(`Switching board for deep link: ${currentBoardId} -> ${boardIdParam}`);
                    setCurrentBoardId(boardIdParam);
                }
                return;
            }

            // 2. Board matches! Now apply Navigation & Bookmark
            setTimeout(() => {
                const parsedX = parseFloat(x);
                const parsedY = parseFloat(y);
                const parsedScale = scale ? parseFloat(scale) : 1;

                setViewport(prev => ({ ...prev, scale: parsedScale }));
                setNavigateTo({ x: parsedX, y: parsedY });

                if (name) {
                    const decodedName = decodeURIComponent(name);

                    setBookmarks(prev => {
                        const exists = prev.some(b =>
                            Math.abs(b.x - parsedX) < 1 &&
                            Math.abs(b.y - parsedY) < 1 &&
                            b.name === decodedName
                        );

                        if (exists) return prev;

                        const targetId = params.get('targetId');
                        let finalTargetId: string | null = null;

                        // Trust the targetId from URL (don't wait for item load)
                        // This fixes the race condition where items haven't loaded yet when deep link is processed.
                        // The bookmark component will automatically link to the item once it appears.
                        if (targetId) {
                            finalTargetId = targetId;
                            console.log('Deep link target ID set (blind trust):', targetId);
                        }

                        const newBookmark: Bookmark = {
                            id: Date.now().toString(),
                            name: decodedName,
                            targetId: finalTargetId,
                            x: parsedX,
                            y: parsedY,
                            scale: parsedScale
                        };

                        console.log('Shared bookmark auto-saved:', newBookmark);

                        if (currentBoardId && currentBoardId !== 'new') {
                            setTimeout(() => {
                                updateRemoteData(currentBoardId, 'bookmarks', [...prev, newBookmark]);
                            }, 500);
                        }

                        return [...prev, newBookmark];
                    });
                }
            }, 1000);
        }
    }, [currentBoardId]);

    // Parse URL parameters for deep linking (bookmark sharing)
    useEffect(() => {
        // Allow running even if user/currentBoardId is not fully set initially (to capture params)
        // But we DO need to know if we are logged in or have access effectively.
        // Actually, if we are just opening the app, we might not have user yet.
        // But let's assume this runs when app is mounted.

        const params = new URLSearchParams(window.location.search);
        const boardIdParam = params.get('boardId');
        const x = params.get('x');
        const y = params.get('y');
        const scale = params.get('scale');
        const name = params.get('name');

        if (boardIdParam && x && y) {
            console.log('Bookmark URL detected:', { boardIdParam, x, y, scale, name });

            // 1. If Board ID doesn't match, Switch Board
            if (boardIdParam !== currentBoardId) {
                // Only switch if we aren't already loading it
                if (currentBoardIdRef.current !== boardIdParam) {
                    setCurrentBoardId(boardIdParam);
                }
                return; // Wait for board to load
            }

            // 2. Board matches! Now apply Navigation & Bookmark
            // We use a timeout to give the board a moment to render items
            // Ideally we'd hook into "items loaded" event, but a small delay + robust state update is sufficient for now.
            setTimeout(() => {
                const parsedX = parseFloat(x);
                const parsedY = parseFloat(y);
                const parsedScale = scale ? parseFloat(scale) : 1;

                // Set viewport scale & position
                setViewport(prev => ({ ...prev, scale: parsedScale }));
                setNavigateTo({ x: parsedX, y: parsedY });

                // Auto-save this bookmark logic
                if (name) {
                    const decodedName = decodeURIComponent(name);

                    setBookmarks(prev => {
                        // Check availability within the functional update to ensure fresh state
                        const exists = prev.some(b =>
                            Math.abs(b.x - parsedX) < 1 &&
                            Math.abs(b.y - parsedY) < 1 &&
                            b.name === decodedName
                        );

                        if (exists) return prev;

                        const newBookmark: Bookmark = {
                            id: Date.now().toString(),
                            name: decodedName,
                            targetId: null,
                            x: parsedX,
                            y: parsedY,
                            scale: parsedScale
                        };

                        console.log('Shared bookmark auto-saved:', newBookmark);

                        // Side-effect: Save to remote (if valid board)
                        // We do this here (or in a separate effect watching bookmarks)
                        // Doing it here ensures it syncs immediately.
                        if (currentBoardId && currentBoardId !== 'new') {
                            // Note: We need to pass the NEW list including this bookmark
                            // But we can't easily access the "new list" for async call inside setState.
                            // So we just fire the update with "prev + new".
                            // Risk: Race condition if remote update is slower than another update?
                            // Better: Let the bookmarks state update handle the sync? 
                            // Current arch seems to likely sync elsewhere or need manual sync.
                            // The original code called updateRemoteData manually.

                            // Let's use a timeout to sync to avoid state collision?
                            // Or just fire-and-forget.
                            setTimeout(() => {
                                updateRemoteData(currentBoardId, 'bookmarks', [...prev, newBookmark]);
                            }, 500);
                        }

                        return [...prev, newBookmark];
                    });
                }
            }, 1000); // 1s delay to safely allow board load to settle
        }
    }, [currentBoardId]); // Run when board ID changes (and effectively matches URL)

    // Effect: Handle Electron IPC Deep Links
    useEffect(() => {
        if (window.electronAPI?.onDeepLink) {
            window.electronAPI.onDeepLink((url: string) => {
                console.log('Electron deep link received:', url);

                try {
                    // url is like "refboard://?boardId=..."
                    const urlObj = new URL(url);
                    const params = urlObj.searchParams;

                    console.log('Parsed params:', Object.fromEntries(params.entries()));

                    // Verify critical params
                    if (!params.get('boardId') || !params.get('x') || !params.get('y')) {
                        console.warn('Deep link missing required params');
                        return;
                    }

                    handleDeepLinkParams(params);
                } catch (e: any) {
                    console.error('Failed to parse Electron deep link:', e);
                    alert('DEBUG: Deep Link Parse Error\n' + e.message);
                }
            });
        }
    }, [handleDeepLinkParams]);

    // Real-time collaboration: cursor tracking, presence, and board sync
    useEffect(() => {
        if (!user || !currentBoardId || currentBoardId === 'new') return;

        // Subscribe to other users' cursors
        const unsubscribeCursors = subscribeToCursors(
            currentBoardId,
            setCollaboratorCursors
        );

        // Subscribe to board data changes (Real-time Sync)
        const unsubscribeBoardData = subscribeToBoardData(
            currentBoardId,
            (newItems) => {
                // First, normalize all remote items (src -> url)
                const normalizedRemoteItems = newItems.map((item: any) => ({
                    ...item,
                    url: item.url || item.src // Handle legacy src property
                }));

                // Identify items that need hydration (Drive items with invalid/blob URLs)
                // We'll do this check after merging with local state to see if we already have a valid URL locally

                setItems(prevItems => {
                    const itemsMap = new Map(prevItems.map(item => [item.id, item]));
                    const remoteItemsMap = new Map(normalizedRemoteItems.map((item: any) => [item.id, item]));
                    const itemsToHydrate: string[] = [];

                    // Update with remote changes, but preserve local image data
                    const updatedItems = normalizedRemoteItems.map((remoteItem: any) => {
                        const localItem = itemsMap.get(remoteItem.id);

                        // Smart Merge Logic:
                        // 1. If we have a local item with the same ID
                        if (localItem) {
                            // If local has a URL but remote doesn't (or remote is just a placeholder), keep local
                            if (localItem.url && !remoteItem.url) {
                                return { ...remoteItem, url: localItem.url };
                            }
                            // If remote has a 'blob:' URL (from another user) and we have a local URL (maybe our own upload),
                            // prefer our local one? 
                            // Actually, if it's a Drive item, and we have a local blob, it's likely valid if we just uploaded it.
                            // If remote sends a blob url that matches ours, great.
                            // If remote sends a DIFFERENT blob url (from User B), and we are User A (viewer), we can't read it.
                            // So: If remote has DriveID, and we DON'T have a valid local blob (or we are User B), we need to fetch.

                            // Simplest check: If it has driveFileId, and the resolved URL will be a 'blob:' string, 
                            // we risk it being invalid unless it's the one we just created.
                            // But we can't easily check validity.
                            // However, we can check if it was *just* added or we are the uploader? No.
                        }

                        // Determine if hydration is needed
                        // If it's a video/image from Drive, and the URL is a blob (which is local-only) or missing...
                        if (remoteItem.driveFileId && user) {
                            const isBlob = remoteItem.url?.startsWith('blob:');
                            const isMissing = !remoteItem.url;
                            const isVideo = remoteItem.type === 'video';

                            // CRITICAL: Always hydrate videos with blob URLs
                            // Blob URLs are session-specific and become invalid after page reload
                            // MEMORY OPTIMIZATION: Videos are now Click-to-Load (Lazy Loaded) in VideoItem.tsx
                            // We do NOT add them to itemsToHydrate here to prevent out-of-memory crashes on large boards.
                            if (isVideo) {
                                // Do not hydrate video blobs automatically
                            } else if (isBlob || isMissing) {
                                // Hydrate other items (images) with blob or missing URLs
                                itemsToHydrate.push(remoteItem.id);
                            }
                        }

                        // If local item has data and remote doesn't, keep local (legacy/optimistic)
                        if (localItem && localItem.url && !remoteItem.url) {
                            return { ...remoteItem, url: localItem.url };
                        }

                        return remoteItem;
                    });

                    // Background hydration for identified items
                    if (itemsToHydrate.length > 0) {
                        // Batch load to prevent ERR_INSUFFICIENT_RESOURCES
                        // Track which items are currently being hydrated to prevent duplicates
                        const hydratingIds = new Set<string>();
                        // CRITICAL: Track which items have been successfully hydrated to prevent re-hydration
                        // This ref persists across sync callbacks to prevent infinite loops
                        if (!window.hydratedItems) {
                            window.hydratedItems = new Set<string>();
                        }

                        const batchSize = 3; // Load 3 images at a time
                        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

                        (async () => {
                            for (let i = 0; i < itemsToHydrate.length; i += batchSize) {
                                const batch = itemsToHydrate.slice(i, i + batchSize);

                                await Promise.all(batch.map(async (id) => {
                                    // Skip if already successfully hydrated
                                    if (window.hydratedItems.has(id)) {
                                        return;
                                    }

                                    // Skip if already hydrating this item
                                    if (hydratingIds.has(id)) return;
                                    hydratingIds.add(id);

                                    const item = updatedItems.find(i => i.id === id);
                                    if (!item || !item.driveFileId) {
                                        hydratingIds.delete(id);
                                        return;
                                    }

                                    // CRITICAL: Check if item is already hydrated with a persistent URL
                                    // If it has a proper HTTP/HTTPS URL, it doesn't need hydration.
                                    // BUT if it is empty, null, or a blob URL, we NEED to hydrate it from Drive.
                                    const currentUrl = item.url || '';
                                    if (currentUrl.startsWith('http')) {
                                        window.hydratedItems.add(id); // Mark as hydrated
                                        hydratingIds.delete(id);
                                        return;
                                    }

                                    try {
                                        const isVideoItem = item.type === 'video';
                                        const url = await loadImageFromDrive(item.driveFileId, false, isVideoItem);
                                        // Update state with fresh URL
                                        setItems(current => current.map(i =>
                                            i.id === id ? { ...i, url: url, src: url } : i
                                        ));
                                        // Mark as successfully hydrated
                                        window.hydratedItems.add(id);
                                    } catch (err) {
                                        console.warn('Hydration failed for:', id, err);
                                    } finally {
                                        hydratingIds.delete(id);
                                    }
                                }));

                                // Wait between batches to avoid overwhelming browser
                                if (i + batchSize < itemsToHydrate.length) {
                                    await delay(100);
                                }
                            }
                        })();
                    }

                    // Cleanup remote duplicates (anything with type 'ad' but NOT the one we kept)
                    normalizedRemoteItems.forEach((remoteItem: any) => {
                        if (remoteItem.type === 'ad' && remoteItem.id !== 'ad-banner') {
                            console.log(`[Cleanup] Deleting duplicate ad: ${remoteItem.id} from board ${currentBoardId}`);
                            deleteRemoteItem(currentBoardId, remoteItem.id);
                        }
                    });

                    // FIX: Ad Item is managed locally
                    return updatedItems;
                });
            },
            (newGroups) => {
                // Normalize groups to ensure childIds is always an array
                const normalizedGroups = newGroups.map((group: any) => ({
                    ...group,
                    childIds: Array.isArray(group.childIds) ? group.childIds : []
                }));
                setGroups(normalizedGroups);
            },
            (newArrows) => setArrows(newArrows),
            (newPaths) => setPaths(newPaths),
            (newConnections) => {
                // Only update connections if newConnections is provided and not empty
                // This preserves local connections when Firebase data doesn't include them
                if (newConnections && newConnections.length > 0) {
                    setConnections(newConnections);
                }
            }
        );

        // Set presence
        setPresence(currentBoardId, user.uid, user.displayName || 'Unknown', user.email || '');

        // Track mouse movement for cursor sync
        const handleMouseMove = (e: MouseEvent) => {
            updateCursor(
                currentBoardId,
                user.uid,
                user.displayName || 'Unknown',
                user.email || '',
                e.clientX,
                e.clientY
            );
        };

        window.addEventListener('mousemove', handleMouseMove);

        // Cleanup
        return () => {
            unsubscribeCursors();
            unsubscribeBoardData();
            removePresence(currentBoardId);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [user, currentBoardId]);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // Convert image/video blob URL to base64
    const convertMediaToBase64 = async (src: string): Promise<string> => {
        // If already base64, return as is
        if (src.startsWith('data:')) {
            return src;
        }

        try {
            const response = await fetch(src);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to convert media to base64:', error);
            return src; // Return original if conversion fails
        }
    };

    // Convert base64 data URL to blob URL
    const convertBase64ToBlobUrl = (dataUrl: string): string => {
        // If already blob URL, return as is
        if (dataUrl.startsWith('blob:')) {
            return dataUrl;
        }

        // If it's a data URL, convert to blob URL
        if (dataUrl.startsWith('data:')) {
            try {
                // Extract mime type and base64 data
                const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const base64Data = matches[2];
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    return URL.createObjectURL(blob);
                }
            } catch (error) {
                console.error('Failed to convert base64 to blob URL:', error);
            }
        }

        // Return original if conversion fails or not a data URL
        return dataUrl;
    };

    // Save/Load functions
    const handleSave = useCallback(async () => {
        // Convert all media items to base64 before saving
        const itemsWithBase64 = await Promise.all(items.map(async (item) => {
            if (item.type === 'image' || item.type === 'video') {
                const base64Src = await convertMediaToBase64(item.src);
                return { ...item, src: base64Src };
            }
            return item;
        }));

        const boardData = {
            version: '1.0',
            items: itemsWithBase64,
            groups,
            arrows,
            paths,
            settings,
            penSettings
        };

        if (window.electronAPI?.saveFile) {
            const result = await window.electronAPI.saveFile(boardData);
            if (result.success) {
                console.log('Board saved to:', result.path);

                // Also sync to Firebase
                if (currentBoardId && currentBoardId !== 'new') {
                    syncBoardToFirebase(currentBoardId, boardData);
                }
            } else if (!result.canceled) {
                console.error('Save failed:', result.error);
            }
        }
        closeContextMenu();
    }, [items, groups, arrows, paths, connections, settings, penSettings, closeContextMenu, currentBoardId]);

    const handleSaveAs = useCallback(async () => {
        // Convert all media items to base64 before saving
        const itemsWithBase64 = await Promise.all(items.map(async (item) => {
            if (item.type === 'image' || item.type === 'video') {
                // For videos, if we have a driveFileId, we rely on it and DON'T convert to base64 (too big)
                if (item.type === 'video' && item.driveFileId) {
                    return item;
                }
                const urlToConvert = item.url || (item as any).src;
                if (urlToConvert) {
                    const base64Src = await convertMediaToBase64(urlToConvert);
                    return { ...item, url: base64Src, src: undefined }; // Normalize to url
                }
            }
            return item;
        }));

        const boardData = {
            version: '1.0',
            items: itemsWithBase64,
            groups,
            arrows,
            paths,
            settings,
            penSettings
        };

        if (window.electronAPI?.saveFileAs) {
            const result = await window.electronAPI.saveFileAs(boardData);
            if (result.success) {
                console.log('Board saved to:', result.path);
            } else if (!result.canceled) {
                console.error('Save as failed:', result.error);
            }
        }
        closeContextMenu();
    }, [items, groups, arrows, paths, connections, settings, penSettings, closeContextMenu]);

    const handleLoad = useCallback(async () => {
        if (window.electronAPI?.openFile) {
            const result = await window.electronAPI.openFile();
            if (result.success && result.data) {
                const data = result.data;

                // Restore items
                if (data.items) {
                    const restoredItems = await Promise.all(data.items.map(async (item: any) => {
                        // Normalize src to url
                        let url = item.url || item.src;

                        // Restore from Base64
                        if (url && url.startsWith('data:')) {
                            url = convertBase64ToBlobUrl(url);
                        }

                        // Restore from Google Drive (Video/Image) if URL is invalid/blob or missing
                        if (item.driveFileId && user) {
                            try {
                                const driveUrl = await loadImageFromDrive(item.driveFileId, false);
                                url = driveUrl;
                            } catch (err) {
                                console.warn('Failed to restore item from Drive:', item.driveFileId, err);
                            }
                        }

                        return { ...item, url: url, src: url }; // Keep src for legacy compatibility
                    }));
                    setItems(restoredItems);
                }

                if (data.groups) setGroups(data.groups);
                if (data.arrows) setArrows(data.arrows);
                if (data.paths) setPaths(data.paths);
                if (data.settings) setSettings(data.settings);
                if (data.penSettings) setPenSettings(data.penSettings);
                setSelectedIds([]);
                setSelectedArrowIds([]);
                console.log('Board loaded from:', result.path);
            } else if (!result.canceled) {
                console.error('Load failed:', result.error);
            }
        }
        closeContextMenu();
    }, [setGroups, setArrows, closeContextMenu, user]);

    const handleLoadFromFile = useCallback(async (file: File) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Restore items
            if (data.items) {
                const restoredItems = await Promise.all(data.items.map(async (item: any) => {
                    // Normalize src to url
                    let url = item.url || item.src;

                    // Restore from Base64
                    if (url && url.startsWith('data:')) {
                        url = convertBase64ToBlobUrl(url);
                    }

                    // Restore from Google Drive
                    if (item.driveFileId && user) {
                        try {
                            const driveUrl = await loadImageFromDrive(item.driveFileId, false);
                            url = driveUrl;
                        } catch (err) {
                            console.warn('Failed to restore item from Drive:', item.driveFileId, err);
                        }
                    }

                    return { ...item, url: url, src: url };
                }));
                setItems(restoredItems);
            }

            if (data.groups) setGroups(data.groups);
            if (data.arrows) setArrows(data.arrows);
            if (data.paths) setPaths(data.paths);
            if (data.connections) setConnections(data.connections);
            if (data.settings) setSettings(data.settings);
            if (data.penSettings) setPenSettings(data.penSettings);
            setSelectedIds([]);
            setSelectedArrowIds([]);
            console.log('Board loaded from file:', file.name);
        } catch (error) {
            console.error('Failed to load board file:', error);
        }
    }, [setGroups, setArrows, user]);

    const handlePaste = useCallback(async (e?: ClipboardEvent | React.ClipboardEvent) => {
        // First, try to read from system clipboard
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Helper function to process image blob or base64
        const processImageBlob = async (blob: Blob, fileName: string = `pasted-image-${Date.now()}.png`) => {
            const file = new File([blob], fileName, { type: blob.type });
            let url = URL.createObjectURL(file);

            let x: number;
            let y: number;

            // Use global mouse position if available
            const mouseX = lastMousePositionRef.current.x;
            const mouseY = lastMousePositionRef.current.y;
            console.log('Blob Paste using Mouse Pos:', mouseX, mouseY);

            if (mouseX !== 0 || mouseY !== 0) {
                x = (mouseX - viewport.x) / viewport.scale - 150; // Center 300px width (approx)
                y = (mouseY - viewport.y) / viewport.scale - 100; // Center 200px height (approx)
            } else {
                // Fallback to canvas center
                x = (window.innerWidth / 2 - viewport.x) / viewport.scale - 150;
                y = (window.innerHeight / 2 - viewport.y) / viewport.scale - 100;
            }

            let driveFileId: string | undefined = undefined;
            if (user) {
                try {
                    const base64Url = await convertMediaToBase64(url);
                    driveFileId = await uploadImageToDrive(base64Url, file.name, currentBoardId || undefined, boardName);
                    console.log('Pasted image uploaded to Drive:', driveFileId);
                    // Use base64 URL for display
                    url = base64Url;
                } catch (err) {
                    console.error('Failed to upload pasted image to Drive:', err);
                    // Fallback to base64
                    url = await convertMediaToBase64(url);
                }
            } else {
                // Not logged in, convert to base64
                url = await convertMediaToBase64(url);
            }

            const newImage: MediaItemData = {
                id: `image-${Date.now()}`,
                type: 'image',
                src: url,
                url: url,
                x,
                y,
                width: 300,
                height: 200,
                zIndex: items.length + 1,
                fileName: file.name,
                driveFileId,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false
            };

            saveToHistory();
            setItems(prev => [...prev, newImage]);
            setSelectedIds([newImage.id]);

            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItem(currentBoardId, newImage.id, newImage);
            }

            console.log('Pasted image from clipboard');
            closeContextMenu();
        };

        // Helper function to process base64 image (from Electron clipboard)
        const processBase64Image = async (base64Data: string, width: number, height: number) => {
            // Get canvas center position for pasting
            const canvasRect = document.querySelector('.canvas-content')?.getBoundingClientRect();
            const x = canvasRect ? (canvasRect.width / 2) - 150 : 100;
            const y = canvasRect ? (canvasRect.height / 2) - 100 : 100;

            let driveFileId: string | undefined = undefined;
            let url = base64Data;

            if (user) {
                try {
                    driveFileId = await uploadImageToDrive(base64Data, `pasted-image-${Date.now()}.png`, currentBoardId || undefined, boardName);
                    console.log('Pasted image uploaded to Drive:', driveFileId);
                } catch (err) {
                    console.error('Failed to upload pasted image to Drive:', err);
                }
            }

            const newImage: MediaItemData = {
                id: `image-${Date.now()}`,
                type: 'image',
                src: url,
                url: url,
                x,
                y,
                width: width || 300,
                height: height || 200,
                zIndex: items.length + 1,
                fileName: `pasted-image-${Date.now()}.png`,
                driveFileId,
                rotation: 0,
                flipHorizontal: false,
                flipVertical: false
            };

            saveToHistory();
            setItems(prev => [...prev, newImage]);
            setSelectedIds([newImage.id]);

            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItem(currentBoardId, newImage.id, newImage);
            }

            console.log('Pasted image from Electron clipboard');
            closeContextMenu();
        };

        // First, check internal clipboard (canvas copy/paste) - takes priority
        // If internal clipboard exists, paste it and clear it
        if (clipboard.length > 0) {
            // Process pasted items - upload PSD PNGs to Drive with unique names
            const newItems = await Promise.all(clipboard.map(async (item, index) => {
                const newItem: BoardItem = {
                    ...item,
                    id: `${item.type}-${Date.now()}-${index}`,
                    x: item.x + 20,
                    y: item.y + 20,
                    zIndex: items.length + index + 1
                };

                // Handle PSD files: upload PNG to Drive with unique name (_copy01 suffix)
                if (newItem.type === 'image') {
                    const mediaItem = newItem as MediaItemData;

                    // 원본 PSD 파일을 참조하는 이미지인지 확인 (originalFilePath가 있으면 원본 PSD 파일)
                    const isOriginalPSDFile = mediaItem.originalFilePath && mediaItem.originalFilePath.length > 0;

                    // 원본 PSD 파일을 참조하는 이미지만 Drive에 복제
                    if (isOriginalPSDFile && mediaItem.src && typeof mediaItem.src === 'string') {
                        try {
                            let base64Data: string;

                            if (mediaItem.src.startsWith('blob:')) {
                                const response = await fetch(mediaItem.src);
                                const blob = await response.blob();
                                base64Data = await new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.readAsDataURL(blob);
                                });
                            } else if (mediaItem.src.startsWith('data:')) {
                                base64Data = mediaItem.src;
                            } else {
                                return newItem; // Skip if unknown format
                            }

                            // Generate PNG filename from PSD filename
                            const pngFileName = (mediaItem.fileName || `psd-${mediaItem.id}.png`).replace(/\.psd$/i, '.png');
                            // Don't overwrite - generate unique name with _copy01 suffix
                            const driveFileId = await uploadOrUpdateImageInDrive(base64Data, pngFileName, false, currentBoardId || undefined);
                            console.log('Pasted PSD PNG uploaded to Drive:', driveFileId, pngFileName);

                            // Remove originalFilePath for pasted items (they are copies, not original files)
                            // Keep src for immediate display, also store driveFileId
                            return { ...mediaItem, driveFileId, src: base64Data, originalFilePath: undefined };
                        } catch (err) {
                            console.error('Failed to upload pasted PSD PNG to Drive:', err);
                            return newItem;
                        }
                    } else {
                        // 일반 이미지 또는 이미 복제된 이미지의 경우: driveFileId를 그대로 유지하여 같은 Drive 파일을 공유
                        // originalFilePath만 제거 (복사본이므로 원본 파일 경로는 없음)
                        // src도 그대로 유지하여 Drive에서 다시 다운로드하지 않도록 함 (성능 최적화)
                        // 이렇게 하면 Drive에 복제본이 생성되지 않고, 같은 파일을 참조하며 즉시 표시됨
                        return { ...mediaItem, originalFilePath: undefined };
                    }
                }

                return newItem;
            }));

            saveToHistory(); // Save state before pasting
            setItems(prev => [...prev, ...newItems]);
            setSelectedIds(newItems.map(item => item.id));

            // Clear drag start positions for newly pasted items
            // They will be initialized on first drag with the correct Rnd position (data.x, data.y)
            // This prevents jump because dragStart will match the first drag position
            newItems.forEach(item => {
                delete itemDragStartRef.current[item.id];
            });

            // Sync to Firebase
            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItems(currentBoardId, newItems);
            }

            console.log('Pasted', newItems.length, 'items from internal clipboard');

            // Clear internal clipboard after pasting
            setClipboard([]);

            closeContextMenu();
            return;
        }

        // If no internal clipboard, try external clipboard (system clipboard - Windows Snipping Tool, etc.)
        // First, try Electron's native clipboard API (best for Windows Snipping Tool, etc.)
        if (window.electronAPI?.readClipboardImage) {
            try {
                console.log('Attempting to read image from Electron clipboard API...');
                const result = await window.electronAPI.readClipboardImage();
                if (result.success && result.data) {
                    console.log('Successfully read image from Electron clipboard:', result.width, 'x', result.height);
                    await processBase64Image(result.data, result.width || 300, result.height || 200);
                    return;
                }
            } catch (err) {
                console.log('Failed to read image from Electron clipboard API:', err);
                // Continue to other methods
            }
        }

        // Try to paste image from clipboard event data
        if (e?.clipboardData) {
            const items = e.clipboardData.items;

            // Check for image in clipboard
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // Handle image paste
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        console.log('Found image in clipboard event data:', item.type, blob.size);
                        await processImageBlob(blob);
                        return;
                    }
                }
            }
        }

        // If no image found in event data, try reading from system clipboard API (for web browsers)
        // Note: Electron already handled via native API above, this is for web compatibility
        if (window.navigator.clipboard && typeof window.navigator.clipboard.read === 'function') {
            try {
                console.log('Attempting to read image from clipboard API...');
                const clipboardItems = await navigator.clipboard.read();
                console.log('Clipboard items:', clipboardItems.length);

                for (const clipboardItem of clipboardItems) {
                    console.log('Clipboard item types:', clipboardItem.types);
                    // Check for image types
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            console.log('Found image type in clipboard:', type);
                            const blob = await clipboardItem.getType(type);
                            if (blob) {
                                console.log('Successfully read image blob:', blob.size, 'bytes');
                                const extension = type.split('/')[1] || 'png';
                                await processImageBlob(blob, `pasted-image-${Date.now()}.${extension}`);
                                return;
                            }
                        }
                    }
                }
            } catch (err) {
                console.log('Failed to read image from clipboard API:', err);
                // Continue to text paste fallback
            }
        }

        // Try to paste text from clipboard
        let textData = e?.clipboardData?.getData('text/plain');

        // If no text found in event data, try reading from system clipboard directly
        if (!textData && window.navigator.clipboard) {
            try {
                textData = await navigator.clipboard.readText();
            } catch (err) {
                console.warn('Failed to read text from clipboard:', err);
            }
        }

        if (textData && textData.trim().length > 0) {
            // Get canvas center position for pasting
            const canvasRect = document.querySelector('.canvas-content')?.getBoundingClientRect();
            const x = canvasRect ? (canvasRect.width / 2) - 100 : 100;
            const y = canvasRect ? (canvasRect.height / 2) - 25 : 100;

            // Calculate font size based on canvas zoom level
            // Base font size is 16px at 100% zoom (scale = 1.0)
            // When zoomed out (scale < 1), font size increases to remain visible
            const baseFontSize = 16;
            const dynamicFontSize = Math.max(8, Math.min(200, baseFontSize / viewport.scale));

            const newText: TextItemData = {
                id: `text-${Date.now()}`,
                type: 'text',
                content: textData,
                x,
                y,
                width: 200,
                height: 50,
                fontSize: dynamicFontSize,
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                zIndex: items.length + 1
            };

            saveToHistory();
            setItems(prev => [...prev, newText]);
            setSelectedIds([newText.id]);
            setNewlyCreatedTextIds(prev => new Set(prev).add(newText.id));

            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItem(currentBoardId, newText.id, newText);
            }

            console.log('Pasted text from clipboard');
            closeContextMenu();
            return;
        }

        closeContextMenu();
    }, [clipboard, items.length, closeContextMenu, currentBoardId, saveToHistory, user, convertMediaToBase64, setClipboard, setItems, setSelectedIds, setNewlyCreatedTextIds, updateRemoteItem, updateRemoteItems, isUiVisible]);

    // Dedicated UI Toggle Handler
    useEffect(() => {
        const handleUiToggle = (e: KeyboardEvent) => {
            // Don't handle shortcuts if user is editing text (contentEditable) or input fields
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            if ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                // Allow toggling even if settings is open, or maybe not? 
                // If settings is open, user might be typing a shortcut?
                // The settings modal input blocks propagation? 
                // Let's allow it generally but maybe check check for an active input first (already done above)

                e.preventDefault();
                console.log('UseEffect Toggle UI Triggered');
                setIsUiVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleUiToggle);
        return () => window.removeEventListener('keydown', handleUiToggle);
    }, []); // No dependencies needed for functional update

    // General Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            console.log('Key:', e.key, 'Ctrl:', e.ctrlKey, 'Settings:', isSettingsOpen, 'Target:', e.target);

            // Don't handle shortcuts if settings modal is open
            if (isSettingsOpen) return;

            // Don't handle shortcuts if user is editing text (contentEditable) or input fields
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                // Don't handle any keyboard shortcuts when editing text or input fields
                // This prevents Delete/Backspace from deleting items while editing
                return;
            }

            // Toggle UI Visibility (U) handled in separate effect to avoid dependency hell


            // Save (Ctrl+S)
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
                return;
            }

            // Save As (Ctrl+Shift+S)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                e.stopPropagation();
                handleSaveAs();
                return;
            }

            // Open (Ctrl+O)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                e.stopPropagation();
                handleLoad();
                return;
            }

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIds.length > 0) {
                    // 1. Internal Clipboard Logic
                    const itemsToCopy = items.filter(item => selectedIds.includes(item.id));
                    setClipboard(itemsToCopy);
                    console.log('Copied', itemsToCopy.length, 'items');

                    // 2. System Clipboard Logic (for Image Copy)
                    // Only handle if exactly one item is selected (for now)
                    if (selectedIds.length === 1) {
                        const selectedItem = items.find(i => i.id === selectedIds[0]);
                        if (selectedItem && selectedItem.type === 'image') {
                            (async () => {
                                try {
                                    // Determine source URL
                                    const src = selectedItem.src || selectedItem.url;
                                    if (!src) return;

                                    console.log('Attempting to copy image to system clipboard:', src);

                                    // Try Electron Native Copy (Best for CORS/Drive images)
                                    if (window.electronAPI?.copyImageToClipboard) {
                                        try {
                                            let targetUrl = src;

                                            // Critical: Main process cannot fetch blob: URLs. Convert to base64 first.
                                            if (src.startsWith('blob:')) {
                                                console.log('Converting blob URL to base64 for IPC...');
                                                const response = await fetch(src);
                                                const blob = await response.blob();
                                                targetUrl = await new Promise<string>((resolve) => {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => resolve(reader.result as string);
                                                    reader.readAsDataURL(blob);
                                                });
                                            }

                                            console.log('Using Electron Native Clipboard Copy...');
                                            const result = await window.electronAPI.copyImageToClipboard(targetUrl);
                                            if (result.success) {
                                                console.log('Image copied via Electron:', selectedItem.id);
                                                return;
                                            } else {
                                                console.warn('Electron copy failed, falling back to Web API:', result.error);
                                            }
                                        } catch (ipcErr) {
                                            console.error('IPC preparation failed:', ipcErr);
                                        }
                                    }

                                    // Web API Fallback
                                    const response = await fetch(src);
                                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

                                    const blob = await response.blob();

                                    if (blob) {
                                        await navigator.clipboard.write([
                                            new ClipboardItem({
                                                [blob.type]: blob
                                            })
                                        ]);
                                        console.log('Image copied to system clipboard (Web API):', selectedItem.id);
                                    }
                                } catch (err) {
                                    console.error('Failed to copy image to system clipboard:', err);
                                    alert('이미지 복사 실패: ' + (err instanceof Error ? err.message : String(err)));
                                }
                            })();
                        }
                    }
                }
                return;
            }

            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();
                e.stopPropagation();
                handlePaste();
                return;
            }

            // Undo (Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleUndo();
                return;
            }

            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                e.preventDefault();
                e.stopPropagation();
                handleRedo();
                return;
            }

            // Grouping (Ctrl+G)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIds.length >= 2) {
                    const groupItems = items.filter(item => selectedIds.includes(item.id));
                    if (groupItems.length >= 2) {
                        createGroup(selectedIds, groupItems);
                        setSelectedIds([]);
                    }
                }
                return;
            }

            // Delete key handler
            // Arrow Keys for Video Frame Navigation
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                // Only if exactly one item selected and it's a video
                if (selectedIds.length === 1) {
                    const selectedItem = items.find(i => i.id === selectedIds[0]);
                    if (selectedItem && selectedItem.type === 'video') {
                        e.preventDefault();
                        e.stopPropagation();

                        // Find the video element
                        const videoElement = document.querySelector(`[data-item-id="${selectedItem.id}"] video`) as HTMLVideoElement;
                        if (videoElement) {
                            // Calculate frame duration (assuming 30fps)
                            const frameDuration = 1 / 30;

                            if (e.key === 'ArrowLeft') {
                                videoElement.currentTime = Math.max(0, videoElement.currentTime - frameDuration);
                            } else {
                                videoElement.currentTime = Math.min(videoElement.duration || 0, videoElement.currentTime + frameDuration);
                            }
                        }
                        return;
                    }
                }
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Filter out non-deletable items (like Ads)
                const itemsToDelete = items.filter(item =>
                    selectedIds.includes(item.id) && item.type !== 'ad'
                );

                const idsToDelete = itemsToDelete.map(i => i.id);

                if (idsToDelete.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    saveToHistory(); // Save state before deleting

                    // Delete images/videos from Google Drive only if no other items are using the same driveFileId
                    itemsToDelete.forEach(item => {
                        if ((item.type === 'image' || item.type === 'video') && 'driveFileId' in item && (item as MediaItemData).driveFileId) {
                            const driveFileId = (item as MediaItemData).driveFileId!;

                            // Check if any other items (not being deleted) are using the same driveFileId
                            const otherItemsUsingSameFile = items.filter(otherItem =>
                                otherItem.id !== item.id &&
                                !idsToDelete.includes(otherItem.id) &&
                                (otherItem.type === 'image' || otherItem.type === 'video') &&
                                'driveFileId' in otherItem &&
                                (otherItem as MediaItemData).driveFileId === driveFileId
                            );

                            // Only delete from Drive if no other items are using this file
                            if (otherItemsUsingSameFile.length === 0) {
                                deleteImageFromDrive(driveFileId).catch(err => {
                                    console.error('Failed to delete image from Drive:', err);
                                });
                            } else {
                                console.log(`Skipping Drive deletion for ${driveFileId}: ${otherItemsUsingSameFile.length} other items are using this file`);
                            }
                        }
                    });

                    setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));
                    idsToDelete.forEach(id => {
                        if (id.startsWith('group-')) deleteGroup(id);
                        deleteArrowsForItem(id);

                        // Sync to Firebase
                        if (currentBoardId && currentBoardId !== 'new') {
                            deleteRemoteItem(currentBoardId, id);
                        }
                    });

                    // Clear selection only if everything selected was deleted
                    // If Ad was selected, keep it selected (or clear all? usually clear all is fine)
                    setSelectedIds([]);
                } else if (selectedArrowIds.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    saveToHistory(); // Save state before deleting arrows
                    selectedArrowIds.forEach(id => deleteArrow(id));
                    setSelectedArrowIds([]);
                }
                return;
            }

            // Brush size adjustment (only when pen or eraser tool is active)
            if (activeTool === 'pen' || activeTool === 'eraser') {
                // Check if the key matches the configured shortcuts
                const decreaseMatch = settings.brushSizeDecrease
                    ? isShortcutMatch(e, settings.brushSizeDecrease)
                    : e.key === '[';
                const increaseMatch = settings.brushSizeIncrease
                    ? isShortcutMatch(e, settings.brushSizeIncrease)
                    : e.key === ']';

                if (decreaseMatch) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeTool === 'pen') {
                        setPenSettings(prev => ({ ...prev, size: Math.max(1, prev.size - 1) }));
                    } else {
                        setPenSettings(prev => ({ ...prev, eraserSize: Math.max(1, prev.eraserSize - 1) }));
                    }
                    return;
                }

                if (increaseMatch) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeTool === 'pen') {
                        setPenSettings(prev => ({ ...prev, size: Math.min(50, prev.size + 1) }));
                    } else {
                        setPenSettings(prev => ({ ...prev, eraserSize: Math.min(50, prev.eraserSize + 1) }));
                    }
                    return;
                }
            }

            // Tools (only when not using Ctrl)
            if (!e.ctrlKey && !e.metaKey) {
                if (e.key.toLowerCase() === 'v') setActiveTool('select');
                if (e.key.toLowerCase() === 't') setActiveTool('text');
                if (e.key.toLowerCase() === 'a') setActiveTool('arrow');
                if (e.key.toLowerCase() === 'p') setActiveTool('pen');
                if (e.key.toLowerCase() === 'e') setActiveTool('eraser');
            }
        };

        // Use capture phase to ensure we get the event first
        // Add to both document and window for maximum compatibility
        document.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [
        items,
        selectedIds,
        clipboard,
        isSettingsOpen,
        history,
        historyIndex,
        handleSave,
        handleSaveAs,
        handleLoad,
        handlePaste,
        handleUndo,
        handleRedo,
        createGroup,
        setClipboard,
        setSelectedIds,
        saveToHistory,
        isUiVisible
    ]);

    // Paste event listener for system clipboard
    useEffect(() => {
        const handlePasteEvent = (e: ClipboardEvent) => {
            // Don't handle paste if user is editing text or input fields
            const target = e.target as HTMLElement;
            if (target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            // Don't handle if settings modal is open
            if (isSettingsOpen) return;

            // Check if Ctrl+V or Cmd+V is pressed by checking the event's originalEvent or using a flag
            // Since ClipboardEvent doesn't have ctrlKey, we'll handle all paste events when not in input fields
            handlePaste(e);
        };

        document.addEventListener('paste', handlePasteEvent);
        return () => {
            document.removeEventListener('paste', handlePasteEvent);
        };
    }, [handlePaste, isSettingsOpen]);

    const handleCanvasDrop = useCallback((e: React.DragEvent & { canvasX?: number; canvasY?: number }) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);

        // Check for .refboard files first
        const refboardFiles = files.filter(file =>
            file.name.endsWith('.refboard') || file.type === 'application/json'
        );

        if (refboardFiles.length > 0) {
            // Load the first .refboard file
            handleLoadFromFile(refboardFiles[0]);
            return;
        }

        // Handle image/video files (including PSD)
        const validFiles = files.filter(file => {
            const fileName = file.name.toLowerCase();
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/') ||
                fileName.endsWith('.mp4') ||
                fileName.endsWith('.webm') ||
                fileName.endsWith('.mov') ||
                fileName.endsWith('.avi') ||
                fileName.endsWith('.mkv');
            const isPSD = fileName.endsWith('.psd');
            return isImage || isVideo || isPSD;
        });

        if (validFiles.length === 0) return;

        const columns = Math.ceil(Math.sqrt(validFiles.length));
        const itemWidth = 300;
        const itemHeight = 200;
        const spacing = 0;

        // Use transformed coordinates if available
        let dropX: number, dropY: number;
        if (e.canvasX !== undefined && e.canvasY !== undefined) {
            dropX = e.canvasX;
            dropY = e.canvasY;
        } else {
            // Fallback to client coordinates (should not happen if Canvas handles it correctly)
            dropX = e.clientX;
            dropY = e.clientY;
        }

        // Process files asynchronously
        const processFiles = async () => {
            const newItems = await Promise.all(validFiles.map(async (file, index) => {
                const fileName = file.name.toLowerCase();
                const isPSD = fileName.endsWith('.psd');
                const isImage = file.type.startsWith('image/') || isPSD;

                // Fix missing video MIME types (Common on Windows for dropped files)
                let sourceFile = file;
                const extension = fileName.split('.').pop();
                if (file.type === '' && extension) {
                    let newType = '';
                    if (extension === 'mp4') newType = 'video/mp4';
                    else if (extension === 'webm') newType = 'video/webm';
                    else if (extension === 'mov') newType = 'video/quicktime';
                    else if (extension === 'avi') newType = 'video/x-msvideo';
                    else if (extension === 'mkv') newType = 'video/x-matroska';

                    if (newType) {
                        sourceFile = new File([file], file.name, { type: newType });
                    }
                }

                let url = URL.createObjectURL(sourceFile);

                // Upload image/video to Google Drive and get file ID
                let driveFileId: string | undefined = undefined;
                const isVideo = file.type.startsWith('video/') ||
                    fileName.endsWith('.mp4') ||
                    fileName.endsWith('.webm') ||
                    fileName.endsWith('.mov') ||
                    fileName.endsWith('.avi') ||
                    fileName.endsWith('.mkv');
                if ((isImage || isVideo) && !isPSD && user) {
                    try {
                        if (isVideo) {
                            // Upload video file directly (no base64 conversion)
                            driveFileId = await uploadOrUpdateMediaInDrive(file, file.name, false, true, currentBoardId || undefined, boardName);
                            if (!driveFileId || driveFileId.trim() === '') {
                                throw new Error('Video upload failed: No file ID returned');
                            }
                            console.log('Video uploaded to Drive:', driveFileId, 'File:', file.name);
                        } else {
                            // Convert image to base64 first for upload
                            const base64Url = await convertMediaToBase64(url);
                            driveFileId = await uploadImageToDrive(base64Url, file.name, currentBoardId || undefined, boardName);
                            console.log('Image uploaded to Drive:', driveFileId);
                        }
                        // Keep blob URL for immediate display, Drive ID will be used for sync
                        // Don't replace url, keep it for local display

                        // FIX: Fetch the actual Drive URL immediately so we don't save blob: URL to the shared state
                        if (driveFileId) {
                            try {
                                const validDriveUrl = await loadImageFromDrive(driveFileId, false, isVideo);
                                if (validDriveUrl) {
                                    console.log('Replacing blob URL with Drive URL for sync:', validDriveUrl);
                                    // Revoke the old blob URL as it is no longer needed
                                    const oldUrl = url;
                                    URL.revokeObjectURL(oldUrl);

                                    url = validDriveUrl;
                                }
                            } catch (urlErr) {
                                console.warn('Failed to fetch Drive URL after upload, falling back to blob/base64:', urlErr);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to upload media to Drive:', err);
                        // Fallback: convert to base64 for sync (only for images)
                        if (!isVideo) {
                            try {
                                url = await convertMediaToBase64(url);
                            } catch (base64Err) {
                                console.error('Failed to convert dropped file to base64:', base64Err);
                            }
                        }
                    }
                } else if (!isPSD && !isVideo) {
                    // For non-image/video files or when not logged in, convert to base64
                    try {
                        url = await convertMediaToBase64(url);
                    } catch (err) {
                        console.error('Failed to convert dropped file to base64:', err);
                    }
                }

                let originalFilePath: string | undefined = undefined;

                // If PSD file, try to get original file path first
                // In Electron, File objects may have a 'path' property
                if (isPSD) {
                    // Try to get original file path from File object (Electron-specific)
                    let filePath: string | undefined = undefined;

                    // 1. Try modern webUtils method (via exposed API)
                    if (window.electronAPI?.getPathForFile) {
                        try {
                            filePath = window.electronAPI.getPathForFile(file);
                            console.log('Got path via webUtils:', filePath);
                        } catch (e) {
                            console.warn('Failed to get path via webUtils:', e);
                        }
                    }

                    // 2. Fallback to legacy path property
                    if (!filePath && (file as any).path) {
                        filePath = (file as any).path;
                        console.log('Got path via file.path:', filePath);
                    }

                    if (filePath && typeof filePath === 'string') {
                        // Use original file path directly
                        originalFilePath = filePath;
                        console.log('PSD file original path:', filePath);

                        // Start watching the original file for changes
                        if (window.electronAPI?.watchPSDFile) {
                            await window.electronAPI.watchPSDFile(filePath);
                        }
                    } else if (window.electronAPI?.savePSDFile) {
                        // Fallback: save to temp directory if path not available
                        try {
                            const arrayBuffer = await file.arrayBuffer();
                            const result = await window.electronAPI.savePSDFile(arrayBuffer, file.name);
                            if (result.success && result.path) {
                                originalFilePath = result.path;
                                console.log('PSD file saved to temp:', result.path, 'for file:', file.name);

                                // Start watching the file for changes
                                if (window.electronAPI?.watchPSDFile) {
                                    await window.electronAPI.watchPSDFile(result.path);
                                }
                            } else {
                                console.error('Failed to save PSD file:', result.error);
                            }
                        } catch (error) {
                            console.error('Failed to save PSD file:', error);
                        }
                    } else {
                        console.warn('PSD file detected but savePSDFile API not available');
                    }
                }

                // If PSD file, convert to PNG and upload to Drive
                if (isPSD && user) {
                    try {
                        const { convertPSDToImage } = await import('./utils/psdParser');
                        const imageUrl = await convertPSDToImage(file);
                        if (imageUrl) {
                            url = imageUrl; // Use converted PNG for display

                            // Upload PNG to Drive (overwrite if same name exists)
                            try {
                                // Generate PNG filename from PSD filename
                                const pngFileName = file.name.replace(/\.psd$/i, '.png');
                                // Overwrite if same name exists (same PSD file should update the PNG)
                                driveFileId = await uploadOrUpdateImageInDrive(imageUrl, pngFileName, true, currentBoardId || undefined, boardName);
                                console.log('PSD converted to PNG and uploaded to Drive:', driveFileId, pngFileName);
                            } catch (driveErr) {
                                console.error('Failed to upload PSD PNG to Drive:', driveErr);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to convert PSD to image:', error);
                    }
                }

                // Load actual dimensions for images and videos
                let actualWidth = itemWidth;
                let actualHeight = itemHeight;

                if (isImage && url) {
                    try {
                        const dimensions = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                            img.onerror = () => reject(new Error('Failed to load image'));
                            img.src = url;
                        });
                        actualWidth = dimensions.width;
                        actualHeight = dimensions.height;
                    } catch (err) {
                        console.warn('Failed to get image dimensions, using defaults:', err);
                    }
                } else if (isVideo && url) {
                    try {
                        const dimensions = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                            const video = document.createElement('video');
                            video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
                            video.onerror = () => reject(new Error('Failed to load video'));
                            video.src = url;
                        });
                        actualWidth = dimensions.width;
                        actualHeight = dimensions.height;
                    } catch (err) {
                        console.warn('Failed to get video dimensions, using defaults:', err);
                    }
                }

                const col = index % columns;
                const row = Math.floor(index / columns);
                const gridX = col * (actualWidth + spacing);
                const gridY = row * (actualHeight + spacing);

                return {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
                    type: (isImage ? 'image' : 'video') as 'image' | 'video',
                    url: url, // Correct property name matching types.ts
                    driveFileId: driveFileId, // Google Drive file ID for sync
                    fileName: file.name,
                    originalFilePath,
                    x: dropX + gridX,
                    y: dropY + gridY,
                    width: actualWidth,
                    height: actualHeight,
                    zIndex: items.length + index + 1,
                    rotation: 0,
                    flipHorizontal: false,
                    flipVertical: false
                } as MediaItemData;
            }));

            saveToHistory(); // Save state before adding files
            setItems(prev => [...prev, ...newItems]);

            // Sync to Firebase
            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItems(currentBoardId, newItems);
            }
        };

        processFiles();
    }, [items, handleLoadFromFile, convertMediaToBase64, currentBoardId, saveToHistory]);





    const handleCanvasClick = (e: React.MouseEvent & { canvasX?: number; canvasY?: number }) => {
        if (typeof e.canvasX !== 'number' || typeof e.canvasY !== 'number' || isNaN(e.canvasX) || isNaN(e.canvasY)) return;

        if (activeTool === 'text') {
            // Use transformed coordinates if available
            let x: number, y: number;
            if (e.canvasX !== undefined && e.canvasY !== undefined && !isNaN(e.canvasX) && !isNaN(e.canvasY)) {
                x = e.canvasX;
                y = e.canvasY;
            } else {
                // Fallback: should not happen if Canvas handles it correctly
                console.warn('Canvas click without transformed coordinates');
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }

            // Calculate font size based on canvas zoom level
            // Base font size is 16px at 100% zoom (scale = 1.0)
            // When zoomed out (scale < 1), font size increases to remain visible
            const baseFontSize = 16;
            const dynamicFontSize = Math.max(8, Math.min(200, baseFontSize / viewport.scale));

            const newText: TextItemData = {
                id: `text-${Date.now()}`,
                type: 'text',
                content: '',  // Start with empty content for immediate typing
                x,
                y,
                width: 200,
                height: 50,
                fontSize: dynamicFontSize,
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                zIndex: items.length + 1
            };
            saveToHistory(); // Save state before adding text
            setItems(prev => [...prev, newText]);

            // Mark this text as newly created for auto-focus
            setNewlyCreatedTextIds(prev => new Set(prev).add(newText.id));

            // Sync to Firebase (New item, so we send the whole thing as changes)
            if (currentBoardId && currentBoardId !== 'new') {
                updateRemoteItem(currentBoardId, newText.id, newText);
            }

            setActiveTool('select');
        } else if (activeTool === 'select') {
            const target = e.target as HTMLElement;

            // Use imperative hit testing for true 2D Canvas items
            if (typeof e.canvasX === 'number' && typeof e.canvasY === 'number') {
                const hitId = canvasItemLayerRef.current?.getItemAt(e.canvasX, e.canvasY);

                if (hitId) {
                    // If clicked an item, select it
                    // Handle Ctrl/Shift click for multi-selection
                    const isCtrl = e.ctrlKey || e.metaKey;
                    const isShift = e.shiftKey;
                    handleSelect(hitId, isCtrl, isShift);
                    return;
                }
            }

            // Only clear if we didn't click on an item (or its children)
            // We check for data-item-id attribute which should be on the item wrapper (for DOM items)
            // AND check if we hit anything on canvas
            if (!target.closest('[data-item-id]') && !target.closest('.group')) {
                setSelectedIds([]);
            }
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent & { canvasX: number; canvasY: number; pressure?: number }) => {
        if (isNaN(e.canvasX) || isNaN(e.canvasY)) return;

        // 1. Tool-based interactions (Pen/Eraser)
        if (activeTool === 'pen' || activeTool === 'eraser') {
            const newPath: DrawingPath = {
                id: Date.now().toString(),
                points: [{ x: e.canvasX, y: e.canvasY, pressure: e.pressure }],
                color: penSettings.color,
                size: activeTool === 'pen' ? penSettings.size : penSettings.eraserSize,
                isEraser: activeTool === 'eraser'
            };

            // Set ref only - avoid state update for performance
            // Actually, let's keep state null during drag to avoid ANY re-renders, and only set it on end?
            // No, we need currentPath state for DrawingLayer prop maybe?
            // No, DrawingLayer handles things imperatively now. 
            // set currentPath to newPath to indicate "drawing active" but DON'T update it on move.
            setCurrentPath(newPath);
            currentPathRef.current = newPath; // CRITICAL: Update Ref immediately for Move handler

            // Use imperative API for smooth drawing
            if (drawingLayerRef.current) {
                drawingLayerRef.current.startPath(newPath);
            }
            return; // Exit early for drawing tool
        }

        // 2. Select Tool Interaction (Drag-to-Move)
        if (activeTool === 'select') {
            // Hit test using Canvas 2D
            const hitId = canvasItemLayerRef.current?.getItemAt(e.canvasX, e.canvasY);

            if (hitId) {
                // Determine if we need to select the item
                // If it's already selected, don't change selection (allows moving multiple items)
                // If it's NOT selected, select it (exclusive unless Shift/Ctrl)
                const isSelected = selectedIds.includes(hitId);
                const isCtrl = e.ctrlKey || e.metaKey;
                const isShift = e.shiftKey;
                const isAlt = e.altKey;

                // Ctrl+Alt+Click = Scale mode
                if (isCtrl && isAlt && activeTool === 'select') {
                    const targetIds = isSelected ? selectedIds : [...selectedIds, hitId];
                    const itemDimensions: Record<string, { x: number; y: number; width: number; height: number }> = {};

                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                    targetIds.forEach(id => {
                        const item = items.find(i => i.id === id) as any;
                        if (item) {
                            itemDimensions[id] = {
                                x: item.x,
                                y: item.y,
                                width: item.width,
                                height: item.height
                            };
                            minX = Math.min(minX, item.x);
                            minY = Math.min(minY, item.y);
                            maxX = Math.max(maxX, item.x + item.width);
                            maxY = Math.max(maxY, item.y + item.height);
                        }
                    });

                    const centerX = (minX + maxX) / 2;
                    const centerY = (minY + maxY) / 2;

                    scaleStartRef.current = {
                        startX: e.clientX,
                        itemDimensions,
                        centerX,
                        centerY
                    };

                    // Snapshot for history
                    dragStartStateRef.current = {
                        items: JSON.parse(JSON.stringify(items)),
                        groups: JSON.parse(JSON.stringify(groups)),
                        arrows: JSON.parse(JSON.stringify(arrows)),
                        paths: JSON.parse(JSON.stringify(paths))
                    };

                    // If not already selected, select it too
                    if (!isSelected) {
                        setSelectedIds(prev => [...prev, hitId]);
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // Ctrl+Click (without Alt) = Rotation mode
                if (isCtrl && !isAlt && activeTool === 'select') {
                    // Start rotation mode immediately
                    const targetIds = isSelected ? selectedIds : [...selectedIds, hitId];
                    const itemRotations: Record<string, number> = {};
                    targetIds.forEach(id => {
                        const item = items.find(i => i.id === id) as any;
                        if (item) {
                            itemRotations[id] = item.rotation || 0;
                        }
                    });

                    rotationStartRef.current = {
                        startX: e.clientX,
                        itemRotations
                    };

                    // Snapshot for history 
                    dragStartStateRef.current = {
                        items: JSON.parse(JSON.stringify(items)),
                        groups: JSON.parse(JSON.stringify(groups)),
                        arrows: JSON.parse(JSON.stringify(arrows)),
                        paths: JSON.parse(JSON.stringify(paths))
                    };

                    // If not already selected, select it too
                    if (!isSelected) {
                        setSelectedIds(prev => [...prev, hitId]);
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (!isSelected) {
                    if (isShift) {
                        setSelectedIds(prev => [...prev, hitId]);
                    } else {
                        setSelectedIds([hitId]);
                    }
                } else if (isShift) {
                    // Deselect if Shift+Click on selected (Standard behavior)
                    setSelectedIds(prev => prev.filter(id => id !== hitId));
                    return;
                }

                // Initialize Drag State immediately
                itemDragStartRef.current = {};
                const currentTargetIds = isSelected ? selectedIds : [hitId];
                currentTargetIds.forEach(id => {
                    const item = items.find(i => i.id === id);
                    if (item) {
                        itemDragStartRef.current[id] = { x: item.x, y: item.y };
                    }
                });

                // Snapshot for history (Undo/Redo support for drag)
                dragStartStateRef.current = {
                    items: JSON.parse(JSON.stringify(items)),
                    groups: JSON.parse(JSON.stringify(groups)),
                    arrows: JSON.parse(JSON.stringify(arrows)),
                    paths: JSON.parse(JSON.stringify(paths))
                };

                // STORE INITIAL MOUSE POS FOR DELTA CALCULATION
                dragStartMouseRef.current = { x: e.canvasX, y: e.canvasY };

                // Track the primary active item for imperative updates
                activeDragItemIdRef.current = hitId;

                // Allow drag handling (mouseMove will update positions)
                e.preventDefault();
                e.stopPropagation();
            }
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent & { canvasX: number; canvasY: number; pressure?: number; coalescedPoints?: { x: number; y: number; pressure: number }[] }) => {
        if (isNaN(e.canvasX) || isNaN(e.canvasY)) return;

        // Sync cursor position (use the latest position)
        if (currentBoardId && currentBoardId !== 'new' && user) {
            updateCursor(
                currentBoardId,
                user.uid,
                user.displayName || 'Anonymous',
                user.email || 'anonymous@example.com',
                e.canvasX,
                e.canvasY
            );
        }

        // Use Ref for performance - NO READ STATE here
        if (currentPathRef.current) {
            // Use all coalesced points if available, otherwise use single point
            // This ensures 120Hz/240Hz input is fully captured even if events fire at 60Hz
            const pointsToAdd = e.coalescedPoints || [{ x: e.canvasX, y: e.canvasY, pressure: e.pressure }];

            // Use imperative API instead of state update for performance
            if (drawingLayerRef.current) {
                drawingLayerRef.current.addPoints(pointsToAdd);
            }

            // Update Ref MUTABLY
            currentPathRef.current.points.push(...pointsToAdd);

            // CRITICAL: DO NOT calls setCurrentPath here!
            // This prevents re-renders on every mouse move.
        }

        // Handle Item Dragging via Imperative Handler (Performance Fix)
        const dragStartMouse = dragStartMouseRef.current;
        const activeDragId = activeDragItemIdRef.current;

        if (dragStartMouse && activeDragId && itemDragStartRef.current[activeDragId]) {
            const dx = (e.canvasX - dragStartMouse.x);
            const dy = (e.canvasY - dragStartMouse.y);

            const startPos = itemDragStartRef.current[activeDragId];
            if (startPos) {
                // Calculate new absolute position for the active item
                const newX = startPos.x + dx;
                const newY = startPos.y + dy;

                // Call optimized imperative handler
                // This updates DOM directly and syncs Canvas Trackers
                handleItemDrag(activeDragId, { x: newX, y: newY });
            }
            return; // Skip setItems
        }

        // Legacy fallback (should not be reached if activeDragItemIdRef is set correctly)
        if (dragStartMouse && selectedIds.length > 0 && !activeDragId) {
            // ... existing fallback code if needed, but we can probably just rely on the above.
            // For safety, let's leave the old block but commented or effectively replaced.
        }

        // Handle Scaling (Ctrl + Alt + Left-Click drag)
        if (scaleStartRef.current) {
            const deltaX = e.clientX - scaleStartRef.current.startX;
            // Convert deltaX to scale factor:  +200px = 2x, -100px = 0.5x
            const scaleFactor = Math.max(0.1, 1 + (deltaX / 200));

            setItems(prevItems => prevItems.map(item => {
                const startDims = scaleStartRef.current?.itemDimensions[item.id];
                if (startDims) {
                    // Scale dimensions
                    const newWidth = startDims.width * scaleFactor;
                    const newHeight = startDims.height * scaleFactor;

                    // Scale position relative to center
                    const centerX = scaleStartRef.current!.centerX;
                    const centerY = scaleStartRef.current!.centerY;

                    const offsetX = startDims.x - centerX;
                    const offsetY = startDims.y - centerY;

                    const newX = centerX + offsetX * scaleFactor;
                    const newY = centerY + offsetY * scaleFactor;

                    return { ...item, x: newX, y: newY, width: newWidth, height: newHeight } as BoardItem;
                }
                return item;
            }));
            return;
        }

        // Handle Rotation (Ctrl + Left-Click drag)
        if (rotationStartRef.current) {
            const deltaX = e.clientX - rotationStartRef.current.startX;
            const rotationDelta = -deltaX * 0.5; // Reversed: dragging right decreases angle (counter-clockwise)

            setItems(prevItems => prevItems.map(item => {
                const startRotation = rotationStartRef.current?.itemRotations[item.id];
                if (startRotation !== undefined) {
                    const rawRotation = (startRotation + rotationDelta + 360) % 360;
                    // 25-degree snapping with Shift
                    const newRotation = e.shiftKey ? Math.round(rawRotation / 25) * 25 : rawRotation;
                    return { ...item, rotation: newRotation } as BoardItem;
                }
                return item;
            }));
            return;
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent & { canvasX: number; canvasY: number }) => {
        // Use Ref instead of state
        if (currentPathRef.current) {
            const finishedPath = currentPathRef.current;

            if (finishedPath.isEraser) {
                // Eraser logic same as before but using finishedPath
                const eraserRadius = finishedPath.size / 2;

                // Calculate new paths based on current paths state
                // Note: We use the current 'paths' state directly here. 
                // Since handleCanvasMouseUp is re-created on render, 'paths' should be fresh.
                const newPaths = paths.filter(path => {
                    // Check if any point in the path is within eraser radius
                    const hasIntersection = path.points.some(point => {
                        return finishedPath.points.some(eraserPoint => {
                            const dx = point.x - eraserPoint.x;
                            const dy = point.y - eraserPoint.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            return distance < (eraserRadius + path.size / 2);
                        });
                    });
                    return !hasIntersection;
                });

                saveToHistory(); // Save state before erasing paths
                setPaths(newPaths);

                // Sync to Firebase
                if (currentBoardId && currentBoardId !== 'new') {
                    updateRemoteData(currentBoardId, 'paths', newPaths);
                }
            } else {
                // Pen: add the path
                saveToHistory(); // Save state before adding path
                setPaths(prev => {
                    const newPaths = [...prev, finishedPath];

                    // Sync to Firebase
                    if (currentBoardId && currentBoardId !== 'new') {
                        updateRemoteData(currentBoardId, 'paths', newPaths);
                    }

                    return newPaths;
                });
            }

            // Clean up
            setCurrentPath(null);
            currentPathRef.current = null;
            if (drawingLayerRef.current) {
                drawingLayerRef.current.endPath();
            }
        }

        // Handle Item Drag Stop via Imperative Handler
        const dragStartMouse = dragStartMouseRef.current;
        const activeDragId = activeDragItemIdRef.current;

        if (activeDragId && dragStartMouse) {
            // Fix: Calculate the correct FINAL ITEM POSITION (not cursor position)
            // We must preserve the offset between cursor and item.
            const dx = e.canvasX - dragStartMouse.x;
            const dy = e.canvasY - dragStartMouse.y;

            const startPos = itemDragStartRef.current[activeDragId];
            if (startPos) {
                const finalItemX = startPos.x + dx;
                const finalItemY = startPos.y + dy;

                handleItemDragStop(activeDragId, finalItemX, finalItemY);
            }

            // Clear Active Drag Ref
            activeDragItemIdRef.current = null;
        } else if (dragStartMouse) {
            // Fallback for non-imperative path (shouldn't happen with new logic, but cleanup)
            dragStartMouseRef.current = null;
            dragStartStateRef.current = null;
            itemDragStartRef.current = {};
        }

        // Handle scale end
        if (scaleStartRef.current) {
            // Save scale to history
            if (dragStartStateRef.current) {
                setHistory(prev => {
                    const newHistory = prev.slice(0, historyIndex + 1);
                    newHistory.push(dragStartStateRef.current!);
                    return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
                });
                setHistoryIndex(prev => Math.min(prev + 1, 49));
            }

            // Sync scaled items to Firebase
            if (currentBoardId && currentBoardId !== 'new') {
                const scaledItems = items.filter(item => scaleStartRef.current?.itemDimensions[item.id] !== undefined);
                if (scaledItems.length > 0) {
                    updateRemoteItems(currentBoardId, scaledItems);
                }
            }

            // Clear scale ref
            scaleStartRef.current = null;
            dragStartStateRef.current = null;
        }

        if (rotationStartRef.current) {
            // Save rotation to history
            if (dragStartStateRef.current) {
                setHistory(prev => {
                    const newHistory = prev.slice(0, historyIndex + 1);
                    newHistory.push(dragStartStateRef.current!);
                    return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
                });
                setHistoryIndex(prev => Math.min(prev + 1, 49));
            }

            // Sync rotations to Firebase
            if (currentBoardId && currentBoardId !== 'new') {
                const rotatedItems = items.filter(item => rotationStartRef.current?.itemRotations[item.id] !== undefined);
                if (rotatedItems.length > 0) {
                    updateRemoteItems(currentBoardId, rotatedItems);
                }
            }

            // Clear rotation ref
            rotationStartRef.current = null;
            dragStartStateRef.current = null;
        }
    };


    const updateItem = (id: string, data: Partial<BoardItem>) => {
        // For discrete changes (like text formatting), save state before applying changes
        // During dragging/resizing/rotating, dragStartStateRef is already set, so we skip here
        if (!dragStartStateRef.current && !isUndoRedoRef.current) {
            saveToHistory();
        }

        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, ...data } as BoardItem;

                // Sync to Firebase (Partial update)
                if (currentBoardId && currentBoardId !== 'new') {
                    // For ad items, send full item to ensure it's preserved in Firebase
                    // For other items, only send changes (data), not the full updatedItem
                    // This prevents sending large Base64 strings when just moving items
                    if (item.type === 'ad') {
                        updateRemoteItem(currentBoardId, id, updatedItem);
                    } else {
                        updateRemoteItem(currentBoardId, id, data);
                    }
                }

                return updatedItem;
            }
            return item;
        }));
    };

    // Move ad item to top of screen periodically (10 seconds for testing, 30 minutes in production)
    // Move ad item to top of screen periodically
    useEffect(() => {
        if (!currentBoardId) return;

        const AD_MOVE_INTERVAL = 60 * 60 * 1000; // 1 hour

        const moveAdToTop = () => {
            const currentItems = itemsRef.current;
            const currentViewport = viewportRef.current;

            const adItem = currentItems.find(item => item.id === 'ad-banner');
            if (!adItem) return;

            // Get current viewport dimensions
            const viewportWidth = currentViewport.width || window.innerWidth;

            // Base ad dimensions (standard Carbon Ads size)
            const BASE_AD_WIDTH = 728;
            const BASE_AD_HEIGHT = 90;

            // Calculate ad size based on canvas scale
            // Scale the ad size inversely to the canvas scale so it appears consistent on screen
            // When canvas is zoomed in (scale > 1), ad should be smaller in world space
            // When canvas is zoomed out (scale < 1), ad should be larger in world space
            const adWidth = BASE_AD_WIDTH / currentViewport.scale;
            const adHeight = BASE_AD_HEIGHT / currentViewport.scale;

            // Screen coordinates relative to canvas container
            // Center horizontally, top area vertically (OPACITY slider area ~120px from top)
            const screenX = viewportWidth / 2;
            const screenY = 120;

            // Convert to world coordinates
            // World = (Screen - position) / scale
            const worldCenterX = (screenX - currentViewport.x) / currentViewport.scale;
            const worldTopY = (screenY - currentViewport.y) / currentViewport.scale;

            // Adjust for ad width to center it
            const topX = worldCenterX - (adWidth / 2);
            const topY = worldTopY;

            // Calculate screen position difference to avoid unnecessary updates
            const currentAdWidth = adItem.width || BASE_AD_WIDTH;
            const adScreenXCurrent = (adItem.x + currentAdWidth / 2) * currentViewport.scale + currentViewport.x;
            const adScreenYCurrent = adItem.y * currentViewport.scale + currentViewport.y;

            // Use Math.abs for difference check
            const diffX = Math.abs(adScreenXCurrent - screenX);
            const diffY = Math.abs(adScreenYCurrent - screenY);

            // Check if size needs to change
            const currentAdHeight = adItem.height || BASE_AD_HEIGHT;
            const sizeDiff = Math.abs(currentAdWidth - adWidth) > 1 || Math.abs(currentAdHeight - adHeight) > 1;

            // Move if difference is significant (more than 5px on screen) or size needs to change
            if (diffX > 5 || diffY > 5 || sizeDiff) {
                setItems(prev => prev.map(item => {
                    if (item.id === 'ad-banner') {
                        const updated = {
                            ...item,
                            x: topX,
                            y: topY,
                            width: adWidth,
                            height: adHeight
                            // Keep url and src empty for future AdSense integration
                        };
                        // Sync to remote if needed (copied from updateItem logic)
                        if (currentBoardId && currentBoardId !== 'new') {
                            updateRemoteItem(currentBoardId, 'ad-banner', updated);
                        }
                        return updated;
                    }
                    return item;
                }));
            }
        };

        // Move ad immediately on mount
        const initialTimeout = setTimeout(moveAdToTop, 500);

        // Set interval
        const interval = setInterval(moveAdToTop, AD_MOVE_INTERVAL);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
        // Dependency array is minimal to prevent resets
    }, [currentBoardId]); // Removed items and viewport from dependency

    // Function to refresh PSD file
    const refreshPSDFile = useCallback(async (itemId: string) => {
        const item = items.find(i => i.id === itemId) as MediaItemData | undefined;
        if (!item || !item.fileName?.toLowerCase().endsWith('.psd') || !item.originalFilePath) {
            console.warn('Cannot refresh: not a PSD file or no original path');
            return;
        }

        try {
            console.log('Refreshing PSD file:', item.fileName);

            // Re-read the PSD file via IPC
            if (window.electronAPI?.readPSDFile) {
                const result = await window.electronAPI.readPSDFile(item.originalFilePath);
                if (result.success && result.data) {
                    const file = new File([result.data], item.fileName || 'image.psd', { type: 'application/octet-stream' });

                    const { convertPSDToImage } = await import('./utils/psdParser');
                    const imageUrl = await convertPSDToImage(file);

                    if (imageUrl) {
                        // Upload/update PNG to Drive (overwrite existing file)
                        let driveFileId = item.driveFileId;
                        try {
                            const pngFileName = (item.fileName || `psd-${item.id}.png`).replace(/\.psd$/i, '.png');
                            // Use overwrite=true for PSD file refresh (same file should be updated)
                            driveFileId = await uploadOrUpdateImageInDrive(imageUrl, pngFileName, true, currentBoardId || undefined);
                            console.log('PSD PNG updated in Drive:', driveFileId, pngFileName);
                        } catch (driveErr) {
                            console.error('Failed to update PSD PNG in Drive:', driveErr);
                            return; // Don't update if Drive upload failed
                        }

                        // Update the item: remove src so it loads from Drive, update driveFileId
                        // This ensures the latest image from Drive is displayed
                        setItems(prev => prev.map(prevItem => {
                            if (prevItem.id === itemId && prevItem.type !== 'text') {
                                const updatedItem = { ...prevItem, src: '', driveFileId } as MediaItemData;

                                // Sync to Firebase (only driveFileId, not src - let Drive be the source of truth)
                                // Don't include src: undefined as Firebase doesn't allow undefined values
                                if (currentBoardId && currentBoardId !== 'new') {
                                    updateRemoteItem(currentBoardId, itemId, { driveFileId });
                                }

                                return updatedItem;
                            }
                            return prevItem;
                        }));
                        console.log('PSD file refreshed successfully:', item.fileName);
                    } else {
                        console.warn('Failed to convert PSD to image');
                    }
                } else {
                    console.error('Failed to read PSD file:', result.error);
                }
            }
        } catch (error) {
            console.error('Failed to refresh PSD file:', error);
        }
    }, [items, currentBoardId]);

    // Handle image double-click: zoom canvas to fit image
    const [zoomToFitItemId, setZoomToFitItemId] = useState<string | null>(null);

    const handleImageDoubleClick = useCallback((id: string) => {
        const item = items.find(i => i.id === id);
        if (!item || item.type !== 'image') return;

        // Select the item first
        setSelectedIds([id]);

        // Trigger zoom to fit
        setZoomToFitItemId(id);

        // Reset after a short delay to allow re-triggering
        setTimeout(() => {
            setZoomToFitItemId(null);
        }, 100);
    }, [items]);

    // Handle item drag stop - check for group interactions
    // Store initial positions for multi-selection drag
    // (Note: itemDragStartRef moved to top of component)

    const handleItemDragStart = useCallback((_id: string) => {
        // NOTE: We do NOT hide items here anymore.
        // Hiding is deferred to handleItemDrag to prevent items from vanishing on simple clicks (which trigger DragStart but no move).

        // Store initial positions of all selected items
        selectedIds.forEach(selectedId => {
            const selectedItem = items.find(i => i.id === selectedId);
            if (selectedItem) {
                itemDragStartRef.current[selectedId] = { x: selectedItem.x, y: selectedItem.y };
            }
        });
        // Save state at drag start for undo
        if (!dragStartStateRef.current) {
            dragStartStateRef.current = {
                items: JSON.parse(JSON.stringify(items)),
                groups: JSON.parse(JSON.stringify(groups)),
                arrows: JSON.parse(JSON.stringify(arrows)),
                paths: JSON.parse(JSON.stringify(paths))
            };
        }
    }, [selectedIds, items, groups, arrows, paths]);


    const handleItemDrag = useCallback((id: string, data: { x: number; y: number }) => {
        // Unified Canvas Rendering: We show ALL items on Canvas (including active one)
        // Active item DOM is visually hidden via CSS (.dragging-items class) but remains interactive.
        // This ensures perfect synchronization between active and passive items.
        if (canvasItemLayerRef.current) {
            canvasItemLayerRef.current.setHiddenItems([]);
        }

        // Add global dragging class to hide passive DOM elements via CSS
        document.body.classList.add('dragging-items');

        // Note: activeEl is declared and used for transform updates below.
        // We'll add the is-active-dragging class there.

        const draggedItem = items.find(i => i.id === id);
        if (!draggedItem) return;

        let dragStart = itemDragStartRef.current[id];
        if (!dragStart) {
            // Initialize if not set - use the current drag data position as drag start
            dragStart = { x: data.x, y: data.y };
            itemDragStartRef.current[id] = dragStart;
            // Also initialize for all selected items
            selectedIds.forEach(selectedId => {
                const selectedItem = items.find(i => i.id === selectedId);
                if (selectedItem && !itemDragStartRef.current[selectedId]) {
                    itemDragStartRef.current[selectedId] = { x: selectedItem.x, y: selectedItem.y };
                }
            });
            // Return early on first drag to avoid position jump
            return;
        }

        // Calculate delta from initial position
        const dx = data.x - dragStart.x;
        const dy = data.y - dragStart.y;

        // PERFORMANCE OPTIMIZATION: Imperative Updates Only
        // Do NOT call setItems here to avoid re-rendering the whole tree.
        // Update ConnectionLayer and ArrowLayer directly via Refs.
        // MediaItem (react-rnd) handles its own visual update.

        // Update tracker for the dragged item itself
        // Pass isActive=true to hide Canvas ghost and rely on DOM for smooth jitter-free drag
        if (connectionLayerRef.current) connectionLayerRef.current.updateTracker(id, data.x, data.y);
        if (arrowLayerRef.current) arrowLayerRef.current.updateTracker(id, data.x, data.y);
        if (canvasItemLayerRef.current) canvasItemLayerRef.current.updateTracker(id, data.x, data.y, true);

        // Direct DOM Update for the active item
        const activeEl = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
        if (activeEl && draggedItem) {
            // Apply class once if not present
            if (!activeEl.classList.contains('is-active-dragging')) {
                activeEl.classList.add('is-active-dragging');
            }
            const dx = data.x - dragStart.x;
            const dy = data.y - dragStart.y;
            const { rotation, flipHorizontal: flipH, flipVertical: flipV } = draggedItem as any; // Cast for types
            const transformString = `translate(${dx}px, ${dy}px) rotate(${rotation || 0}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
            activeEl.style.transform = transformString;
        }

        // Update other selected items
        if (selectedIds.length > 1) {
            selectedIds.forEach(selectedId => {
                if (selectedId === id) return; // Already handled
                const initialPos = itemDragStartRef.current[selectedId];
                if (initialPos) {
                    const newX = initialPos.x + dx;
                    const newY = initialPos.y + dy;

                    // Update Trackers
                    // Update Trackers (isActive=false for passive items -> Show Ghost)
                    if (connectionLayerRef.current) connectionLayerRef.current.updateTracker(selectedId, newX, newY);
                    if (arrowLayerRef.current) arrowLayerRef.current.updateTracker(selectedId, newX, newY);
                    if (canvasItemLayerRef.current) canvasItemLayerRef.current.updateTracker(selectedId, newX, newY, false);

                    // Direct DOM Update for passive engaged items
                    const passiveEl = document.querySelector(`[data-item-id="${selectedId}"]`) as HTMLElement;
                    const passiveItem = items.find(i => i.id === selectedId);
                    if (passiveEl && passiveItem) {
                        const { rotation, flipHorizontal: flipH, flipVertical: flipV } = passiveItem as any;
                        const transformString = `translate(${dx}px, ${dy}px) rotate(${rotation || 0}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
                        passiveEl.style.transform = transformString;
                    }
                }
            });
        }
    }, [selectedIds, items]);

    // Global handler for connection dragging
    useEffect(() => {
        if (!tempConnection) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            // Update temp connection end point
            const canvasX = (e.clientX - viewport.x) / viewport.scale;
            const canvasY = (e.clientY - viewport.y) / viewport.scale;

            setTempConnection(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    toPoint: { x: canvasX, y: canvasY }
                };
            });
        };

        const handleGlobalMouseUp = () => {
            // Cancel connection if dropped in empty space
            // If dropped on a socket, handleSocketMouseUp will have fired first (bubbling)
            // and cleared tempConnection or added it.
            // But we need to be careful not to race.
            // React event vs Native event? 
            // React events reuse the synthetic event system. 
            // Native listeners run... when?
            // Window native listener runs independently.
            // Safest to just clear tempConnection here.
            setTempConnection(null);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [tempConnection, viewport]);

    // Node Creation Handler
    const handleAddNode = (type: 'prompt_node' | 'generation_node') => {
        if (!contextMenu) return;
        // Calculate canvas position from context menu position
        const canvasX = (contextMenu.x - viewport.x) / viewport.scale;
        const canvasY = (contextMenu.y - viewport.y) / viewport.scale;

        // Calculate size based on aspect ratio for generation_node
        let nodeWidth = type === 'prompt_node' ? 480 : 600; // Increased prompt node from 320 to 480 (50% increase)
        let nodeHeight = type === 'prompt_node' ? 300 : 900; // Increased prompt node from 200 to 300 (50% increase)

        if (type === 'generation_node') {
            const aspectRatio = '2:3'; // Default aspect ratio
            const baseHeight = 900; // Increased from 400 to 900 for better visibility
            const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
            nodeWidth = Math.round((baseHeight / ratioH) * ratioW);
            nodeHeight = baseHeight;
        }

        const newNode: MediaItemData = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: type,
            src: '',
            url: '',
            x: canvasX,
            y: canvasY,
            width: nodeWidth,
            height: nodeHeight,
            rotation: 0,
            zIndex: items.length + 1,
            flipHorizontal: false,
            flipVertical: false,
            currentFileSlot: 0,
            promptText: '',
            nodeInputs: {},
            generationParams: type === 'generation_node' ? {
                aspectRatio: '2:3',
                resolution: '1k',
                model: 'gemini-2.5',
                batchSize: 1,
                style: 'structure'
            } : undefined
        };

        setItems(prev => [...prev, newNode]);

        // Sync to Firebase if needed (similar to handleCanvasDrop)
        if (currentBoardId && currentBoardId !== 'new') {
            updateRemoteItem(currentBoardId, newNode.id, newNode);
        }

        closeContextMenu();
    };

    // Connection System Handlers
    const handleSocketMouseDown = (nodeId: string, socketId: string, e: React.MouseEvent) => {
        // Prevent event from triggering drag start on the item itself
        e.stopPropagation();
        e.preventDefault();

        // Only left click
        if (e.button !== 0) return;

        console.log('Socket MouseDown:', nodeId, socketId);

        // Calculate canvas coordinates for the initial mouse position
        const canvasX = (e.clientX - viewport.x) / viewport.scale;
        const canvasY = (e.clientY - viewport.y) / viewport.scale;

        setTempConnection({
            fromNodeId: nodeId,
            fromSocketId: socketId,
            toPoint: { x: canvasX, y: canvasY }
        });

        // Local variable to track the nearest socket for the drag end handler
        // We use this because state updates (setHoveredSocket) might not be reflected immediately in the closure of handleDragEnd
        let currentNearestSocket: { nodeId: string; socketId: string } | null = null;

        // Track mouse move during drag
        const handleDragMove = (moveEvent: MouseEvent) => {
            const currentViewport = viewportRef.current;
            const newCanvasX = (moveEvent.clientX - currentViewport.x) / currentViewport.scale;
            const newCanvasY = (moveEvent.clientY - currentViewport.y) / currentViewport.scale;

            // Update temp connection line endpoint
            setTempConnection(prev => prev ? {
                ...prev,
                toPoint: { x: newCanvasX, y: newCanvasY }
            } : null);

            // Find nearest socket within snap distance
            const SNAP_DISTANCE = 100; // pixels in canvas space
            let nearestSocket: { nodeId: string; socketId: string } | null = null;
            let minDistance = SNAP_DISTANCE;

            // Check all nodes for their sockets
            // Use itemsRef to get latest items state
            itemsRef.current.forEach(item => {
                // Check for sockets based on item type
                let nodesockets: string[] = [];
                if (item.type === 'generation_node') {
                    nodesockets = ['text-input', 'image-input', 'image-output'];
                } else if (item.type === 'prompt_node') {
                    nodesockets = ['text-output'];
                } else if (item.type === 'image') {
                    nodesockets = ['image-input', 'image-output'];
                }

                nodesockets.forEach(sid => {
                    const socketPos = getNodeSocketPosition(item.id, sid);
                    if (socketPos) {
                        const dx = socketPos.x - newCanvasX;
                        const dy = socketPos.y - newCanvasY;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestSocket = { nodeId: item.id, socketId: sid };
                        }
                    }
                });
            });

            currentNearestSocket = nearestSocket;
            setHoveredSocket(nearestSocket);
        };

        const handleDragEnd = () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);

            if (currentNearestSocket) {
                // 1. Don't connect to self
                if (currentNearestSocket.nodeId === nodeId) {
                    setTempConnection(null);
                    setHoveredSocket(null);
                    return;
                }

                // Create connection
                setConnections(prev => {
                    // 2. Check for Duplicate Connections
                    const isDuplicate = prev.some(c =>
                        c.fromNodeId === nodeId &&
                        c.fromSocketId === socketId &&
                        c.toNodeId === currentNearestSocket!.nodeId &&
                        c.toSocketId === currentNearestSocket!.socketId
                    );

                    if (isDuplicate) {
                        return prev;
                    }

                    // 3. Simple Type Validation (Input <-> Output)
                    // We can check if socket IDs contain 'input' or 'output'
                    // For now, let's allow all connections as per user request to simply make it work,
                    // but ideally should enforce input->output.
                    // User complained "dirty hard to connect", so permissive is better for now.

                    const newConnection: Connection = {
                        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        fromNodeId: nodeId,
                        fromSocketId: socketId,
                        toNodeId: currentNearestSocket!.nodeId,
                        toSocketId: currentNearestSocket!.socketId
                    };
                    return [...prev, newConnection];
                });
            }

            setTempConnection(null);
            setHoveredSocket(null);
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    };

    const handleSocketMouseUp = (nodeId: string, socketId: string) => {
        // Did we drop a connection on a valid socket?
        if (tempConnection) {
            console.log('Socket MouseUp:', nodeId, socketId);
            console.log('Attempting connection from:', tempConnection.fromSocketId, 'to:', socketId);

            // Validate connection
            // 1. Don't connect to self
            if (tempConnection.fromNodeId === nodeId) {
                setTempConnection(null);
                return;
            }

            // 2. Strict Type Validation - TEMPORARILY DISABLED FOR DEBUGGING
            // Logging checking to see what values we are getting

            // Allow cross-connecting for now to ensure events are working
            // We can re-enable strictness once we confirm IDs are correct

            // 3. Check for Duplicate Connections
            const isDuplicate = connections.some(c =>
                c.fromNodeId === tempConnection.fromNodeId &&
                c.fromSocketId === tempConnection.fromSocketId &&
                c.toNodeId === nodeId &&
                c.toSocketId === socketId
            );

            if (isDuplicate) {
                setTempConnection(null);
                return;
            }

            const newConnection: Connection = {
                id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                fromNodeId: tempConnection.fromNodeId,
                fromSocketId: tempConnection.fromSocketId,
                toNodeId: nodeId,
                toSocketId: socketId
            };

            console.log('Connection Created:', newConnection);
            setConnections(prev => [...prev, newConnection]);
            setTempConnection(null);
        }
    };

    const handleDeleteConnection = (connectionId: string) => {
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        console.log('Deleted connection:', connectionId);
    };

    const handleConnectionContextMenu = (connectionId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteConnection(connectionId);
    };

    // Item Context Menu Handlers
    const handleItemContextMenu = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Only show context menu if item is already selected
        if (!selectedIds.includes(id)) {
            return;
        }

        setContextMenu({ x: e.clientX, y: e.clientY, itemId: id });
    };

    const handleFlipHorizontal = (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            updateItem(itemId, { flipHorizontal: !(item as any).flipHorizontal });
        }
        setContextMenu(null);
    };

    const handleFlipVertical = (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            updateItem(itemId, { flipVertical: !(item as any).flipVertical });
        }
        setContextMenu(null);
    };

    const handleGenerate = async (nodeId: string) => {
        console.log('Generate requested for node:', nodeId);
        setGeneratingNodeIds(prev => new Set(prev).add(nodeId));

        // 1. Find the Generation Node
        const genNode = items.find(i => i.id === nodeId);
        if (!genNode || genNode.type !== 'generation_node') return;

        // 2. Find Inputs
        // text-input: Text (Prompt)
        // image-input: Image (Reference) - can have multiple
        const textConn = connections.find(c => c.toNodeId === nodeId && c.toSocketId === 'text-input');
        const imageConns = connections.filter(c => c.toNodeId === nodeId && c.toSocketId === 'image-input');

        let promptText = '';
        const promptInputs: Record<string, any> = {};

        // 3. Process Text Input
        if (textConn) {
            let textSource = items.find(i => i.id === textConn.fromNodeId);

            // AUTO-RECOVERY: If connection has stale ID, try to find the correct prompt node
            if (!textSource) {
                const promptNodes = items.filter(i => i.type === 'prompt_node');

                if (promptNodes.length === 1) {
                    console.log('Auto-recovery: Using available PromptNode');
                    textSource = promptNodes[0];
                } else if (promptNodes.length > 1) {
                    console.error('Multiple PromptNodes found, please reconnect manually.');
                }
            }

            if (textSource && textSource.type === 'prompt_node') {
                promptText = textSource.promptText || '';
            }
        }

        // 4. Process Image Inputs (can have multiple)
        const processImage = async (imageSource: MediaItemData, index: number): Promise<void> => {
            // Support Image Node or potentially another Generation Node (Chain)
            if (imageSource.type === 'image' || imageSource.type === 'generation_node') {
                // Get the actual displayed image from DOM (avoids stale blob URLs)
                const imgElement = document.querySelector(`[data-item-id="${imageSource.id}"] img`) as HTMLImageElement;
                let imageSrc = imgElement?.src || imageSource.src || '';

                // Convert to base64 if needed
                let base64Src = imageSrc;
                if (imageSrc && !imageSrc.startsWith('data:')) {
                    try {
                        // If we have the actual img element, use it directly
                        if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                            const canvas = document.createElement('canvas');
                            canvas.width = imgElement.naturalWidth;
                            canvas.height = imgElement.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(imgElement, 0, 0);
                                base64Src = canvas.toDataURL('image/png');
                                console.log(`Converted image ${index} to base64 for Gemini (from DOM element)`);
                            } else {
                                throw new Error('Failed to get canvas context');
                            }
                        } else {
                            // Fallback: load image manually
                            base64Src = await new Promise<string>((resolve, reject) => {
                                const img = new Image();
                                img.crossOrigin = 'anonymous';

                                img.onload = () => {
                                    try {
                                        const canvas = document.createElement('canvas');
                                        canvas.width = img.naturalWidth;
                                        canvas.height = img.naturalHeight;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) {
                                            reject(new Error('Failed to get canvas context'));
                                            return;
                                        }
                                        ctx.drawImage(img, 0, 0);
                                        const dataUrl = canvas.toDataURL('image/png');
                                        resolve(dataUrl);
                                    } catch (err) {
                                        reject(err);
                                    }
                                };

                                img.onerror = () => reject(new Error('Failed to load image'));
                                img.src = imageSrc;
                            });
                            console.log(`Converted image ${index} to base64 for Gemini (loaded fresh)`);
                        }
                    } catch (error) {
                        console.error(`Failed to convert image ${index} to base64:`, error);
                        // Continue without this image - don't block generation
                        base64Src = '';
                    }
                }

                if (base64Src) {
                    // Use index-based key for multiple images
                    const imageKey = imageConns.length > 1 ? `reference_image_${index}` : 'reference_image';
                    promptInputs[imageKey] = {
                        id: imageSource.id,
                        src: base64Src
                    };
                }
            }
        };

        // Process all image connections
        for (let idx = 0; idx < imageConns.length; idx++) {
            const imageConn = imageConns[idx];
            const imageSource = items.find(item => item.id === imageConn.fromNodeId);
            if (imageSource) {
                await processImage(imageSource as MediaItemData, idx);
            }
        }

        if (!promptText && Object.keys(promptInputs).length === 0) {
            alert("Please connect a Text Node (Input 1) or Image Node (Input 2)!");
            return;
        }

        // 5. Construct Payload (Base)
        const batchSize = genNode.generationParams?.batchSize || 1;
        const basePayload = {
            prompt: promptText,
            images: promptInputs,
            config: {
                model: genNode.generationParams?.model || 'gemini-2.5',
                resolution: genNode.generationParams?.resolution || '1k',
                aspectRatio: genNode.generationParams?.aspectRatio || '1:1'
            }
        };

        setGeneratingNodeId(nodeId);

        try {
            // 6. Delete old files and start fresh with new generation

            // Get current node to access existing history
            const currentNode = itemsRef.current.find(n => n.id === nodeId);

            // Delete all previous generation files from Drive
            if (currentNode && currentNode.type === 'generation_node') {
                const existingHistory = currentNode.generatedHistory || [];
                const driveFileIdsToDelete = existingHistory
                    .filter(h => h.driveFileId)
                    .map(h => h.driveFileId!);

                if (driveFileIdsToDelete.length > 0) {
                    console.log(`Deleting ${driveFileIdsToDelete.length} old files before new generation...`);
                    console.log('File IDs to delete:', driveFileIdsToDelete);

                    // Delete files in parallel
                    const deleteResults = await Promise.allSettled(
                        driveFileIdsToDelete.map(async (fileId) => {
                            try {
                                await deleteImageFromDrive(fileId, currentBoardId || undefined, boardName);
                                return { success: true, fileId };
                            } catch (error: any) {
                                // 404 means file already deleted - treat as success
                                if (error.message?.includes('404') || error.message?.includes('not found')) {
                                    console.log(`File ${fileId} already deleted (404), skipping`);
                                    return { success: true, fileId, alreadyDeleted: true };
                                }
                                throw error; // Re-throw other errors
                            }
                        })
                    );

                    // Check results
                    const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                    const failureCount = deleteResults.filter(r => r.status === 'rejected').length;

                    if (failureCount > 0) {
                        console.warn(`File deletion completed with errors: ${successCount} succeeded, ${failureCount} failed`);
                        deleteResults.forEach((result, index) => {
                            if (result.status === 'rejected') {
                                console.error(`Failed to delete file ${driveFileIdsToDelete[index]}:`, result.reason);
                            }
                        });
                    } else {
                        console.log(`All ${successCount} old files deleted successfully`);
                    }
                }
            }

            // Always start from slot 0 for new generation batch
            const startSlot = 0;

            // Helper function for single generation - returns result instead of updating state
            const executeGeneration = async (i: number) => {
                // If the user deleted the node mid-generation, stop
                const currentNode = itemsRef.current.find(item => item.id === nodeId);
                if (!currentNode) return null;

                console.log(`Sending to Gemini (Batch ${i + 1}/${batchSize}):`, basePayload);

                const result = await generateContent(basePayload);
                console.log(`Gemini Result (Batch ${i + 1}):`, result);

                // Extract image from Gemini response
                const parts = result.candidates?.[0]?.content?.parts;
                let imageUrl: string | null = null;
                let textResponse: string | null = null;

                if (parts && parts.length > 0) {
                    const imagePart = parts.find((part: any) => part.inlineData?.data);
                    if (imagePart) {
                        const mimeType = imagePart.inlineData.mimeType || 'image/png';
                        const base64Data = imagePart.inlineData.data;
                        imageUrl = `data:${mimeType};base64,${base64Data}`;
                    } else {
                        // Check for text fallback
                        textResponse = parts.find((part: any) => part.text)?.text;
                    }
                }

                if (imageUrl) {
                    const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                            img.onerror = reject;
                            img.src = url;
                        });
                    };

                    try {
                        // Circular Buffer Logic:
                        // Calculate specific slot for this image: (startSlot + i) % 8
                        // 8 is the max history/file limit per node
                        const MAX_SLOTS = 8;
                        const targetSlot = (startSlot + i) % MAX_SLOTS;

                        // Filename relies on the SLOT index, not timestamp
                        const fileName = `generation_node_${nodeId}_slot_${targetSlot}.png`;
                        console.log(`Uploading generated image to Drive (Slot ${targetSlot}): ${fileName}`);

                        const imageDimensions = await getImageDimensions(imageUrl);
                        const actualAspectRatio = imageDimensions.width / imageDimensions.height;

                        const driveFileId = await uploadOrUpdateImageInDrive(
                            imageUrl,
                            fileName,
                            true, // OVERWRITE = TRUE. We reuse the restricted set of 8 filenames.
                            currentBoardId || undefined,
                            boardName
                        );

                        // Return result data instead of updating state
                        return {
                            historyItem: {
                                id: `hist-${Date.now()}-${i}-${targetSlot}`,
                                src: '', // CLEARED to prevent sync failure (Firestore 1MB limit)
                                driveFileId: driveFileId,
                                timestamp: Date.now()
                            },
                            driveFileId,
                            fileName,
                            actualAspectRatio,
                            index: i,
                            targetSlot
                        };

                    } catch (uploadError) {
                        console.error('Failed to upload/update:', uploadError);
                        return null;
                    }
                } else if (textResponse) {
                    console.warn('Received text response instead of image:', textResponse);
                    if (batchSize === 1) alert(`Gemini Text Response: ${textResponse}`);
                    return null;
                }

                return null;
            };

            // Execute in parallel and collect results
            const promises = Array.from({ length: batchSize }).map((_, i) => executeGeneration(i));
            const results = await Promise.allSettled(promises);

            // Filter successful results
            const successfulResults = results
                .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
                .map(r => r.value);

            // Update state once with all results
            if (successfulResults.length > 0) {
                const lastResult = successfulResults[successfulResults.length - 1];
                const MAX_SLOTS = 8;
                const nextStartSlot = (startSlot + batchSize) % MAX_SLOTS;

                // Build new history from all successful results
                const newHistoryItems = successfulResults.map(r => r.historyItem);

                setItems(prev => prev.map(item => {
                    if (item.id === nodeId && item.type === 'generation_node') {
                        // Resize logic using last result's aspect ratio
                        const MIN_WIDTH = 250;
                        const MIN_HEIGHT = 250;
                        let newWidth = Math.max(item.width, MIN_WIDTH);
                        let newHeight = Math.round(newWidth / lastResult.actualAspectRatio);
                        if (newHeight < MIN_HEIGHT) {
                            newHeight = MIN_HEIGHT;
                            newWidth = Math.round(newHeight * lastResult.actualAspectRatio);
                        }

                        const updatedItem = {
                            ...item,
                            src: '', // CLEARED to prevent sync failure
                            driveFileId: lastResult.driveFileId,
                            fileName: lastResult.fileName,
                            width: newWidth,
                            height: newHeight,
                            generatedHistory: newHistoryItems, // Use complete new history
                            currentFileSlot: nextStartSlot // Update the pointer for NEXT generation batch
                        } as MediaItemData;

                        if (currentBoardId && currentBoardId !== 'new') {
                            updateRemoteItem(currentBoardId, nodeId, updatedItem);
                        }

                        return updatedItem;
                    }
                    return item;
                }));
            }

        } catch (error: any) {
            console.error("Generation Error:", error);
            alert(`Generation Failed: ${error.message}`);
        } finally {
            setGeneratingNodeIds(prev => {
                const next = new Set(prev);
                next.delete(nodeId);
                return next;
            });
        }
    };

    const handleItemDragStop = (id: string, x: number, y: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        // Collect all updates for batch state change
        const itemUpdates: Record<string, { x: number; y: number }> = {};

        // Calculate delta for all selected items
        const dragStart = itemDragStartRef.current[id];
        if (dragStart && selectedIds.length > 1) {
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;

            if (dx !== 0 || dy !== 0) {
                // Save history before updating
                if (dragStartStateRef.current) {
                    const savedState = dragStartStateRef.current;
                    setHistory(prev => {
                        const newHistory = prev.slice(0, historyIndex + 1);
                        newHistory.push(savedState);
                        if (newHistory.length > 50) newHistory.shift();
                        return newHistory;
                    });
                    setHistoryIndex(prev => Math.min(prev + 1, 49));
                    dragStartStateRef.current = null;
                }

                // Collect updates for all selected items
                selectedIds.forEach(selectedId => {
                    const initialPos = itemDragStartRef.current[selectedId];
                    if (initialPos) {
                        const newX = initialPos.x + dx;
                        const newY = initialPos.y + dy;
                        if (!isNaN(newX) && !isNaN(newY) && isFinite(newX) && isFinite(newY)) {
                            itemUpdates[selectedId] = { x: newX, y: newY };
                        }
                    }
                });
            }
        } else {
            // Single item move
            if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                if (x !== item.x || y !== item.y) {
                    itemUpdates[id] = { x, y };
                }
            }
        }

        // 1. Batch State Update
        if (Object.keys(itemUpdates).length > 0) {
            setItems(prevItems => prevItems.map(prevItem => {
                if (itemUpdates[prevItem.id]) {
                    return { ...prevItem, ...itemUpdates[prevItem.id] };
                }
                return prevItem;
            }));

            // 2. Batch Remote Sync
            if (currentBoardId && currentBoardId !== 'new') {
                Object.entries(itemUpdates).forEach(([sid, coords]) => {
                    updateRemoteItem(currentBoardId, sid, coords);
                });
            }

            // 3. Update Linked Bookmarks
            const updatedBookmarks: Bookmark[] = [];
            const newBookmarksState = bookmarks.map(b => {
                if (b.targetId && itemUpdates[b.targetId]) {
                    const newCoords = itemUpdates[b.targetId];
                    const updated = { ...b, x: newCoords.x, y: newCoords.y };
                    updatedBookmarks.push(updated);
                    return updated;
                }
                return b;
            });

            if (updatedBookmarks.length > 0) {
                setBookmarks(newBookmarksState);
                if (currentBoardId && currentBoardId !== 'new') {
                    updateRemoteData(currentBoardId, 'bookmarks', newBookmarksState);
                }
            }
        }

        // 3. Cleanup
        itemDragStartRef.current = {};
        dragStartMouseRef.current = null;
        dragStartStateRef.current = null;

        if (canvasItemLayerRef.current) {
            selectedIds.forEach(sid => canvasItemLayerRef.current?.clearTracker(sid));
            canvasItemLayerRef.current.clearTracker(id);
            canvasItemLayerRef.current.setHiddenItems([]);
        }

        document.body.classList.remove('dragging-items');

        // Remove active class from element
        const activeDragEl = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
        if (activeDragEl) {
            activeDragEl.classList.remove('is-active-dragging');
        }

        // Cleanup any residual Direct DOM transforms and restore static state
        requestAnimationFrame(() => {
            const idsToClean = Object.keys(itemUpdates).length > 0 ? Object.keys(itemUpdates) : [id];
            idsToClean.forEach(uid => {
                const itemData = items.find(i => i.id === uid);
                // No longer skipping text items as we removed react-rnd and need standard cleanup

                const el = document.querySelector(`[data-item-id="${uid}"]`) as HTMLElement;
                const finalItemState = itemData || (itemUpdates[uid] ? { ...items.find(i => i.id === uid), ...itemUpdates[uid] } as any : null);

                if (el && finalItemState) {
                    // Restore rotation/flip but remove translation (handled by left/top)
                    const { rotation, flipHorizontal: flipH, flipVertical: flipV } = finalItemState;
                    const transformString = `rotate(${rotation || 0}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
                    el.style.transform = transformString;
                } else if (el) {
                    // Fallback
                    el.style.removeProperty('transform');
                }
            });
        });


        // Check if item is being dragged into a group
        if (item.type === 'ad') {
            // Ad items should never be in a group - force remove if present
            const currentGroup = getItemGroup(id);
            if (currentGroup) {
                removeItemFromGroup(id);
                console.log(`Force removed ${id} from group ${currentGroup.name}`);
            }
        } else {
            const targetGroup = groups.find((group: GroupData) => {
                // Check if group has valid childIds
                if (!group.childIds || !Array.isArray(group.childIds)) return false;

                // Check if item center is within group bounds
                const itemCenterX = x + item.width / 2;
                const itemCenterY = y + item.height / 2;

                return itemCenterX >= group.x &&
                    itemCenterX <= group.x + group.width &&
                    itemCenterY >= group.y &&
                    itemCenterY <= group.y + group.height &&
                    !group.childIds.includes(id); // Don't add if already in group
            });

            if (targetGroup) {
                // Check if item is already in another group and remove it first
                const currentGroup = getItemGroup(id);
                if (currentGroup && currentGroup.id !== targetGroup.id) {
                    removeItemFromGroup(id);
                    console.log(`Transferred ${id} from group ${currentGroup.name} to ${targetGroup.name}`);
                }

                // Add item to new group
                addItemToGroup(targetGroup.id, id);
                console.log(`Added ${id} to group ${targetGroup.name}`);
            } else {
                // Check if item was in a group and has been dragged out
                const currentGroup = getItemGroup(id);
                if (currentGroup) {
                    const itemCenterX = x + item.width / 2;
                    const itemCenterY = y + item.height / 2;

                    const isOutsideGroup = itemCenterX < currentGroup.x ||
                        itemCenterX > currentGroup.x + currentGroup.width ||
                        itemCenterY < currentGroup.y ||
                        itemCenterY > currentGroup.y + currentGroup.height;

                    if (isOutsideGroup) {
                        removeItemFromGroup(id);
                        console.log(`Removed ${id} from group ${currentGroup.name}`);
                    }
                }
            }
        }
    };

    const handleDriveCleanup = async () => {
        if (!currentBoardId || currentBoardId === 'new') {
            alert('보드를 먼저 저장해 주세요');
            return;
        }

        try {
            console.log('Starting Drive Cleanup Analysis...');
            const report = await findOrphanFiles(items, currentBoardId, boardName);

            if (report.totalCount === 0) {
                alert('정리할 미사용 파일이 없습니다.');
                return;
            }

            const message = `미사용 파일 ${report.totalCount}개를 찾았습니다.\n` +
                `- 일반 이미지: ${report.regularCount}개\n` +
                `- AI 생성 이미지: ${report.aiCount}개\n\n` +
                `이 파일들을 구글 드라이브에서 영구적으로 삭제할까요?\n` +
                `(보드에서 현재 사용 중인 파일은 삭제되지 않습니다.)`;

            if (window.confirm(message)) {
                console.log(`Cleaning up ${report.totalCount} files...`);
                const result = await cleanupFiles(report.orphans.map(o => o.id));
                alert(`정리가 완료되었습니다.\n성공: ${result.success}개, 실패: ${result.failed}개`);
            }
        } catch (error: any) {
            console.error('Cleanup failed:', error);
            alert(`정리에 실패했습니다: ${error.message}`);
        }
    };

    // --- Bookmark Handlers ---
    const handleSaveCoordinate = (targetId?: string, customCoords?: { x: number; y: number }) => {
        // If targetId provided, save that item's position
        // Else if customCoords provided, save that specific position
        // Else save current viewport center
        let newBookmark: Bookmark;

        if (targetId) {
            const item = items.find(i => i.id === targetId) || groups.find(g => g.id === targetId);
            if (!item) return;
            const itemName = (item as any).name || (item as any).fileName || 'Saved Item';
            newBookmark = {
                id: Date.now().toString(),
                name: itemName,
                targetId: item.id,
                x: item.x,
                y: item.y,
                scale: 1
            };
        } else if (customCoords) {
            newBookmark = {
                id: Date.now().toString(),
                name: `Bookmark ${bookmarks.length + 1}`,
                targetId: null,
                x: customCoords.x,
                y: customCoords.y,
                scale: viewport.scale // Use current scale
            };
        } else {
            // Save current center
            const centerWorldX = (window.innerWidth / 2 - viewport.x) / viewport.scale;
            const centerWorldY = (window.innerHeight / 2 - viewport.y) / viewport.scale;

            newBookmark = {
                id: Date.now().toString(),
                name: `View ${bookmarks.length + 1}`,
                targetId: null,
                x: centerWorldX,
                y: centerWorldY,
                scale: viewport.scale
            };
        }

        setBookmarks(prev => [...prev, newBookmark]);
        // Update remote data
        if (currentBoardId && currentBoardId !== 'new') {
            updateRemoteData(currentBoardId, 'bookmarks', [...bookmarks, newBookmark]);
        }
    };

    const handleBookmarkNavigate = (bookmark: Bookmark) => {
        if (bookmark.targetId) {
            const item = items.find(i => i.id === bookmark.targetId) || groups.find(g => g.id === bookmark.targetId);
            if (item) {
                // Navigate to item center
                const itemCenterX = item.x + item.width / 2;
                const itemCenterY = item.y + item.height / 2;
                setNavigateTo({ x: itemCenterX, y: itemCenterY });
            }
        } else {
            setNavigateTo({ x: bookmark.x, y: bookmark.y });
        }
    };

    const handleBookmarkRename = (id: string, name: string) => {
        const newBookmarks = bookmarks.map(b => b.id === id ? { ...b, name } : b);
        setBookmarks(newBookmarks);
        if (currentBoardId && currentBoardId !== 'new') {
            updateRemoteData(currentBoardId, 'bookmarks', newBookmarks);
        }
    };

    const handleBookmarkDelete = (id: string) => {
        const newBookmarks = bookmarks.filter(b => b.id !== id);
        setBookmarks(newBookmarks);
        if (currentBoardId && currentBoardId !== 'new') {
            updateRemoteData(currentBoardId, 'bookmarks', newBookmarks);
        }
    };

    // Handle group drag start - store initial positions and elements
    const handleGroupDragStart = useCallback((id: string) => {
        const group = groups.find(g => g.id === id);
        if (!group || !group.childIds || !Array.isArray(group.childIds) || group.childIds.length === 0) return;

        // Save state for Undo BEFORE drag starts
        if (!dragStartStateRef.current) {
            dragStartStateRef.current = {
                items: JSON.parse(JSON.stringify(itemsRef.current)),
                groups: JSON.parse(JSON.stringify(groups)),
                arrows: JSON.parse(JSON.stringify(arrows)),
                paths: JSON.parse(JSON.stringify(paths))
            };
        }

        // Store initial group position and all item positions
        const itemData: { [itemId: string]: { x: number; y: number; rotation: number; flipH: boolean; flipV: boolean } } = {};
        const elements: { [itemId: string]: HTMLElement } = {};

        // Use itemsRef to get fresh state (avoid stale closure due to GroupBox memoization)
        const currentItems = itemsRef.current;

        currentItems.forEach(item => {
            if (group.childIds.includes(item.id)) {
                // Store position AND transform data
                const itemDataAny = item as any;
                itemData[item.id] = {
                    x: item.x,
                    y: item.y,
                    rotation: itemDataAny.rotation || 0,
                    flipH: !!itemDataAny.flipHorizontal,
                    flipV: !!itemDataAny.flipVertical
                };

                // Capture DOM element for direct manipulation
                const el = document.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement;
                if (el) {
                    elements[item.id] = el;
                }
            }
        });

        groupDragStartRef.current[id] = {
            groupX: group.x,
            groupY: group.y,
            items: itemData,
            elements // Store elements for direct DOM updates
        } as any;
    }, [groups]);

    // Real-time group drag handler - Direct DOM Manipulation (No React Render)
    const handleGroupDrag = useCallback((id: string, data: { x: number; y: number }) => {
        const dragStart = (groupDragStartRef.current[id] as any);
        if (!dragStart || !dragStart.elements) return;

        const { items: initialItems, elements, groupX, groupY } = dragStart;

        // Calculate total movement from drag start
        const totalDx = data.x - groupX;
        const totalDy = data.y - groupY;

        // Direct DOM Update: Move child items synchronously
        Object.entries(elements).forEach(([itemId, el]) => {
            const element = el as HTMLElement;
            const itemDatum = initialItems[itemId];
            if (itemDatum) {
                // Determine CSS transform based on item type/structure
                // We must use DELTA translation because 'left/top' are already set to initial position.
                // We MUST also apply the rotation/scale transforms that matches MediaItem rendering.

                const { rotation, flipH, flipV } = itemDatum;
                const transformString = `translate(${totalDx}px, ${totalDy}px) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;

                // Directly apply transform to the element wrapper
                element.style.transform = transformString;

                // Fix Group Drag Sync: Update Canvas/Connection/Arrow layers visually
                // Trackers expect ABSOLUTE coordinates
                const newX = itemDatum.x + totalDx;
                const newY = itemDatum.y + totalDy;

                if (canvasItemLayerRef.current) canvasItemLayerRef.current.updateTracker(itemId, newX, newY);
                if (connectionLayerRef.current) connectionLayerRef.current.updateTracker(itemId, newX, newY);
                if (arrowLayerRef.current) arrowLayerRef.current.updateTracker(itemId, newX, newY);
            }
        });

        // NOTE: We deliberately DO NOT call setGroups or setItems here.
        // GroupBox handles its own visual position via react-rnd during drag (uncontrolled mode).
        // Items are moved via Direct DOM above.
        // State is updated only on Drag Stop (handleGroupUpdate).
    }, []);

    const handleGroupUpdate = (id: string, data: Partial<GroupData>) => {
        const group = groups.find(g => g.id === id);

        // Handle simple update (no children moving)
        if (!group || !group.childIds || !Array.isArray(group.childIds)) {
            updateGroup(id, data);
            delete groupDragStartRef.current[id];

            // Finalize history if we started a drag but didn't actually move children (e.g. empty group selection)
            if (dragStartStateRef.current) {
                setHistory(prev => {
                    const newHistory = prev.slice(0, historyIndex + 1);
                    newHistory.push(dragStartStateRef.current!);
                    return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
                });
                setHistoryIndex(prev => Math.min(prev + 1, 49));
                dragStartStateRef.current = null;
            }
            return;
        }

        const isResize = data.width !== undefined || data.height !== undefined;
        const isDrag = (data.x !== undefined || data.y !== undefined) && !isResize;

        // Collect all item updates to batch them
        const itemUpdates: Record<string, Partial<BoardItem>> = {};

        // Handle Resize: Scale child items proportionally
        if (isResize) {
            const oldWidth = group.width;
            const oldHeight = group.height;
            const newWidth = data.width !== undefined ? data.width : oldWidth;
            const newHeight = data.height !== undefined ? data.height : oldHeight;

            const oldX = group.x;
            const oldY = group.y;
            const newX = data.x !== undefined ? data.x : oldX;
            const newY = data.y !== undefined ? data.y : oldY;

            if (oldWidth !== newWidth || oldHeight !== newHeight) {
                const scaleX = newWidth / oldWidth;
                const scaleY = newHeight / oldHeight;

                group.childIds.forEach(itemId => {
                    const item = items.find(i => i.id === itemId);
                    if (item) {
                        // Calculate relative position within old group
                        const relX = item.x - oldX;
                        const relY = item.y - oldY;

                        // Scale relative position
                        const newRelX = relX * scaleX;
                        const newRelY = relY * scaleY;

                        // Calculate new absolute position
                        const isMediaItem = item.type === 'image' || item.type === 'ad' || item.type === 'video' || item.type === 'generation_node' || item.type === 'prompt_node';

                        // Items should stay at their absolute world position during group resize
                        const newItemX = isMediaItem ? item.x : newX + newRelX;
                        const newItemY = isMediaItem ? item.y : newY + newRelY;

                        // Scale item size as well (EXCEPT for media items)
                        const newItemWidth = isMediaItem ? item.width : item.width * scaleX;
                        const newItemHeight = isMediaItem ? item.height : item.height * scaleY;

                        itemUpdates[itemId] = {
                            x: newItemX,
                            y: newItemY,
                            width: newItemWidth,
                            height: newItemHeight
                        };
                    }
                });
            }
        }
        // Handle Drag Stop: Sync final positions
        else if (isDrag) {
            // Calculate final delta
            const dragStart = (groupDragStartRef.current[id] as any);

            // If we have start data, use it to calculate precise final positions
            if (dragStart) {
                const dx = (data.x || group.x) - dragStart.groupX;
                const dy = (data.y || group.y) - dragStart.groupY;

                // Update all items to their final positions
                group.childIds.forEach(itemId => {
                    const initialPos = dragStart.items[itemId];
                    if (initialPos) {
                        itemUpdates[itemId] = {
                            x: initialPos.x + dx,
                            y: initialPos.y + dy
                        };
                    }
                });
            }
        }

        // 1. Batch State Update for Items
        if (Object.keys(itemUpdates).length > 0) {
            setItems(prevItems => prevItems.map(prevItem => {
                if (itemUpdates[prevItem.id]) {
                    return { ...prevItem, ...itemUpdates[prevItem.id] } as any;
                }
                return prevItem;
            }));

            // 2. Batch Remote Sync
            if (currentBoardId && currentBoardId !== 'new') {
                Object.entries(itemUpdates).forEach(([uid, updates]) => {
                    updateRemoteItem(currentBoardId, uid, updates);
                });
            }
        }

        updateGroup(id, data);

        // Finalize History (Undo Support)
        if (dragStartStateRef.current) {
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(dragStartStateRef.current!);
                return newHistory.length > 50 ? newHistory.slice(1) : newHistory;
            });
            setHistoryIndex(prev => Math.min(prev + 1, 49));
            dragStartStateRef.current = null;
        }

        // Clear Direct DOM transforms for all child items and restore static state
        // Use requestAnimationFrame to ensure React has rendered the updated state first
        requestAnimationFrame(() => {
            group.childIds.forEach(itemId => {
                const el = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement;
                // Final state is either updated or original
                const finalItemState = items.find(i => i.id === itemId);

                if (el && finalItemState) {
                    // Restore rotation/flip but remove translation (handled by left/top)
                    // Cast to any/MediaItemData to access potential properties not on all item types
                    const itemData = finalItemState as any;
                    const rotation = itemData.rotation;
                    const flipH = itemData.flipHorizontal;
                    const flipV = itemData.flipVertical;

                    const transformString = `rotate(${rotation || 0}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
                    el.style.transform = transformString;

                    // Also clear trackers
                    if (canvasItemLayerRef.current) canvasItemLayerRef.current.clearTracker(itemId);
                    if (connectionLayerRef.current) connectionLayerRef.current.updateTracker(itemId, finalItemState.x, finalItemState.y); // Sync final pos
                    if (arrowLayerRef.current) arrowLayerRef.current.updateTracker(itemId, finalItemState.x, finalItemState.y);

                } else if (el) {
                    el.style.removeProperty('transform');
                }
            });
        });

        // Clear drag start ref after update
        delete groupDragStartRef.current[id];
    };

    const handleSelect = (id: string, isCtrlPressed: boolean = false, isShiftPressed: boolean = false) => {
        if (activeTool === 'arrow') {
            if (!arrowSourceId) {
                setArrowSourceId(id);
            } else if (arrowSourceId !== id) {
                saveToHistory(); // Save state before creating arrow
                createArrow(arrowSourceId, id);
                setArrowSourceId(null);
                setActiveTool('select');
            }
            return;
        }

        // Clear arrow selection when selecting items
        setSelectedArrowIds([]);

        if (isShiftPressed) {
            // Shift+Click: behaves same as Ctrl+Click (Toggle selection)
            // Removed complex range selection logic as it is confusing on 2D canvas
            setSelectedIds(prev =>
                prev.includes(id)
                    ? prev.filter(selectedId => selectedId !== id)
                    : [...prev, id]
            );
        } else if (isCtrlPressed) {
            // Ctrl+Click: Toggle selection
            setSelectedIds(prev =>
                prev.includes(id)
                    ? prev.filter(selectedId => selectedId !== id)
                    : [...prev, id]
            );
        } else {
            // Normal click: 
            // If already selected, do nothing (keep current group for potential drag)
            // If not selected, replace selection with just this item
            if (!selectedIds.includes(id)) {
                setSelectedIds([id]);
            }
        }
    };

    const handleArrowSelect = (arrowId: string) => {
        // Clear item selection when selecting arrows
        setSelectedIds([]);
        setSelectedArrowIds([arrowId]);
    };

    const handleSelectionBox = (box: { x: number; y: number; width: number; height: number }) => {
        const selectedItems = items.filter(item => {
            const itemRight = item.x + item.width;
            const itemBottom = item.y + item.height;
            const boxRight = box.x + box.width;
            const boxBottom = box.y + box.height;

            return !(
                item.x > boxRight ||
                itemRight < box.x ||
                item.y > boxBottom ||
                itemBottom < box.y
            );
        });

        setSelectedIds(selectedItems.map(item => item.id));
    };

    const handleGroup = () => {
        if (selectedIds.length >= 2) {
            const groupItems = items.filter(item => selectedIds.includes(item.id));
            if (groupItems.length >= 2) {
                saveToHistory(); // Save state before grouping
                createGroup(selectedIds, groupItems);
                setSelectedIds([]);
            }
        }
    };

    const getItemPosition = (id: string) => {
        const item = items.find(i => i.id === id);
        return item ? { x: item.x, y: item.y, width: item.width, height: item.height } : null;
    };

    const handleCanvasContextMenu = useCallback((e: React.MouseEvent & { canvasX?: number; canvasY?: number }) => {
        e.preventDefault();

        // Find if we clicked on an item
        const target = e.target as HTMLElement;
        const itemElement = target.closest('[data-item-id]');
        const itemId = itemElement?.getAttribute('data-item-id') || undefined;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            itemId: itemId
        });
    }, []);

    const isCtrlPressed = pressedKeys.has('CTRL');

    // Show landing page for web visitors (before auth check)
    if (showLanding) {
        return (
            <LandingPage
                onGetStarted={() => setShowLanding(false)}
                onDownload={() => window.open('https://github.com/Start-to/RefBoard/releases', '_blank')}
            />
        );
    }

    // Show login screen if not authenticated
    if (isAuthChecking) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Check for both Firebase user and Drive access token
    // Only check user authentication, not Drive token
    // Drive token may be refreshed automatically or obtained on-demand
    if (!user) {
        return (
            <>
                <TitleBar boardName="RefBoard" />
                <LoginScreen onLogin={() => {
                    // Auth state listener will handle the update
                    console.log('Login successful, waiting for auth state update...');
                }} />
            </>
        );
    }

    if (currentBoardId === null) {
        return (
            <>
                <TitleBar boardName="RefBoard" />
                <BoardListScreen onBoardSelect={(boardId, name) => {
                    // Clear previous board state to prevent caching issues
                    setItems([]);
                    setGroups([]);
                    setArrows([]);
                    setPaths([]);
                    setConnections([]);
                    setSelectedIds([]);
                    setViewport({ x: 0, y: 0, scale: 1, width: 0, height: 0 }); // Reset viewport

                    setCurrentBoardId(boardId);
                    if (name) {
                        setBoardName(name);
                    } else if (boardId === 'new') {
                        setBoardName('새 보드');
                    }
                }} />
            </>
        );
    }

    // 배경색: opacity가 1.0 (100%)일 때만 표시, 99% 이하일 때는 완전히 투명하게
    // 이미지와 UI는 설정된 opacity 값을 유지하지만, 배경만 별도로 처리
    // opacity < 1.0이면 배경을 완전히 투명하게
    const isFullOpacity = opacity >= 1.0;

    return (
        <div className={`w-screen h-screen overflow-hidden ${isFullOpacity ? 'bg-black' : 'bg-transparent'} text-white ${viewport.scale < 0.3 ? 'low-zoom' : ''}`}>
            {/* Auto-hide Title Bar */}
            {isUiVisible && <TitleBar boardName={boardName} />}

            {/* Removed AdBanner and WorkTimer */}

            {isUiVisible && (
                <>
                    <Toolbar
                        onBackToList={async () => {
                            // Save on Exit (Back to List)
                            setIsExiting(true);
                            // Force a small delay to ensure UI renders the loading state before the heavy synchronous parts of saveBoard (html2canvas) freeze the main thread
                            await new Promise(resolve => setTimeout(resolve, 50));

                            try {
                                await saveBoard(true); // Save with thumbnail
                            } catch (e) {
                                console.error('Failed to save on exit:', e);
                            } finally {
                                setCurrentBoardId(null);
                                setIsExiting(false);

                                // Clear cache on exit as well to be safe
                                setItems([]);
                                setGroups([]);
                                setArrows([]);
                                setPaths([]);
                                setConnections([]);
                                setSelectedIds([]);
                                setViewport({ x: 0, y: 0, scale: 1, width: 0, height: 0 });
                            }
                        }}
                        onShare={currentBoardId && currentBoardId !== 'new' ? () => setShowShareDialog(true) : undefined}
                        boardName={boardName}
                        opacity={opacity}
                        onOpacityChange={(val) => {
                            setOpacity(val);
                            window.electronAPI?.setOpacity(val);
                        }}
                        isAlwaysOnTop={isAlwaysOnTop}
                        onToggleAlwaysOnTop={async () => {
                            if (window.electronAPI) {
                                const newState = await window.electronAPI.toggleAlwaysOnTop();
                                setIsAlwaysOnTop(newState);
                            }
                        }}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={historyIndex >= 0}
                        canRedo={historyIndex < history.length - 1}
                    />

                    <BookmarkPanel
                        bookmarks={bookmarks}
                        onNavigate={handleBookmarkNavigate}
                        onRename={handleBookmarkRename}
                        onDelete={handleBookmarkDelete}
                        onCopyUrl={async (bookmark) => {
                            try {
                                // Create a URL with the original format: boardId, x, y, scale, name
                                // Always use production URL for sharing
                                const baseUrl = 'https://www.refboard.org/';
                                const urlParamsObj: any = {
                                    boardId: currentBoardId || '',
                                    x: bookmark.x.toString(),
                                    y: bookmark.y.toString(),
                                    scale: bookmark.scale.toString(),
                                    name: bookmark.name,
                                    open: 'web'
                                };

                                if (bookmark.targetId) {
                                    urlParamsObj.targetId = bookmark.targetId;
                                }

                                const params = new URLSearchParams(urlParamsObj);
                                const url = `${baseUrl}?${params.toString()}`;

                                // Copy to clipboard
                                await navigator.clipboard.writeText(url);

                                // Show confirmation message
                                alert(`북마크 링크가 복사되었습니다!\n\n${bookmark.name}`);
                                console.log('Bookmark URL copied:', url);
                            } catch (error) {
                                console.error('Failed to copy bookmark URL:', error);
                                alert('링크 복사에 실패했습니다');
                            }
                        }}
                    />

                    <Sidebar
                        activeTool={activeTool}
                        onToolChange={setActiveTool}
                        onSettingsClick={() => setIsSettingsOpen(true)}
                        onAlignClick={handleAlignSelectedItems}
                        onCleanupClick={handleDriveCleanup}
                        selectedCount={selectedIds.length}
                    />

                    {(activeTool === 'pen' || activeTool === 'eraser') && (
                        <PenSettingsBar
                            color={penSettings.color}
                            size={activeTool === 'pen' ? penSettings.size : penSettings.eraserSize}
                            isEraser={activeTool === 'eraser'}
                            onColorChange={(color) => setPenSettings(prev => ({ ...prev, color }))}
                            onSizeChange={(size) => setPenSettings(prev => activeTool === 'pen'
                                ? { ...prev, size }
                                : { ...prev, eraserSize: size })}
                        />
                    )}


                </>
            )}

            {/* Group Format Menu - Fixed at top center */}
            {isUiVisible && groupFormatMenuGroupId && (() => {
                const group = groups.find(g => g.id === groupFormatMenuGroupId);
                if (!group) return null;

                const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32];
                const fontFamilyOptions = [
                    { name: 'Inter', value: 'Inter, sans-serif' },
                    { name: 'Arial', value: 'Arial, sans-serif' },
                    { name: 'Times New Roman', value: 'Times New Roman, serif' },
                    { name: 'Courier New', value: 'Courier New, monospace' },
                    { name: 'Georgia', value: 'Georgia, serif' },
                    { name: 'Verdana', value: 'Verdana, sans-serif' }
                ];

                return (
                    <>
                        <div
                            className="fixed inset-0 z-[9998]"
                            onClick={() => {
                                setGroupFormatMenuGroupId(null);
                                setIsGroupFontSizeDropdownOpen(false);
                                setIsGroupFontFamilyDropdownOpen(false);
                            }}
                        />
                        <div
                            className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-700 border border-gray-600 rounded-lg shadow-xl py-3 px-4 z-[10000] flex items-center gap-3"
                            style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Font Size Input/Dropdown */}
                            <div className="relative flex items-center gap-1">
                                <input
                                    type="number"
                                    value={group.fontSize || 12}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value > 0 && value <= 200) {
                                            updateGroup(group.id, { fontSize: value });
                                        }
                                    }}
                                    onFocus={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="w-16 px-2 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500 outline-none border border-gray-500 focus:border-gray-400"
                                    min="1"
                                    max="200"
                                />
                                <span className="text-sm text-gray-300">px</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsGroupFontSizeDropdownOpen(!isGroupFontSizeDropdownOpen);
                                        setIsGroupFontFamilyDropdownOpen(false);
                                    }}
                                    className="px-2 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500"
                                >
                                    <span className="text-xs">▼</span>
                                </button>
                                {isGroupFontSizeDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg py-1 z-[10001] min-w-[100px] max-h-48 overflow-y-auto">
                                        {fontSizeOptions.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => {
                                                    updateGroup(group.id, { fontSize: size });
                                                    setIsGroupFontSizeDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 font-medium ${(group.fontSize || 12) === size ? 'bg-gray-600' : ''
                                                    }`}
                                            >
                                                {size}px
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Font Family Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsGroupFontFamilyDropdownOpen(!isGroupFontFamilyDropdownOpen);
                                        setIsGroupFontSizeDropdownOpen(false);
                                    }}
                                    className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500 flex items-center justify-between gap-2 min-w-[140px]"
                                    style={{ fontFamily: group.fontFamily || 'Inter, sans-serif' }}
                                >
                                    <span>{fontFamilyOptions.find(f => f.value === (group.fontFamily || 'Inter, sans-serif'))?.name || 'Inter'}</span>
                                    <span className="text-xs text-gray-400">▼</span>
                                </button>
                                {isGroupFontFamilyDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg py-1 z-[10001] min-w-[140px] max-h-48 overflow-y-auto">
                                        {fontFamilyOptions.map(font => (
                                            <button
                                                key={font.value}
                                                onClick={() => {
                                                    updateGroup(group.id, { fontFamily: font.value });
                                                    setIsGroupFontFamilyDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 font-medium ${(group.fontFamily || 'Inter, sans-serif') === font.value ? 'bg-gray-600' : ''
                                                    }`}
                                                style={{ fontFamily: font.value }}
                                            >
                                                {font.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Color Picker Button */}
                            <div className="relative">
                                <input
                                    type="color"
                                    value={group.color || '#ffffff'}
                                    onChange={(e) => {
                                        updateGroup(group.id, { color: e.target.value });
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    style={{ zIndex: 1 }}
                                />
                                <button
                                    className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500 flex items-center gap-2 relative"
                                >
                                    <div
                                        className="w-5 h-5 rounded border border-gray-500"
                                        style={{ backgroundColor: group.color || '#ffffff' }}
                                    />
                                    <span>색상</span>
                                </button>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => {
                                    setGroupFormatMenuGroupId(null);
                                    setIsGroupFontSizeDropdownOpen(false);
                                    setIsGroupFontFamilyDropdownOpen(false);
                                }}
                                className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500"
                            >
                                ✕
                            </button>
                        </div>
                    </>
                );
            })()}



            {isUiVisible && (
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    settings={settings}
                    uiSettings={uiSettings}
                    onSave={(newSettings, newUISettings) => {
                        setSettings(newSettings);
                        setUiSettings(newUISettings);
                    }}
                />
            )}

            <Canvas
                selectedItemId={selectedIds[0] || null}
                getItemPosition={getItemPosition}
                onSelectionBox={handleSelectionBox}
                onCanvasClick={handleCanvasClick}
                onCanvasDrop={handleCanvasDrop}
                uiSettings={uiSettings}
                panSettings={settings.pan}
                windowDragSettings={settings.windowDrag}
                zoomWheelModifier={settings.zoomWheelModifier}
                activeTool={activeTool}
                pressedKeys={pressedKeys}
                isEraser={activeTool === 'eraser'}
                brushSize={activeTool === 'pen' ? penSettings.size : penSettings.eraserSize}
                onContextMenu={handleCanvasContextMenu}
                opacity={opacity}
                onOpacityChange={setOpacity}
                opacityDragSettings={settings.opacityDrag}
                items={items} // Pass items for Minimap
                onCanvasMouseDown={handleCanvasMouseDown}
                onCanvasMouseMove={handleCanvasMouseMove}
                onCanvasMouseUp={handleCanvasMouseUp}
                zoomToFit={zoomToFitItemId ? { itemId: zoomToFitItemId, padding: 40 } : null}
                onViewportChange={setViewport}
                onVisualUpdate={(visualState) => {
                    if (visualState && drawingLayerRef.current) {
                        if (drawingLayerRef.current.updateTransform) {
                            // Pass object directly for relative calculation
                            drawingLayerRef.current.updateTransform(visualState);
                        } else {
                            drawingLayerRef.current.syncView();
                        }
                    } else {
                        drawingLayerRef.current?.syncView();
                    }
                }}
                onLODChange={(isLow) => canvasItemLayerRef.current?.setLODMode(isLow)}
                navigateTo={navigateTo}
                onNavigated={() => setNavigateTo(null)}
                isUiVisible={isUiVisible}
                fixedLayer={
                    <CanvasItemLayer
                        ref={canvasItemLayerRef}
                        items={items}
                        selectedIds={selectedIds}
                        onRender={() => { }} // Optional debug
                    />
                }
            >

                <ConnectionLayer
                    ref={connectionLayerRef}
                    connections={connections}
                    getItemPosition={getNodeSocketPosition}
                    tempConnection={tempConnection}
                    onConnectionContextMenu={(id: string, _e: any) => {
                        // e.preventDefault(); // handled in component
                        handleDeleteConnection(id);
                    }}
                    items={items}
                    activeGenerationNodeIds={Array.from(generatingNodeIds)}
                    hoveredSocket={hoveredSocket}
                />

                <ArrowLayer
                    ref={arrowLayerRef}
                    arrows={arrows}
                    items={items}
                    onArrowSelect={handleArrowSelect}
                    selectedArrowIds={selectedArrowIds}
                />

                {groups.map(group => (
                    <GroupBox
                        key={group.id}
                        group={group}
                        isSelected={selectedIds.includes(group.id)}
                        onUpdate={handleGroupUpdate}
                        onDragStart={handleGroupDragStart}
                        onDrag={handleGroupDrag}
                        onSelect={(id) => setSelectedIds([id])}
                        onNameChange={updateGroupName}
                        onFormatMenuOpen={(groupId) => setGroupFormatMenuGroupId(groupId)}
                        onUngroup={deleteGroup}
                        activeTool={activeTool}
                        onSaveCoordinate={handleSaveCoordinate}
                    />
                ))}

                {items
                    .map((item, index) => {
                        // Ensure unique key by combining id with index as fallback
                        const uniqueKey = item.id || `item-${index}`;

                        if (item.type === 'text') {
                            return (
                                <TextItem
                                    key={uniqueKey}
                                    item={item as TextItemData}
                                    isSelected={selectedIds.includes(item.id)}
                                    onUpdate={updateItem}
                                    onInteractionStart={handleInteractionStart}
                                    onInteractionEnd={handleItemDragStop}
                                    onSelect={(id, ctrl, shift) => handleSelect(id, ctrl, shift)}
                                    onGroup={handleGroup}
                                    canGroup={selectedIds.length >= 2 && selectedIds.includes(item.id)}
                                    isCtrlPressed={isCtrlPressed}
                                    activeTool={activeTool}
                                    isNewlyCreated={newlyCreatedTextIds.has(item.id)}
                                    onEditStart={(id) => {
                                        setNewlyCreatedTextIds(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(id);
                                            return newSet;
                                        });
                                    }}
                                    onFormatMenuOpen={(textId) => setTextFormatMenuTextId(textId)}
                                    onSaveCoordinate={handleSaveCoordinate}
                                    scale={viewport.scale}
                                />
                            );
                        } else {
                            return (
                                <MediaItem
                                    key={uniqueKey}
                                    item={item as MediaItemData}
                                    isSelected={selectedIds.includes(item.id)}
                                    onUpdate={updateItem}
                                    onInteractionStart={handleInteractionStart}
                                    onInteractionEnd={handleInteractionEnd}
                                    onSelect={(id: string, multi: boolean) => handleSelect(id, false, multi)}
                                    scale={viewport.scale}
                                    activeTool={activeTool as any}
                                    onSocketMouseDown={handleSocketMouseDown}
                                    onSocketMouseUp={handleSocketMouseUp}
                                    onSocketMouseEnter={handleSocketMouseEnter}
                                    onSocketMouseLeave={handleSocketMouseLeave}
                                    onGenerateNode={handleGenerate}
                                    isGenerating={generatingNodeIds.has(item.id)}
                                    onContextMenu={(e) => handleItemContextMenu(item.id, e)}
                                    onImageDoubleClick={handleImageDoubleClick}
                                />
                            );
                        }
                    })}

                {/* Collaborator Cursors - Rendered inside Canvas to respect zoom/pan */}
                <CollaboratorCursors cursors={collaboratorCursors} />

                {/* Multi-Selection Bounding Box */}
                {multiSelectionBounds && selectedIds.length > 1 && (
                    <SelectionBoundingBox
                        bounds={multiSelectionBounds}
                        onScaleStart={handleMultiScaleStart}
                        onScale={handleMultiScale}
                        onScaleEnd={handleMultiScaleEnd}
                    />
                )}

                {/* Connection Layer - for node connections with animations */}


                {/* DrawingLayer를 마지막에 렌더링하여 펜이 모든 항목 위에 오버레이되도록 함 */}
                <DrawingLayer ref={drawingLayerRef} paths={paths} currentPath={currentPath} />
            </Canvas>

            {/* Text Format Menu - Fixed at top center (same as Group Format Menu) */}
            {isUiVisible && textFormatMenuTextId && (() => {
                const textItem = items.find(i => i.id === textFormatMenuTextId && i.type === 'text') as TextItemData | undefined;
                if (!textItem) return null;

                const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32];
                const fontFamilyOptions = [
                    ...customFonts,
                    { name: 'Inter', value: 'Inter, sans-serif' },
                    { name: 'Arial', value: 'Arial, sans-serif' },
                    { name: 'Times New Roman', value: 'Times New Roman, serif' },
                    { name: 'Courier New', value: 'Courier New, monospace' },
                    { name: 'Georgia', value: 'Georgia, serif' },
                    { name: 'Verdana', value: 'Verdana, sans-serif' }
                ];

                return (
                    <>
                        <div
                            className="fixed inset-0 z-[9998]"
                            onClick={() => {
                                setTextFormatMenuTextId(null);
                                setIsTextFontSizeDropdownOpen(false);
                                setIsTextFontFamilyDropdownOpen(false);
                            }}
                        />
                        <div
                            className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-700 border border-gray-600 rounded-lg shadow-xl py-3 px-4 z-[10000] flex items-center gap-3"
                            style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative flex items-center gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsTextFontFamilyDropdownOpen(!isTextFontFamilyDropdownOpen);
                                        setIsTextFontSizeDropdownOpen(false);
                                    }}
                                    className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500 flex items-center justify-between gap-2 min-w-[140px]"
                                    style={{ fontFamily: textItem.fontFamily }}
                                >
                                    <span className="truncate max-w-[100px]">{fontFamilyOptions.find(f => f.value === textItem.fontFamily)?.name || 'Inter'}</span>
                                    <span className="text-xs text-gray-400">▼</span>
                                </button>

                                {/* Add Font Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFontModal(true);
                                        setIsTextFontFamilyDropdownOpen(false);
                                        setIsTextFontSizeDropdownOpen(false);
                                    }}
                                    className="px-2 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500"
                                    title="Add Google Font"
                                >
                                    +
                                </button>

                                {isTextFontFamilyDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg py-1 z-[10001] min-w-[140px] max-h-48 overflow-y-auto">
                                        {fontFamilyOptions.map(font => (
                                            <button
                                                key={font.value}
                                                onClick={() => {
                                                    updateItem(textItem.id, { fontFamily: font.value });
                                                    setIsTextFontFamilyDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-600 font-medium ${textItem.fontFamily === font.value ? 'bg-gray-600' : ''
                                                    }`}
                                                style={{ fontFamily: font.value }}
                                            >
                                                {font.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Color Picker Button */}
                            <div className="relative">
                                <input
                                    type="color"
                                    value={textItem.color}
                                    onChange={(e) => {
                                        updateItem(textItem.id, { color: e.target.value });
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    style={{ zIndex: 1 }}
                                />
                                <button
                                    className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500 flex items-center gap-2 relative"
                                >
                                    <div
                                        className="w-5 h-5 rounded border border-gray-500"
                                        style={{ backgroundColor: textItem.color }}
                                    />
                                    <span>색상</span>
                                </button>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => {
                                    setTextFormatMenuTextId(null);
                                    setIsTextFontSizeDropdownOpen(false);
                                    setIsTextFontFamilyDropdownOpen(false);
                                }}
                                className="px-3 py-2 bg-gray-600 rounded-lg text-sm text-gray-300 font-medium hover:bg-gray-500"
                            >
                                ✕
                            </button>
                        </div>
                    </>
                );
            })()}

            {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500">
                    <div className="text-center">
                        <p className="text-xl mb-2">Drag and drop images or videos here</p>
                        <p className="text-sm">Or press T for text, A for arrows</p>
                    </div>
                </div>
            )}

            {activeTool === 'arrow' && arrowSourceId && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded shadow-lg">
                    Click another item to create arrow
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={closeContextMenu}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                    <div
                        className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-[9999] min-w-[200px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        {(() => {
                            const contextItem = contextMenu.itemId ? items.find(i => i.id === contextMenu.itemId) : null;
                            const isImage = contextItem?.type === 'image';

                            if (isImage) {
                                return (
                                    <>
                                        <button
                                            className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                            onClick={() => contextMenu.itemId && handleFlipHorizontal(contextMenu.itemId)}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            Flip Horizontal
                                        </button>
                                        <button
                                            className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                            onClick={() => contextMenu.itemId && handleFlipVertical(contextMenu.itemId)}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                            </svg>
                                            Flip Vertical
                                        </button>
                                        <div className="h-px bg-gray-700 my-1" />
                                        <button
                                            onClick={() => {
                                                if (contextMenu.itemId) {
                                                    handleSaveCoordinate(contextMenu.itemId);
                                                }
                                                closeContextMenu();
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <span>Bookmark</span>
                                        </button>
                                        <div className="h-px bg-gray-700 my-1" />
                                        <button
                                            onClick={async () => {
                                                if (contextMenu.itemId) {
                                                    const item = items.find(i => i.id === contextMenu.itemId) as MediaItemData;
                                                    if (item?.url && window.electronAPI) {
                                                        let finalUrl = item.url;

                                                        // Handle blob URLs by converting them to data URLs
                                                        if (item.url.startsWith('blob:')) {
                                                            try {
                                                                const response = await fetch(item.url);
                                                                const blob = await response.blob();
                                                                finalUrl = await new Promise((resolve, reject) => {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => resolve(reader.result as string);
                                                                    reader.onerror = reject;
                                                                    reader.readAsDataURL(blob);
                                                                });
                                                            } catch (e) {
                                                                console.error('Failed to convert blob to data URL:', e);
                                                            }
                                                        }

                                                        window.electronAPI.openInPhotoshop(finalUrl);
                                                    }
                                                }
                                                closeContextMenu();
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M0 .5v23l24-11.5L0 .5zm21.4 11.5L2 21.8V2.2l19.4 9.8z" />
                                            </svg>
                                            <span>Open in Photoshop</span>
                                        </button>
                                    </>
                                );
                            }

                            // Standard Menu for non-image items or empty space
                            return (
                                <>
                                    <button
                                        onClick={() => {
                                            if (selectedIds.length > 0) {
                                                const itemsToCopy = items.filter(item => selectedIds.includes(item.id));
                                                setClipboard(itemsToCopy);
                                            }
                                            closeContextMenu();
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-4"
                                    >
                                        <span>copy</span>
                                        <span className="text-xs text-gray-400">Ctrl+C</span>
                                    </button>
                                    <button
                                        onClick={() => handlePaste()}
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center justify-between gap-4"
                                    >
                                        <span>paste</span>
                                        <span className="text-xs text-gray-400">Ctrl+V</span>
                                    </button>

                                    {!contextMenu.itemId && (
                                        <>
                                            <div className="h-px bg-gray-700 my-1" />
                                            <button
                                                onClick={() => {
                                                    // Convert screen coords to world coords
                                                    const worldX = (contextMenu.x - viewport.x) / viewport.scale;
                                                    const worldY = (contextMenu.y - viewport.y) / viewport.scale;
                                                    handleSaveCoordinate(undefined, { x: worldX, y: worldY });
                                                    closeContextMenu();
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                                            >
                                                <span>Add Bookmark</span>
                                            </button>
                                        </>
                                    )}

                                    {contextMenu.itemId && (
                                        <>
                                            <div className="h-px bg-gray-700 my-1" />
                                            <button
                                                onClick={() => {
                                                    if (contextMenu.itemId) {
                                                        handleSaveCoordinate(contextMenu.itemId);
                                                    }
                                                    closeContextMenu();
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                                            >
                                                <span>Bookmark</span>
                                            </button>
                                            <button
                                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                                                onClick={() => {
                                                    if (contextMenu.itemId) {
                                                        setItems(prev => prev.filter(i => i.id !== contextMenu.itemId));
                                                    }
                                                    setContextMenu(null);
                                                }}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </button>
                                        </>
                                    )}

                                    <div className="h-px bg-gray-700 my-1" />

                                    <button
                                        onClick={() => handleAddNode('prompt_node')}
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700"
                                    >
                                        <span>Add Prompt Node</span>
                                    </button>
                                    <button
                                        onClick={() => handleAddNode('generation_node')}
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700"
                                    >
                                        <span>Add Generation Node</span>
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </>
            )}

            {/* Font Add Modal */}
            {showFontModal && (
                <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-[400px] shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Add Google Font</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Search for any Google Font and select from the list to preview.
                            Browse fonts at <a href="https://fonts.google.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">fonts.google.com</a>.
                        </p>


                        <input
                            type="text"
                            placeholder="Type to search all Google Fonts (e.g., bbh, noto, open)"
                            value={newFontName}
                            onChange={async (e) => {
                                const value = e.target.value;
                                setNewFontName(value);
                                setSelectedFontFromList('');
                                setFontLoadingState('idle');
                                setFontErrorMessage('');
                                // Update suggestions asynchronously
                                if (value.trim()) {
                                    const suggestions = await searchFonts(value);
                                    setFontSuggestions(suggestions);
                                } else {
                                    setFontSuggestions([]);
                                }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white mb-3 focus:outline-none focus:border-blue-500"
                            autoFocus
                        />

                        {/* Font Suggestions List - Optional hints */}
                        {fontSuggestions.length > 0 && !selectedFontFromList && fontLoadingState === 'idle' && (
                            <div className="mb-3">
                                <p className="text-gray-400 text-xs mb-1">Select a font to preview:</p>
                                <div className="max-h-48 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg">
                                    {fontSuggestions.map(fontName => (
                                        <button
                                            key={fontName}
                                            onClick={async () => {
                                                setNewFontName(fontName);
                                                setSelectedFontFromList(fontName);
                                                setFontSuggestions([]);
                                                setFontLoadingState('loading');
                                                setFontErrorMessage('');
                                                try {
                                                    await loadGoogleFont(fontName);
                                                    setFontLoadingState('success');
                                                } catch (error: any) {
                                                    setFontLoadingState('error');
                                                    setFontErrorMessage(error.message);
                                                    setSelectedFontFromList('');
                                                }
                                            }}
                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 transition-colors text-sm"
                                        >
                                            {fontName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Font Preview Area - Only show when font is selected and loaded */}
                        {fontLoadingState === 'success' && selectedFontFromList && (
                            <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
                                <p className="text-gray-400 text-xs mb-1">Preview of "{selectedFontFromList}":</p>
                                <p
                                    className="text-xl text-white break-words"
                                    style={{ fontFamily: `'${selectedFontFromList}', sans-serif` }}
                                >
                                    The quick brown fox jumps over the lazy dog.
                                    <br />
                                    1234567890
                                    <br />
                                    다람쥐 헌 쳇바퀴에 타고파
                                </p>
                            </div>
                        )}

                        {/* Loading state */}
                        {fontLoadingState === 'loading' && (
                            <div className="mb-3 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                                <p className="text-blue-400 text-sm">Loading font...</p>
                            </div>
                        )}

                        {/* Error message display */}
                        {fontErrorMessage && (
                            <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                                <p className="text-red-400 text-sm">{fontErrorMessage}</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowFontModal(false);
                                    setNewFontName('');
                                    setSelectedFontFromList('');
                                    setFontSuggestions([]);
                                    setFontLoadingState('idle');
                                    setFontErrorMessage('');
                                }}
                                className="px-4 py-2 text-gray-300 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (selectedFontFromList) {
                                        const fontName = selectedFontFromList;
                                        try {
                                            await loadGoogleFont(fontName);
                                            const newFont = addCustomFont(fontName);
                                            setCustomFonts(prev => {
                                                if (prev.find(f => f.name === newFont.name)) return prev;
                                                return [...prev, newFont];
                                            });
                                            setShowFontModal(false);
                                            setNewFontName('');
                                            setSelectedFontFromList('');
                                            setFontSuggestions([]);
                                            setFontLoadingState('idle');
                                            setFontErrorMessage('');
                                        } catch (error: any) {
                                            setFontLoadingState('error');
                                            setFontErrorMessage(error.message || 'Failed to add font');
                                        }
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!selectedFontFromList || fontLoadingState === 'loading'}
                            >
                                Add Font
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Share Dialog */}
            {
                showShareDialog && currentBoardId && currentBoardId !== 'new' && (
                    <ShareDialog
                        boardId={currentBoardId}
                        boardName={boardName}
                        items={items}
                        onClose={() => setShowShareDialog(false)}
                    />
                )
            }

            {/* Exit Loading Overlay */}
            {
                isExiting && (
                    <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto transition-opacity duration-300">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <div className="text-2xl font-bold text-white mb-2">Saving Board...</div>
                        <div className="text-gray-400">Returning to list</div>
                    </div>
                )
            }


            {/* FIXED AD OVERLAY - UI THEMED */}
            <div
                className="fixed top-6 right-6 z-[99999] flex items-center gap-1 bg-black/40 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-white/10 ring-1 ring-white/5 transition-all duration-300 hover:bg-black/60"
                style={{
                    pointerEvents: 'auto'
                }}
            >


                {/* Ad Content Container (Simplified) */}
                {/* TODO: REPLACE THIS DIV WITH GOOGLE ADSENSE CODE (e.g. <ins ... />) */}
                <div
                    style={{ width: '728px', height: '90px' }}
                    className="bg-gray-800/40 rounded-xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/5 pointer-events-none" />
                    <div className="text-gray-600 font-bold text-sm group-hover:text-gray-500 transition-colors">AD SPACE</div>
                    <div className="text-gray-700 text-[10px] group-hover:text-gray-600 transition-colors">728 x 90</div>
                </div>
            </div>

        </div>
    );
}

export default App;
