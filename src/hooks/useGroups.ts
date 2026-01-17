import { useState, useRef, useEffect, useCallback } from 'react';
import { updateRemoteData } from '../services/collaboration';

export interface GroupData {
    id: string;
    name: string;
    childIds: string[];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    backgroundColor?: string; // Background color for the group content area
}

export const useGroups = (boardId: string | null) => {
    const [groups, setGroups] = useState<GroupData[]>([]);

    // Ref for stable state access in callbacks
    const groupsRef = useRef(groups);
    useEffect(() => {
        groupsRef.current = groups;
    }, [groups]);

    // Calculate rotated bounding box corners
    const getRotatedCorners = (x: number, y: number, width: number, height: number, rotation: number) => {
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const corners = [
            { x: x - centerX, y: y - centerY },
            { x: x + width - centerX, y: y - centerY },
            { x: x + width - centerX, y: y + height - centerY },
            { x: x - centerX, y: y + height - centerY }
        ];

        return corners.map(corner => ({
            x: corner.x * cos - corner.y * sin + centerX,
            y: corner.x * sin + corner.y * cos + centerY
        }));
    };

    // Depend on boardId so it updates if board changes
    const syncGroups = useCallback((newGroups: GroupData[]) => {
        if (boardId && boardId !== 'new') {
            updateRemoteData(boardId, 'groups', newGroups);
        }
    }, [boardId]);

    const createGroup = useCallback((_itemIds: string[], items: any[]) => {
        const groups = groupsRef.current;
        // Filter out items with invalid coordinates to prevent NaN groups
        const validItems = items.filter(item =>
            typeof item.x === 'number' && !isNaN(item.x) &&
            typeof item.y === 'number' && !isNaN(item.y) &&
            typeof item.width === 'number' && !isNaN(item.width) &&
            typeof item.height === 'number' && !isNaN(item.height)
        );

        if (validItems.length < 2) return;

        const validItemIds = validItems.map(i => i.id);

        // Calculate bounding box considering rotation
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        validItems.forEach(item => {
            let corners;

            // For media items with rotation
            if (item.type === 'image' || item.type === 'video') {
                const rotation = item.rotation || 0;
                corners = getRotatedCorners(item.x, item.y, item.width, item.height, rotation);
            } else {
                // For text items (no rotation support yet)
                corners = [
                    { x: item.x, y: item.y },
                    { x: item.x + item.width, y: item.y },
                    { x: item.x + item.width, y: item.y + item.height },
                    { x: item.x, y: item.y + item.height }
                ];
            }

            corners.forEach(corner => {
                minX = Math.min(minX, corner.x);
                minY = Math.min(minY, corner.y);
                maxX = Math.max(maxX, corner.x);
                maxY = Math.max(maxY, corner.y);
            });
        });

        const padding = 10;
        const x = minX - padding;
        const y = minY - padding;
        const width = (maxX - minX) + padding * 2;
        const height = (maxY - minY) + padding * 2;

        const newGroup: GroupData = {
            id: `group-${Date.now()}`,
            name: `Group ${groups.length + 1}`,
            childIds: validItemIds,
            x,
            y,
            width,
            height,
            fontSize: 100,
            color: '#ffffff'
        };

        const updatedGroups = [...groups, newGroup];
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]); // Stable callback

    const updateGroup = useCallback((id: string, data: Partial<GroupData>) => {
        const groups = groupsRef.current;
        console.log('[updateGroup] id:', id, 'data:', data);
        const updatedGroups = groups.map(group => {
            if (group.id === id) {
                const updated = { ...group, ...data };
                // Ensure childIds is always an array
                if (!updated.childIds || !Array.isArray(updated.childIds)) {
                    updated.childIds = group.childIds || [];
                }
                return updated;
            }
            return group;
        });
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]); // Stable callback using ref

    const updateGroupName = useCallback((id: string, name: string) => {
        const groups = groupsRef.current;
        const updatedGroups = groups.map(group =>
            group.id === id ? { ...group, name } : group
        );
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]);

    const deleteGroup = useCallback((id: string) => {
        const groups = groupsRef.current;
        const updatedGroups = groups.filter(group => group.id !== id);
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]);

    const addItemToGroup = useCallback((groupId: string, itemId: string) => {
        const groups = groupsRef.current;
        const updatedGroups = groups.map(group =>
            group.id === groupId
                ? { ...group, childIds: [...(group.childIds || []), itemId] }
                : group
        );
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]);

    const removeItemFromGroup = useCallback((itemId: string) => {
        const groups = groupsRef.current;
        const updatedGroups = groups.map(group => ({
            ...group,
            childIds: (group.childIds || []).filter(id => id !== itemId)
        }));
        setGroups(updatedGroups);
        syncGroups(updatedGroups);
    }, [syncGroups]);

    const getItemGroup = useCallback((itemId: string): GroupData | null => {
        const groups = groupsRef.current;
        return groups.find(group => group && group.childIds && Array.isArray(group.childIds) && group.childIds.includes(itemId)) || null;
    }, []);

    return {
        groups,
        setGroups,
        createGroup,
        updateGroup,
        updateGroupName,
        deleteGroup,
        addItemToGroup,
        removeItemFromGroup,
        getItemGroup
    };
};
