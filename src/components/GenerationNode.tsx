import React, { useState, useEffect } from 'react';
import { MediaItemData } from './MediaItem';
import { loadImageFromDrive } from '../services/googleDrive';

const HistoryThumbnail: React.FC<{
    src?: string;
    driveFileId?: string;
    currentDriveFileId?: string; // The main item's driveFileId
    onClick: () => void;
}> = ({ src, driveFileId, currentDriveFileId, onClick }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(src || null);

    useEffect(() => {
        if (driveFileId && !src) {
            loadImageFromDrive(driveFileId).then(setImageUrl).catch(console.error);
        } else if (src) {
            setImageUrl(src);
        }
    }, [driveFileId, src]);

    const displayUrl = imageUrl || src;
    // Compare driveFileId to determine if this thumbnail is selected
    const isSelected = driveFileId && currentDriveFileId && driveFileId === currentDriveFileId;

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`aspect-square rounded-lg overflow-hidden border-4 transition-all relative group ${isSelected
                ? 'border-[rgb(255,255,255)] ring-2 ring-white/0'
                : 'border-[rgba(255,255,255,0.2)] hover:border-[rgb(255,255,255)]'
                }`}
        >
            {displayUrl ? (
                <img
                    src={displayUrl}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                    draggable={false}
                />
            ) : (
                <div className="w-full h-full bg-gray-700 animate-pulse" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </button>
    );
};

interface GenerationNodeProps {
    item: MediaItemData;
    onGenerate: () => void;
    onUpdate: (id: string, data: Partial<MediaItemData>) => void;
    isGenerating?: boolean;
    driveImageUrl?: string | null;
    activeTool?: 'select' | 'text' | 'arrow' | 'pen' | 'eraser';
    onSocketMouseDown: (nodeId: string, socketId: string, e: React.MouseEvent) => void;
    onSocketMouseUp: (nodeId: string, socketId: string) => void;
    onSocketMouseEnter?: (nodeId: string, socketId: string) => void;
    onSocketMouseLeave?: () => void;
}

