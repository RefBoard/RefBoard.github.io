import { createContext, useContext } from 'react';

export interface CanvasRefs {
    scaleRef: React.MutableRefObject<number>;
    positionRef: React.MutableRefObject<{ x: number; y: number }>;
    visualTransformRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
    containerRef: React.RefObject<HTMLDivElement>;
}

const CanvasRefContext = createContext<CanvasRefs>({
    scaleRef: { current: 1 },
    positionRef: { current: { x: 0, y: 0 } },
    visualTransformRef: { current: { x: 0, y: 0, scale: 1 } },
    containerRef: { current: null }
});

export const useCanvasRefs = () => useContext(CanvasRefContext);

export default CanvasRefContext;
