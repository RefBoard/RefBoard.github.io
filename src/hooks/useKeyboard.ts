import { useState, useEffect } from 'react';

export const useKeyboard = () => {
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            let key = e.key;
            if (key === 'Control') key = 'Ctrl';
            if (key === 'Alt') key = 'Alt';
            if (key === 'Shift') key = 'Shift';

            setPressedKeys(prev => {
                const upperKey = key.toUpperCase();
                // If key is already pressed, don't update state (prevents re-renders from key repeat)
                if (prev.has(upperKey)) return prev;

                const newKeys = new Set(prev);
                newKeys.add(upperKey);
                return newKeys;
            });
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            let key = e.key;
            if (key === 'Control') key = 'Ctrl';
            if (key === 'Alt') key = 'Alt';
            if (key === 'Shift') key = 'Shift';

            setPressedKeys(prev => {
                const newKeys = new Set(prev);
                newKeys.delete(key.toUpperCase());
                return newKeys;
            });
        };

        // Clear keys on window blur to prevent "stuck" keys
        const handleBlur = () => {
            setPressedKeys(new Set());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    return pressedKeys;
};
