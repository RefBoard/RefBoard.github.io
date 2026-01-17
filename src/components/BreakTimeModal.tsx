import React, { useState, useEffect } from 'react';

interface BreakTimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    breakDuration: number; // 초 단위 (900 = 15분)
}

export const BreakTimeModal: React.FC<BreakTimeModalProps> = ({ isOpen, onClose, breakDuration }) => {
    const [remainingTime, setRemainingTime] = useState(breakDuration);
    const [canSkip, setCanSkip] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setRemainingTime(breakDuration);
            setCanSkip(false);
            return;
        }

        // 타이머 시작
        const timer = setInterval(() => {
            setRemainingTime((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // 3분 후 건너뛰기 버튼 활성화
        const skipTimer = setTimeout(() => {
            setCanSkip(true);
        }, 180000); // 3분 = 180초

        return () => {
            clearInterval(timer);
            clearTimeout(skipTimer);
        };
    }, [isOpen, breakDuration, onClose]);

    if (!isOpen) return null;

    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    const motivationalMessages = [
        "잠깐 일어나서 스트레칭을 해보세요 🧘‍♂️",
        "눈을 감고 깊게 호흡해보세요 🌬️",
        "창밖을 바라보며 눈의 피로를 풀어주세요 👀",
        "물 한 잔 마시며 쉬어가세요 💧",
        "가벼운 산책으로 기분 전환해보세요 🚶‍♂️",
        "잠시 휴대폰을 내려놓고 휴식하세요 📵"
    ];

    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-500/50 rounded-3xl p-8 w-[900px] shadow-2xl shadow-blue-500/20">
                {/* 헤더 */}
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">☕</div>
                    <h2 className="text-4xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        휴식 시간입니다
                    </h2>
                    <p className="text-xl text-gray-300">
                        {randomMessage}
                    </p>
                </div>

                {/* 타이머 */}
                <div className="mb-8">
                    <div className="bg-black/40 rounded-2xl p-6 text-center border border-white/10">
                        <div className="text-7xl font-mono font-bold text-blue-400 mb-2">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </div>
                        <div className="text-sm text-gray-400">남은 휴식 시간</div>
                    </div>
                </div>

                {/* 광고 영역 (WebView) */}
                <div className="mb-6 bg-black/20 rounded-2xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">스폰서 메시지</span>
                        <span className="text-xs text-gray-600 px-2 py-1 bg-black/40 rounded">AD</span>
                    </div>

                    {/* WebView 영역 - 나중에 실제 광고로 교체 */}
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl h-[180px] flex items-center justify-center border border-white/5 overflow-hidden relative group">
                        {/* 임시 플레이스홀더 */}
                        <webview
                            src="about:blank"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none'
                            }}
                            className="hidden"
                        />
                        <div className="text-center opacity-40">
                            <p className="text-sm text-gray-400 mb-2">휴식 중 스폰서 광고</p>
                            <p className="text-xs text-gray-600">728 x 180</p>
                            <p className="text-xs text-gray-700 mt-3">광고 수익으로 앱을 무료로 제공합니다</p>
                        </div>
                    </div>
                </div>

                {/* 건강 팁 */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-blue-400 mb-1">건강 TIP</h3>
                            <p className="text-xs text-gray-300">
                                근로기준법에 따라 4시간 작업 시 30분 휴식이 권장됩니다.
                                규칙적인 휴식은 집중력과 창의성을 향상시킵니다.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 버튼 */}
                <div className="flex justify-center gap-4">
                    {canSkip && (
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all text-sm font-medium"
                        >
                            충분히 쉬었어요 (건너뛰기)
                        </button>
                    )}
                    {!canSkip && (
                        <div className="text-sm text-gray-500">
                            💆‍♂️ 3분 후 건너뛰기 버튼이 활성화됩니다
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
