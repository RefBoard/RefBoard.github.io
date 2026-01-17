import React, { useState, useEffect } from 'react';

interface TitleBarProps {
    boardName?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ boardName = 'RefBoard' }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Show title bar when mouse is within 50px of top
            if (e.clientY < 50) {
                setIsVisible(true);
            } else if (e.clientY > 100) {
                // Hide when mouse moves away (with some buffer)
                setIsVisible(false);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleMinimize = () => {
        if (window.electronAPI?.minimizeWindow) {
            window.electronAPI.minimizeWindow();
        }
    };

    const handleMaximize = () => {
        if (window.electronAPI?.maximizeWindow) {
            window.electronAPI.maximizeWindow();
        }
    };

    const handleClose = () => {
        if (window.electronAPI?.closeWindow) {
            window.electronAPI.closeWindow();
        }
    };

    return (
        <div
            className={`fixed top-0 left-0 right-0 h-8 bg-black/80 backdrop-blur-sm flex items-center justify-between px-4 z-[10002] transition-transform duration-200 ${isVisible ? 'translate-y-0' : '-translate-y-full'
                }`}
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            {/* App Title */}
            <div className="text-white text-sm font-medium select-none">
                {boardName}
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleMinimize();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-10 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto"
                    title="Minimize"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleMaximize();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-10 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto"
                    title="Maximize"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleClose();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-10 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-600/80 transition-colors pointer-events-auto"
                    title="Close"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
