import React, { useState } from 'react';

interface SelectionBoxProps {
    onSelectionComplete: (box: { x: number; y: number; width: number; height: number }) => void;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({ onSelectionComplete }) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only start selecting if clicking on canvas background
        if (e.button === 0 && e.target === e.currentTarget) {
            setIsSelecting(true);
            setStartPos({ x: e.clientX, y: e.clientY });
            setCurrentPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSelecting) {
            setCurrentPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (isSelecting) {
            const box = {
                x: Math.min(startPos.x, currentPos.x),
                y: Math.min(startPos.y, currentPos.y),
                width: Math.abs(currentPos.x - startPos.x),
                height: Math.abs(currentPos.y - startPos.y)
            };

            if (box.width > 5 && box.height > 5) {
                onSelectionComplete(box);
            }

            setIsSelecting(false);
        }
    };

    const boxStyle = {
        left: Math.min(startPos.x, currentPos.x),
        top: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y)
    };

    return (
        <div
            className="absolute inset-0 pointer-events-auto"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {isSelecting && (
                <div
                    className="fixed border-2 border-blue-400 bg-blue-400/10 pointer-events-none z-[10000]"
                    style={boxStyle}
                />
            )}
        </div>
    );
};
