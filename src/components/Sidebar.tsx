import React from 'react';

interface SidebarProps {
    activeTool: 'select' | 'text' | 'pen' | 'eraser';
    onToolChange: (tool: 'select' | 'text' | 'pen' | 'eraser') => void;
    onSettingsClick: () => void;
    onAlignClick: () => void;
    onCleanupClick: () => void;
    selectedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, onToolChange, onSettingsClick, onAlignClick, onCleanupClick, selectedCount }) => {
    const tools = [
        {
            id: 'select' as const,
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>,
            label: 'Select (V)'
        },
        {
            id: 'text' as const,
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>,
            label: 'Text (T)'
        },
        {
            id: 'pen' as const,
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
            label: 'Pen (P)'
        },
        {
            id: 'eraser' as const,
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12.5l7-7 12 12-7 7-12-12z" /><line x1="12" y1="19" x2="22" y2="19" /></svg>,
            label: 'Eraser (E)'
        },
    ];

    return (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-6 select-none pointer-events-none">
            {/* Tools */}
            <div className="flex flex-col gap-3 bg-black/40 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-white/10 ring-1 ring-white/5 pointer-events-auto">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => onToolChange(tool.id)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${activeTool === tool.id
                            ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)] scale-105 ring-1 ring-blue-400/50'
                            : 'text-gray-400 hover:text-white hover:bg-white/10 hover:scale-110'
                            }`}
                        title={tool.label}
                    >
                        {tool.icon}

                        {/* Tooltip on hover (right side) */}
                        <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            {tool.label}
                        </span>
                    </button>
                ))}

                {/* Divider */}
                <div className="w-full h-px bg-white/10 my-1" />

                {/* Align Button */}
                <button
                    onClick={onAlignClick}
                    disabled={selectedCount < 2}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${selectedCount >= 2
                        ? 'text-gray-400 hover:text-white hover:bg-white/10 hover:scale-110'
                        : 'text-gray-600 opacity-50 cursor-not-allowed'
                        }`}
                    title="Align Selected (Ctrl+L)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                    </svg>

                    {/* Tooltip on hover (right side) */}
                    <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Align Selected (Ctrl+L)
                    </span>
                </button>
            </div>

            {/* Settings */}
            <div className="flex flex-col gap-1 bg-black/40 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-white/10 ring-1 ring-white/5 pointer-events-auto">
                <button
                    onClick={onSettingsClick}
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/10 hover:scale-110 rotate-90 hover:rotate-0 group relative"
                    title="Settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>

                    {/* Tooltip */}
                    <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Settings
                    </span>
                </button>

                {/* Cleanup Button */}
                <button
                    onClick={onCleanupClick}
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 text-gray-400 hover:text-red-400 hover:bg-red-400/10 hover:scale-110 group relative"
                    title="Cleanup Drive"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6m4-6v6" />
                    </svg>

                    {/* Tooltip */}
                    <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Cleanup Drive
                    </span>
                </button>
            </div>
        </div>
    );
};