export const GenerationNode: React.FC<GenerationNodeProps> = ({ item, onGenerate, onUpdate, isGenerating = false, driveImageUrl, activeTool = 'select', onSocketMouseDown, onSocketMouseUp, onSocketMouseEnter, onSocketMouseLeave }) => {
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [apiKeyValue, setApiKeyValue] = useState(localStorage.getItem('gemini_api_key') || '');

    // Default values if not set
    const params = item.generationParams || {
        aspectRatio: '2:3',
        resolution: '1k',
        model: 'gemini-2.5',
        batchSize: 1
    };

    const handleChange = (key: string, value: string) => {
        const newParams = { ...params, [key]: value };
        const updates: any = { generationParams: newParams };

        if (key === 'aspectRatio') {
            const [w, h] = value.split(':').map(Number);
            const ratio = w / h;

            // Resize node to match aspect ratio
            // Maintain current width unless it's too small, then calculate height
            const MIN_DIMENSION = 400;

            let newWidth = Math.max(item.width, MIN_DIMENSION);
            let newHeight = Math.round(newWidth / ratio);

            // Ensure height isn't too small
            if (newHeight < MIN_DIMENSION) {
                newHeight = MIN_DIMENSION;
                newWidth = Math.round(newHeight * ratio);
            }

            updates.width = newWidth;
            updates.height = newHeight;
        }

        onUpdate(item.id, updates);
    };

    // Ensure resolution is valid for the selected model
    // If model is gemini-2.5 and resolution is not 1k, reset to 1k
    useEffect(() => {
        const currentModel = item.generationParams?.model || 'gemini-2.5';
        const currentResolution = item.generationParams?.resolution || '1k';

        if (currentModel === 'gemini-2.5' && currentResolution !== '1k') {
            onUpdate(item.id, {
                generationParams: {
                    ...(item.generationParams || {
                        aspectRatio: '2:3',
                        resolution: '1k',
                        model: 'gemini-2.5',
                        style: 'structure'
                    }),
                    resolution: '1k'
                }
            });
        }
        // Gemini 3.0 (NanoBanana Pro) supports higher resolutions, so we don't force reset it here.
    }, [item.generationParams?.model, item.generationParams?.resolution, item.id, onUpdate]);

    // Timer functionality
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        if (isGenerating) {
            setElapsedTime(0);
            const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
            return () => clearInterval(timer);
        } else {
            setElapsedTime(0);
        }
    }, [isGenerating]);

    // Format time
    const formatTime = (seconds: number) => {
        return `${seconds}s`;
    };

    const handleSaveApiKey = () => {
        if (apiKeyValue.trim()) {
            localStorage.setItem('gemini_api_key', apiKeyValue.trim());
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        setShowApiKeyInput(false);
    };

    const handleDownload = async () => {
        try {
            const downloadUrl = item.driveFileId && driveImageUrl
                ? driveImageUrl
                : item.src;

            if (!downloadUrl) return;

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = item.fileName || `generated_${item.id}.png`;
            link.click();
        } catch (error) {
            console.error('Failed to download image:', error);
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col overflow-visible pointer-events-none">
            {/* --- Connection Handles (Sockets) --- */}
            <div className="absolute inset-0 pointer-events-auto">
                {/* 1. Text Input Handle (Left Bottom - Lower) - T Icon */}
                <div
                    className="absolute -left-12 bottom-4 w-12 h-12 flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair z-50"
                    title="Text Input"
                    data-handle-id="text-input"
                    data-node-id={item.id}
                    onMouseDown={(e) => onSocketMouseDown(item.id, 'text-input', e)}
                    onMouseUp={() => onSocketMouseUp(item.id, 'text-input')}
                    onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'text-input')}
                    onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
                >
                    <div className="w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center shadow-lg relative">
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-800 opacity-60"></div>
                        <div className="border-[1.5px] border-gray-300 rounded-[4px] w-4 h-4 flex items-center justify-center scale-90">
                            <span className="text-gray-200 text-[10px] font-bold font-serif leading-none mt-[1px]">T</span>
                        </div>
                    </div>
                </div>

                {/* 2. Image Input Handle (Left Bottom - Upper) - Image Icon */}
                <div
                    className="absolute -left-12 bottom-16 w-12 h-12 flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair z-50"
                    title="Image Input"
                    data-handle-id="image-input"
                    data-node-id={item.id}
                    onMouseDown={(e) => onSocketMouseDown(item.id, 'image-input', e)}
                    onMouseUp={() => onSocketMouseUp(item.id, 'image-input')}
                    onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'image-input')}
                    onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
                >
                    <div className="w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center shadow-lg relative">
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-900 opacity-60"></div>
                        <svg className="w-4 h-4 text-gray-300 transform scale-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>

                {/* 3. Image Output Handle (Right Top) - Image Icon */}
                <div
                    className="absolute -right-12 top-4 w-12 h-12 flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair z-50"
                    title="Image Output"
                    data-handle-id="image-output"
                    data-node-id={item.id}
                    onMouseDown={(e) => onSocketMouseDown(item.id, 'image-output', e)}
                    onMouseUp={() => onSocketMouseUp(item.id, 'image-output')}
                    onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'image-output')}
                    onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
                >
                    <div className="w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center shadow-lg relative">
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-900 opacity-60"></div>
                        <svg className="w-4 h-4 text-gray-300 transform scale-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Image Layer */}
            <div className={`absolute inset-0 z-0 ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : 'pointer-events-auto'} flex items-center justify-center bg-[#111] rounded-3xl overflow-hidden`}>
                {driveImageUrl ? (
                    <img
                        src={driveImageUrl}
                        alt="Generated"
                        className="w-full h-full object-contain"
                        draggable={false}
                    />
                ) : item.src ? (
                    <img
                        src={item.src}
                        alt="Generated"
                        className="w-full h-full object-contain"
                        draggable={false}
                        onError={(e) => {
                            // Fallback if base64 is invalid or corrupted
                            console.error('Failed to load base64 image');
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : null}
            </div>

            {/* Generating LED Border Effect */}
            {isGenerating && (
                <div className="absolute inset-0 z-10 pointer-events-none rounded-3xl overflow-visible">
                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                        <defs>
                            <linearGradient id={`ledGradient-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" /> {/* Emerald-500 */}
                                <stop offset="50%" stopColor="#06b6d4" /> {/* Cyan-500 */}
                                <stop offset="100%" stopColor="#6366f1" /> {/* Indigo-500 */}
                            </linearGradient>
                        </defs>
                        {/* Glow Layer (Blurry Gradient) */}
                        <rect
                            x="0" y="0" width="100%" height="100%"
                            rx="24" ry="24"
                            fill="none"
                            stroke={`url(#ledGradient-${item.id})`}
                            strokeWidth="6"
                            strokeDasharray="30 70"
                            strokeLinecap="round"
                            pathLength="100"
                            style={{ filter: 'blur(4px)', opacity: 0.8 }}
                        >
                            <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
                        </rect>
                        {/* Core Layer (Sharp White/Gradient) */}
                        <rect
                            x="0" y="0" width="100%" height="100%"
                            rx="24" ry="24"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeDasharray="30 70"
                            strokeLinecap="round"
                            pathLength="100"
                            style={{ opacity: 0.9 }}
                        >
                            <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />
                        </rect>
                    </svg>
                </div>
            )}

            {/* Top Control Bar - Show only when NOT generating */}
            {!isGenerating && (
                <div
                    className={`absolute top-2 left-2 right-2 h-10 flex items-center justify-between gap-2 z-[100] ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : 'pointer-events-auto'}`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="bg-black/60 backdrop-blur-md rounded-lg shadow-lg px-3 py-1.5 flex items-center gap-1.5 border border-white/20 flex-1 pointer-events-auto min-w-0">
                        {/* Left: Model Selector */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <select
                                value={params.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="bg-transparent text-white text-[11px] font-medium border-none outline-none cursor-pointer hover:text-gray-200 pr-2"
                                style={{ minWidth: '100px', maxWidth: '140px' }}
                            >
                                <option value="gemini-2.5" className="bg-gray-800">NanoBanana</option>
                                <option value="gemini-3-pro-image-preview" className="bg-gray-800">NanoBanana Pro</option>
                            </select>
                            <svg className="w-3 h-3 text-white/60 pointer-events-none flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>

                        {/* Center: Resolution & Aspect Ratio */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Resolution */}
                            <div className="flex items-center gap-1 border-l border-white/20 pl-1.5">
                                <svg className="w-3 h-3 text-white/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <select
                                    value={params.resolution}
                                    onChange={(e) => handleChange('resolution', e.target.value)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="bg-transparent text-white text-[11px] font-medium border-none outline-none cursor-pointer hover:text-gray-200"
                                    style={{ width: '42px' }}
                                >
                                    {params.model === 'gemini-2.5' ? (
                                        <option value="1k" className="bg-gray-800">1K</option>
                                    ) : (
                                        <>
                                            <option value="1k" className="bg-gray-800">1K</option>
                                            <option value="2k" className="bg-gray-800">2K</option>
                                            <option value="4k" className="bg-gray-800">4K</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Aspect Ratio */}
                            <div className="flex items-center gap-1 border-l border-white/20 pl-1.5">
                                <svg className="w-3 h-3 text-white/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <select
                                    value={params.aspectRatio}
                                    onChange={(e) => handleChange('aspectRatio', e.target.value)}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="bg-transparent text-white text-[11px] font-medium border-none outline-none cursor-pointer hover:text-gray-200"
                                    style={{ width: '52px' }}
                                >
                                    <option value="1:1" className="bg-gray-800">1:1</option>
                                    <option value="2:3" className="bg-gray-800">2:3</option>
                                    <option value="3:2" className="bg-gray-800">3:2</option>
                                    <option value="3:4" className="bg-gray-800">3:4</option>
                                    <option value="4:3" className="bg-gray-800">4:3</option>
                                    <option value="4:5" className="bg-gray-800">4:5</option>
                                    <option value="5:4" className="bg-gray-800">5:4</option>
                                    <option value="9:16" className="bg-gray-800">9:16</option>
                                    <option value="16:9" className="bg-gray-800">16:9</option>
                                    <option value="21:9" className="bg-gray-800">21:9</option>
                                </select>
                            </div>
                        </div>



                        {/* --- Batch Size Selector --- */}
                        <div className="flex items-center gap-1 border-l border-white/20 pl-1.5 flex-shrink-0">
                            <span className="text-[10px] text-white/50 font-medium flex-shrink-0">Batch</span>
                            <select
                                value={params.batchSize || 1}
                                onChange={(e) => handleChange('batchSize', e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="bg-transparent text-white text-[11px] font-medium border-none outline-none cursor-pointer hover:text-gray-200"
                                style={{ width: '36px' }}
                            >
                                <option value="1" className="bg-gray-800">1</option>
                                <option value="2" className="bg-gray-800">2</option>
                                <option value="4" className="bg-gray-800">4</option>
                                <option value="8" className="bg-gray-800">8</option>
                            </select>
                        </div>

                        <div className="flex-1 min-w-[8px]" />

                        {/* Right: Settings, Download, Play */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Settings Button */}
                            <button
                                className="text-white/80 hover:text-white p-1 transition-colors"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowApiKeyInput(!showApiKeyInput);
                                }}
                                title="Settings (API Key)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>

                            {/* Refresh Button */}
                            {!isGenerating && (driveImageUrl || (item.generatedHistory && item.generatedHistory.length > 0)) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const baseFileName = item.fileName?.split('?')[0] || `generated_${item.id}.png`;
                                        onUpdate(item.id, {
                                            fileName: `${baseFileName}?t=${Date.now()}`
                                        });
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-all"
                                    title="Refresh Image"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}

                            {/* Download Button */}
                            {!isGenerating && (driveImageUrl || item.src) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload();
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-all"
                                    title="Download Current Image"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </button>
                            )}

                            {/* Play Button (Generate) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onGenerate();
                                }}
                                disabled={isGenerating}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isGenerating
                                    ? 'bg-white/30 cursor-not-allowed text-white/50'
                                    : 'bg-white hover:bg-white/90 text-black shadow-lg'
                                    }`}
                                title="Generate"
                            >
                                {isGenerating ? (
                                    <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* --- History Gallery (Bottom) --- */}
            {/* Show only if there is history and NOT generating (or show during generation? user said show generated images...) */}
            {/* User requested: "generated images appear as small thumbnails below, 4 columns x 2 rows" */}
            {
                item.generatedHistory && item.generatedHistory.length > 0 && !isGenerating && (
                    <div
                        className={`absolute top-[calc(100%+8px)] left-0 right-0 z-50 pointer-events-auto bg-[#1a1a1a]/90 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-xl transition-opacity duration-300`}
                    >
                        <div className="grid grid-cols-4 gap-2">
                            {item.generatedHistory.map((histItem) => (
                                <HistoryThumbnail
                                    key={histItem.id}
                                    src={histItem.src}
                                    driveFileId={histItem.driveFileId}
                                    currentDriveFileId={item.driveFileId}
                                    onClick={() => {
                                        if (histItem.driveFileId) {
                                            // New Item: Load from Drive
                                            onUpdate(item.id, {
                                                driveFileId: histItem.driveFileId,
                                                src: '', // Clear src to load from Drive
                                            });
                                        } else {
                                            // Old Item: Use stored base64 src
                                            onUpdate(item.id, {
                                                src: histItem.src || '',
                                                driveFileId: undefined
                                            });
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Empty State Overlay */}
            {
                !driveImageUrl && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-white/60 flex flex-col items-center gap-2 select-none bg-black/40 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10">
                            {/* Modern Outline "Magic/Sparkles" Icon */}
                            <svg className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span className="text-xs font-medium tracking-wide">Connect inputs & generate</span>
                        </div>
                        {/* Floating Play Button for Empty State */}
                        <div className={`absolute top-2 right-2 ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onGenerate();
                                }}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-white hover:bg-white/90 text-black shadow-lg"
                                title="Generate"
                            >
                                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )
            }

            {/* MINIMALIST LOADING UI */}
            {
                isGenerating && (
                    <div className="absolute inset-0 bg-[#1a1a1a] flex flex-col justify-end p-6 z-20 pointer-events-none overflow-hidden rounded-xl">
                        <style>
                            {`
                        @keyframes border-flow {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        `}
                        </style>

                        {/* LED Border Effect */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div
                                className="absolute -inset-[150%] opacity-100"
                                style={{
                                    background: 'conic-gradient(from 0deg, transparent 0deg, transparent 80deg, #10b981 120deg, transparent 180deg)',
                                    animation: 'border-flow 3s linear infinite',
                                }}
                            />
                            {/* Inner Mask to create border look */}
                            <div className="absolute inset-[2px] bg-[#1a1a1a] rounded-lg" />
                        </div>

                        {/* Content Layer (Above Border) */}
                        <div className="relative z-10 w-full flex justify-between items-end">
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-300 text-sm font-light tracking-wide opacity-90">
                                    Generating image...
                                </span>
                                <span className="text-gray-500 text-xs font-mono">
                                    {formatTime(elapsedTime)}
                                </span>
                            </div>

                            {/* Stop Icon (Visual Only) */}
                            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-gray-700 opacity-80">
                                <div className="w-2.5 h-2.5 bg-gray-400 rounded-sm" />
                            </div>
                        </div>
                    </div>
                )
            }

            {/* API Key Input Overlay */}
            {
                showApiKeyInput && (
                    <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-center items-center z-30 p-4 ${activeTool === 'pen' || activeTool === 'eraser' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                        <div className="bg-[#252525] border border-gray-600 rounded-lg p-4 w-full max-w-md">
                            <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Gemini API Key
                            </h3>
                            <p className="text-gray-400 text-xs mb-3">
                                Get free key: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">aistudio.google.com</a>
                            </p>
                            <input
                                type="password"
                                value={apiKeyValue}
                                onChange={(e) => setApiKeyValue(e.target.value)}
                                placeholder="AIza..."
                                className="w-full bg-[#1e1e1e] text-white text-xs px-3 py-2 rounded border border-gray-700 focus:border-purple-500 outline-none mb-3"
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveApiKey}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 rounded font-medium"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setShowApiKeyInput(false)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
