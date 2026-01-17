import React from 'react';
import { CursorPosition } from '../services/collaboration';

interface CollaboratorCursorsProps {
    cursors: CursorPosition[];
}


export const CollaboratorCursors: React.FC<CollaboratorCursorsProps> = ({ cursors }) => {
    // Deduplicate cursors by userId to avoid key conflicts
    const uniqueCursors = React.useMemo(() => {
        const seen = new Set();
        return cursors.filter(cursor => {
            const duplicate = seen.has(cursor.userId);
            seen.add(cursor.userId);
            return !duplicate;
        });
    }, [cursors]);

    return (
        <>
            {uniqueCursors.map((cursor) => (
                <div
                    key={cursor.userId}
                    className="absolute pointer-events-none z-[9999] transition-all duration-75 ease-out"
                    style={{
                        left: `${cursor.x}px`,
                        top: `${cursor.y}px`,
                        transform: 'translate(-2px, -2px)',
                    }}
                >
                    {/* Cursor SVG */}
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                        }}
                    >
                        <path
                            d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                            fill={cursor.color}
                            stroke="white"
                            strokeWidth="1"
                        />
                    </svg>

                    {/* User name label */}
                    <div
                        className="absolute top-12 left-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
                        style={{
                            backgroundColor: cursor.color,
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                    >
                        {cursor.userName || cursor.userEmail.split('@')[0]}
                    </div>
                </div>
            ))}
        </>
    );
};
