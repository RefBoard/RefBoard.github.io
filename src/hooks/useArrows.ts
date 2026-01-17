import { useState, useCallback } from 'react';
import { ArrowData } from '../components/Arrow';
import { updateRemoteData } from '../services/collaboration';

interface UseArrowsReturn {
    arrows: ArrowData[];
    setArrows: React.Dispatch<React.SetStateAction<ArrowData[]>>;
    createArrow: (sourceId: string, targetId: string) => void;
    updateArrow: (id: string, updates: Partial<ArrowData>) => void;
    deleteArrow: (id: string) => void;
    deleteArrowsForItem: (itemId: string) => void;
}

export const useArrows = (boardId: string | null): UseArrowsReturn => {
    const [arrows, setArrows] = useState<ArrowData[]>([]);

    const syncArrows = useCallback((newArrows: ArrowData[]) => {
        if (boardId && boardId !== 'new') {
            updateRemoteData(boardId, 'arrows', newArrows);
        }
    }, [boardId]);

    const createArrow = useCallback((sourceId: string, targetId: string) => {
        const newArrow: ArrowData = {
            id: `arrow-${Date.now()}`,
            sourceId,
            targetId,
            color: '#3b82f6',
            strokeWidth: 2
        };
        setArrows(prev => {
            const updated = [...prev, newArrow];
            syncArrows(updated);
            return updated;
        });
    }, [syncArrows]);

    const updateArrow = useCallback((id: string, updates: Partial<ArrowData>) => {
        setArrows(prev => {
            const updated = prev.map(arrow =>
                arrow.id === id ? { ...arrow, ...updates } : arrow
            );
            syncArrows(updated);
            return updated;
        });
    }, [syncArrows]);

    const deleteArrow = useCallback((id: string) => {
        setArrows(prev => {
            const updated = prev.filter(arrow => arrow.id !== id);
            syncArrows(updated);
            return updated;
        });
    }, [syncArrows]);

    const deleteArrowsForItem = useCallback((itemId: string) => {
        setArrows(prev => {
            const updated = prev.filter(
                arrow => arrow.sourceId !== itemId && arrow.targetId !== itemId
            );
            syncArrows(updated);
            return updated;
        });
    }, [syncArrows]);

    return {
        arrows,
        setArrows,
        createArrow,
        updateArrow,
        deleteArrow,
        deleteArrowsForItem
    };
};
