import { createContext, useContext } from 'react';

export interface CanvasTransform {
    scale: number;
    position: { x: number; y: number };
    isSelecting?: boolean;
    scaleRef: React.MutableRefObject<number>;
    positionRef: React.MutableRefObject<{ x: number; y: number }>;
}

const CanvasContext = createContext<CanvasTransform>({
    scale: 1,
    position: { x: 0, y: 0 },
    isSelecting: false,
    scaleRef: { current: 1 },
    positionRef: { current: { x: 0, y: 0 } }
});

export const useCanvasTransform = () => useContext(CanvasContext);

export default CanvasContext;
