import React, { useEffect, useState } from 'react';

interface ToastProps {
    message: string | null;
    duration?: number;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300); // Wait for fade out animation
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration, onClose]);

    if (!message && !isVisible) return null;

    return (
        <div
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 transform transition-all duration-300 z-[10002] flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl border border-gray-600/50 backdrop-blur-md ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}
            style={{
                backgroundColor: 'rgba(31, 41, 55, 0.9)', // gray-800 with opacity
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
        >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{message}</span>
            </div>
        </div>
    );
};
