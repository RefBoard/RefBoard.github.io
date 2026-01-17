import React from 'react';

interface ToolbarProps {
    onBackToList?: () => void;
    onShare?: () => void;
    onSave?: () => void;
    boardName?: string;
    opacity: number;
    onOpacityChange: (value: number) => void;
    isAlwaysOnTop: boolean;
    onToggleAlwaysOnTop: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onBackToList,
    onShare,
    onSave: _onSave,
    opacity,
    onOpacityChange,
    isAlwaysOnTop,
    onToggleAlwaysOnTop,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false
}) => {
    return (
        <div className="absolute top-6 left-6 z-50 flex gap-4 items-center select-none">
            {/* Main Action Group */}
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-white/10 ring-1 ring-white/5">
                {onBackToList && (
                    <button
                        onClick={onBackToList}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
                        title="Back to List"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden sm:inline">List</span>
                    </button>
                )}

                {/* Undo Button */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${canUndo
                        ? 'text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5'
                        : 'text-gray-600 cursor-not-allowed opacity-50'
                        }`}
                    title="Undo (Ctrl+Z)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-9-15 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                </button>

                {/* Redo Button */}
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${canRedo
                        ? 'text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5'
                        : 'text-gray-600 cursor-not-allowed opacity-50'
                        }`}
                    title="Redo (Ctrl+Y)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 0 1 9-15 9 9 0 0 1 6 2.3L21 13" />
                    </svg>
                </button>

                <div className="w-px h-6 bg-white/10 mx-1" />

                {onShare && (
                    <button
                        onClick={onShare}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-gray-300 hover:text-white hover:bg-blue-600/20 hover:text-blue-200 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
                        title="Share Board"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span className="hidden sm:inline">Share</span>
                    </button>
                )}
                <button
                    onClick={onToggleAlwaysOnTop}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isAlwaysOnTop
                        ? 'bg-blue-600/90 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] ring-1 ring-blue-400/50'
                        : 'text-gray-300 hover:text-white hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                    title="Toggle Always on Top"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isAlwaysOnTop ? 'fill-white/20' : ''}>
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                    <span className="hidden sm:inline">{isAlwaysOnTop ? 'On Top' : 'Pin'}</span>
                </button>
            </div>

            {/* Opacity Slider */}
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-2xl border border-white/10 ring-1 ring-white/5 h-full group transition-all duration-300 hover:bg-black/60">
                <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-wider">Opacity</span>
                <input
                    type="range"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                    className="w-24 h-1.5 bg-gray-700/50 rounded-lg appearance-none cursor-pointer slider hover:h-2 transition-all duration-200"
                    style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${opacity * 100}%, #374151 ${opacity * 100}%, #374151 100%)`
                    }}
                />
                <span className="text-xs font-mono text-gray-400 w-9 text-right group-hover:text-white transition-colors">{Math.round(opacity * 100)}%</span>
            </div>
        </div>
    );
};
