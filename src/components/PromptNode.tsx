import React, { useState, useRef, useEffect } from 'react';
import { MediaItemData } from './MediaItem';

interface PromptNodeProps {
    item: MediaItemData;
    onUpdate: (id: string, data: Partial<MediaItemData>) => void;
    onSocketMouseDown: (nodeId: string, socketId: string, e: React.MouseEvent) => void;
    onSocketMouseUp: (nodeId: string, socketId: string) => void;
    onSocketMouseEnter?: (nodeId: string, socketId: string) => void;
    onSocketMouseLeave?: () => void;
}

export const PromptNode: React.FC<PromptNodeProps> = ({ item, onUpdate, onSocketMouseDown, onSocketMouseUp, onSocketMouseEnter, onSocketMouseLeave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = useState(item.promptText || '');

    // Sync local text with prop when not editing (in case of external updates)
    useEffect(() => {
        if (!isEditing) {
            setLocalText(item.promptText || '');
        }
    }, [item.promptText, isEditing]);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };

    return (
        <div
            className="w-full h-full bg-[#1a1a1a] border border-gray-700 rounded-3xl flex flex-col overflow-visible shadow-xl relative"
            onDoubleClick={handleDoubleClick}
        >
            {/* --- Connection Handles --- */}
            {/* --- Connection Handles --- */}
            <div className="absolute top-4 -right-12 w-12 h-12 flex items-center justify-center pointer-events-auto z-50"
                onMouseEnter={() => onSocketMouseEnter && onSocketMouseEnter(item.id, 'text-output')}
                onMouseLeave={() => onSocketMouseLeave && onSocketMouseLeave()}
            >
                {/* Text Output Handle (Right Top) - T Icon */}
                <div
                    className="w-8 h-8 bg-[#1f2937] rounded-full border border-[#4b5563] flex items-center justify-center transform hover:scale-110 transition-transform cursor-crosshair shadow-lg relative group"
                    title="Text Output"
                    data-handle-id="text-output"
                    data-node-id={item.id}
                    onMouseDown={(e) => onSocketMouseDown(item.id, 'text-output', e)}
                    onMouseUp={() => onSocketMouseUp(item.id, 'text-output')}
                >
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500 opacity-80 animate-pulse"></div>
                    <div className="border-[1.5px] border-white rounded-[4px] w-4 h-4 flex items-center justify-center scale-90">
                        <span className="text-white text-[10px] font-bold font-serif leading-none mt-[1px]">T</span>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="h-8 bg-[#252525] border-b border-gray-700 flex items-center px-3 cursor-move rounded-t-3xl">
                <span className="text-[10px] text-gray-400 font-medium">📝 Text #{item.id.slice(-2)}</span>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow p-3 flex flex-col">
                <textarea
                    ref={textareaRef}
                    className={`w-full h-full bg-transparent text-gray-300 text-sm p-0 rounded resize-none focus:outline-none placeholder-gray-600 ${isEditing ? 'cursor-text' : 'cursor-move pointer-events-none'
                        }`}
                    placeholder="Double-click to edit..."
                    value={localText}
                    onChange={(e) => setLocalText(e.target.value)}
                    onMouseDown={(e) => {
                        if (isEditing) {
                            e.stopPropagation(); // Allow text selection when editing
                        }
                    }}
                    onKeyDown={(e) => {
                        if (isEditing) {
                            e.stopPropagation();
                        }
                    }}
                    onKeyUp={(e) => {
                        if (isEditing) {
                            e.stopPropagation();
                        }
                    }}
                    onBlur={() => {
                        handleBlur();
                        // Sync with parent on blur
                        if (localText !== item.promptText) {
                            onUpdate(item.id, { promptText: localText });
                        }
                    }}
                    readOnly={!isEditing}
                />
            </div>
        </div>
    );
};
