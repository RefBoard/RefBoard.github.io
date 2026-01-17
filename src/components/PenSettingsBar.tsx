import React from 'react';

interface PenSettingsBarProps {
    color: string;
    size: number;
    isEraser?: boolean;
    onColorChange: (color: string) => void;
    onSizeChange: (size: number) => void;
}

export const PenSettingsBar: React.FC<PenSettingsBarProps> = ({ color, size, isEraser = false, onColorChange, onSizeChange }) => {
    const colors = [
        '#ffffff', // White
        '#ef4444', // Red
        '#f59e0b', // Orange
        '#eab308', // Yellow
        '#22c55e', // Green
        '#3b82f6', // Blue
        '#a855f7', // Purple
        '#ec4899', // Pink
    ];

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-gray-700 rounded-lg p-2 flex items-center gap-4 shadow-xl z-50">
            {/* Size Slider */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{isEraser ? 'Eraser Size' : 'Size'}</span>
                <input
                    type="range"
                    min="1"
                    max="50"
                    value={size}
                    onChange={(e) => onSizeChange(parseInt(e.target.value))}
                    className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-gray-400 w-4">{size}</span>
            </div>

            {!isEraser && (
                <>
                    <div className="w-px h-6 bg-gray-700" />

                    {/* Color Picker - 펜일 때만 표시 */}
                    <div className="flex items-center gap-2">
                        {colors.map(c => (
                            <button
                                key={c}
                                onClick={() => onColorChange(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                                    }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                        <div className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-gray-600 ml-1">
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => onColorChange(e.target.value)}
                                className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
