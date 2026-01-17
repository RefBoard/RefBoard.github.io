import React from 'react';

interface AdBannerProps {
    showBreakReminder?: boolean;
}

export const AdBanner: React.FC<AdBannerProps> = ({ showBreakReminder = false }) => {
    // Carbon Ads HTML 경로
    const adUrl = '/carbon-ad.html';

    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-none hidden lg:block">
            <div className="pointer-events-auto bg-black/60 backdrop-blur-xl rounded-2xl p-3 shadow-2xl border border-white/10 ring-1 ring-white/5">

                {/* 광고 영역 (WebView - Carbon Ads) */}
                <div className="bg-transparent rounded-xl overflow-hidden relative">
                    <iframe
                        src={adUrl}
                        style={{
                            width: '728px',
                            height: '90px',
                            border: 'none',
                            borderRadius: '12px',
                            backgroundColor: 'transparent'
                        }}
                        sandbox="allow-scripts allow-same-origin"
                        scrolling="no"
                    />
                </div>

                {/* 휴식 메시지 (2시간 후 15분 동안 표시) */}
                {showBreakReminder && (
                    <div className="mt-3 bg-blue-500/20 border border-blue-400/40 rounded-xl p-3 animate-pulse">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">☕</span>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-300">잠깐 휴식을 취하세요!</p>
                                <p className="text-xs text-gray-300 mt-1">
                                    2시간 동안 열심히 작업하셨어요. 건강을 위해 잠시 쉬어가세요. (15분 후 자동으로 사라집니다)
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
