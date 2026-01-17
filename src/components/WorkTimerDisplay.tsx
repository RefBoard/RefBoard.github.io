import React, { useState, useEffect } from 'react';

interface WorkTimerDisplayProps {
    getRemainingWorkTime: () => number; // 분 단위
}

export const WorkTimerDisplay: React.FC<WorkTimerDisplayProps> = ({ getRemainingWorkTime }) => {
    const [remainingMinutes, setRemainingMinutes] = useState(getRemainingWorkTime());

    useEffect(() => {
        // 1분마다 업데이트 (분 단위이므로)
        const interval = setInterval(() => {
            setRemainingMinutes(getRemainingWorkTime());
        }, 60 * 1000); // 1분마다 업데이트

        return () => clearInterval(interval);
    }, [getRemainingWorkTime]);

    return (
        <div className="fixed top-24 right-6 z-50 select-none pointer-events-none">
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-2xl border border-white/10 pointer-events-auto">
                <div className="flex items-center gap-3">
                    <div className="text-2xl">⏱️</div>
                    <div>
                        <div className="text-xs text-gray-400 mb-1">광고 종료까지</div>
                        <div className="text-2xl font-mono font-bold text-blue-400">
                            {remainingMinutes}분
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
