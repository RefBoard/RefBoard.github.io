import React, { useState, useEffect, useRef } from 'react';

export interface ShortcutSettings {
    pan: {
        keys: string[];
        button: 'Left' | 'Middle' | 'Right';
    };
    zoom: {
        keys: string[];
        button: 'Left' | 'Middle' | 'Right';
    };
    zoomWheelModifier: string;
    windowDrag: {
        keys: string[];
        button: 'Left' | 'Middle' | 'Right';
    };
    alwaysOnTop?: string; // Shortcut string (e.g. "CTRL+SHIFT+T")
    opacity?: string;    // Shortcut string (e.g. "CTRL+SHIFT+O")
    opacityDrag?: {
        keys: string[];
        button: 'Left' | 'Middle' | 'Right';
    };
    brushSizeDecrease?: string; // Shortcut string (e.g. "[")
    brushSizeIncrease?: string; // Shortcut string (e.g. "]")
    toggleUi?: string; // Shortcut string (e.g. "U")
    alignItems?: string; // Shortcut string (e.g. "CTRL+A")
    photoshopPath?: string; // Photoshop executable path
}

export interface UISettings {
    canvasBackgroundColor: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: ShortcutSettings;
    uiSettings: UISettings;
    onSave: (newSettings: ShortcutSettings, newUISettings: UISettings) => void;
}

const ShortcutRecorder: React.FC<{
    label: string;
    value: string;
    onRecord: (result: { keys: string[], button?: 'Left' | 'Middle' | 'Right', combo?: string }) => void;
    mode: 'pan' | 'modifier' | 'shortcut';
}> = ({ label, value, onRecord, mode }) => {
    const [isListening, setIsListening] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pressedKeysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (isListening && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isListening]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();

        let key = e.key;
        if (key === 'Control') key = 'Ctrl';
        if (key === 'Alt') key = 'Alt';
        if (key === 'Shift') key = 'Shift';
        if (key === ' ') key = 'Space';

        if (key === 'Escape') {
            setIsListening(false);
            pressedKeysRef.current.clear();
            return;
        }

        pressedKeysRef.current.add(key.toUpperCase());

        if (mode === 'modifier') {
            let mod = key;
            if (key === 'Control') mod = 'Ctrl';
            if (key === 'Alt') mod = 'Alt';
            if (key === 'Shift') mod = 'Shift';

            onRecord({ keys: [mod], combo: mod });
            setIsListening(false);
            pressedKeysRef.current.clear();
        } else if (mode === 'shortcut') {
            // Check if current key is a modifier
            const isModifier = ['CTRL', 'ALT', 'SHIFT', 'META'].includes(key.toUpperCase());

            // If it's not a modifier (e.g. 'T', 'O', '1'), treat as completion of combo
            if (!isModifier) {
                const keys = Array.from(pressedKeysRef.current);
                // Sort sort of? Modifiers first?
                // Simple join
                const combo = keys.join('+');
                onRecord({ keys: [], combo });
                setIsListening(false);
                pressedKeysRef.current.clear();
            }
        }
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mode === 'shortcut') return; // Don't clear for shortcut until completion or clear explicitly? 
        // Actually typical approach: if keys are released without completion, we clear?
        // Let's keep it simple: Release removes from set.
        let key = e.key;
        if (key === 'Control') key = 'Ctrl';
        if (key === 'Alt') key = 'Alt';
        if (key === 'Shift') key = 'Shift';
        if (key === ' ') key = 'Space';

        pressedKeysRef.current.delete(key.toUpperCase());
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
        if (mode !== 'pan' || !isListening) return;

        e.preventDefault();
        e.stopPropagation();

        let button: 'Left' | 'Middle' | 'Right' = 'Left';
        if (e.button === 0) button = 'Left';
        else if (e.button === 1) button = 'Middle';
        else if (e.button === 2) button = 'Right';

        const keys = Array.from(pressedKeysRef.current).map(k => {
            if (k === 'CTRL') return 'Ctrl';
            if (k === 'ALT') return 'Alt';
            if (k === 'SHIFT') return 'Shift';
            return k;
        });

        onRecord({ keys, button });
        setIsListening(false);
        pressedKeysRef.current.clear();
    };

    return (
        <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    readOnly
                    value={isListening ? '' : (value || 'None')}
                    placeholder={isListening ? 'Press keys...' : ''}
                    onClick={() => setIsListening(true)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    onMouseDown={handleMouseDown}
                    onBlur={() => {
                        setIsListening(false);
                        pressedKeysRef.current.clear();
                    }}
                    className={`
                        w-full bg-gray-900 p-3 rounded-lg border cursor-pointer transition-all
                        text-sm font-mono text-white outline-none
                        ${isListening
                            ? 'border-blue-500 ring-2 ring-blue-500/20 placeholder-blue-400'
                            : 'border-gray-700 hover:border-gray-600'
                        }
                    `}
                />
            </div>
        </div>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, uiSettings, onSave }) => {
    const [activeTab, setActiveTab] = useState<'shortcuts' | 'ui'>('shortcuts');
    const [tempSettings, setTempSettings] = useState<ShortcutSettings>(settings);
    const [tempUISettings, setTempUISettings] = useState<UISettings>(uiSettings);

    useEffect(() => {
        if (isOpen) {
            setTempSettings(settings);
            setTempUISettings(uiSettings || {
                canvasBackgroundColor: '#1f1f1f'
            });
        }
    }, [isOpen, settings, uiSettings]);

    if (!isOpen) return null;

    const handleSave = async () => {
        // Save Photoshop path to Electron store if available
        if (tempSettings.photoshopPath && window.electronAPI?.setPhotoshopPath) {
            try {
                await window.electronAPI.setPhotoshopPath(tempSettings.photoshopPath);
            } catch (e) {
                console.error('Failed to save Photoshop path:', e);
            }
        }
        onSave(tempSettings, tempUISettings);
        onClose();
    };

    const getPanDisplay = () => {
        const keys = tempSettings.pan.keys.join(' + ');
        const button = tempSettings.pan.button + ' Click';
        return keys ? `${keys} + ${button} Drag` : button + ' Drag';
    };

    const getZoomDisplay = () => {
        const keys = tempSettings.zoom.keys.join(' + ');
        const button = tempSettings.zoom.button + ' Click';
        return keys ? `${keys} + ${button} Drag` : button + ' Drag';
    };

    const getWindowDragDisplay = () => {
        const keys = tempSettings.windowDrag?.keys.join(' + ') || '';
        const button = (tempSettings.windowDrag?.button || 'Right') + ' Click';
        return keys ? `${keys} + ${button} Drag` : button + ' Drag';
    };

    const getOpacityDragDisplay = () => {
        const keys = tempSettings.opacityDrag?.keys.join(' + ') || '';
        const button = (tempSettings.opacityDrag?.button || 'Right') + ' Click';
        return keys ? `${keys} + ${button} Drag` : button + ' Drag';
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-[500px] shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-6 pb-2 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <div className="flex bg-gray-900 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'shortcuts'
                                ? 'bg-gray-700 text-white shadow'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                        >
                            Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('ui')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'ui'
                                ? 'bg-gray-700 text-white shadow'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                        >
                            UI
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'shortcuts' && (
                        <div className="space-y-6">
                            <ShortcutRecorder
                                label="Pan Board"
                                value={getPanDisplay()}
                                mode="pan"
                                onRecord={(res) => setTempSettings(prev => ({
                                    ...prev,
                                    pan: { keys: res.keys, button: res.button || 'Left' }
                                }))}
                            />

                            <ShortcutRecorder
                                label="Zoom Board (Drag)"
                                value={getZoomDisplay()}
                                mode="pan"
                                onRecord={(res) => setTempSettings(prev => ({
                                    ...prev,
                                    zoom: { keys: res.keys, button: res.button || 'Right' }
                                }))}
                            />

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">Additional Zoom Controls</h3>
                                <ShortcutRecorder
                                    label="Wheel Modifier"
                                    value={tempSettings.zoomWheelModifier + ' + Mouse Wheel'}
                                    mode="modifier"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        zoomWheelModifier: res.combo || 'None'
                                    }))}
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">Window Management</h3>
                                <ShortcutRecorder
                                    label="Move Window"
                                    value={getWindowDragDisplay()}
                                    mode="pan"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        windowDrag: { keys: res.keys, button: res.button || 'Right' }
                                    }))}
                                />
                                <div className="h-4"></div>
                                <ShortcutRecorder
                                    label="Toggle Always On Top"
                                    value={tempSettings.alwaysOnTop || ''}
                                    mode="shortcut"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        alwaysOnTop: res.combo
                                    }))}
                                />
                                <div className="h-4"></div>
                                <ShortcutRecorder
                                    label="Toggle Window Opacity (Ghost Mode)"
                                    value={tempSettings.opacity || ''}
                                    mode="shortcut"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        opacity: res.combo
                                    }))}
                                />
                                <div className="h-4"></div>
                                <ShortcutRecorder
                                    label="Adjust Opacity (Drag)"
                                    value={getOpacityDragDisplay()}
                                    mode="pan"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        opacityDrag: { keys: res.keys, button: res.button || 'Right' }
                                    }))}
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">Drawing Tools</h3>
                                <ShortcutRecorder
                                    label="Decrease Brush Size"
                                    value={tempSettings.brushSizeDecrease || ''}
                                    mode="shortcut"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        brushSizeDecrease: res.combo
                                    }))}
                                />
                                <div className="h-4"></div>
                                <ShortcutRecorder
                                    label="Increase Brush Size"
                                    value={tempSettings.brushSizeIncrease || ''}
                                    mode="shortcut"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        brushSizeIncrease: res.combo
                                    }))}
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">View</h3>
                                <ShortcutRecorder
                                    label="Toggle UI Visibility"
                                    value={tempSettings.toggleUi || 'U'}
                                    mode="shortcut"
                                    onRecord={() => { }} // Read-only for now
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">Item Management</h3>
                                <ShortcutRecorder
                                    label="Align Selected Items"
                                    value={tempSettings.alignItems || 'CTRL+A'}
                                    mode="shortcut"
                                    onRecord={(res) => setTempSettings(prev => ({
                                        ...prev,
                                        alignItems: res.combo
                                    }))}
                                />
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <h3 className="text-sm font-bold text-gray-300 mb-3">External Applications</h3>
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400 font-medium">Photoshop Executable Path</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={tempSettings.photoshopPath || ''}
                                            onChange={(e) => setTempSettings(prev => ({
                                                ...prev,
                                                photoshopPath: e.target.value
                                            }))}
                                            placeholder="C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe"
                                            className="flex-1 bg-gray-900 p-3 rounded-lg border border-gray-700 hover:border-gray-600 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('Browse button clicked');
                                                try {
                                                    if (window.electronAPI?.selectPhotoshopPath) {
                                                        const result = await window.electronAPI.selectPhotoshopPath();
                                                        if (result.success && result.path) {
                                                            setTempSettings(prev => ({
                                                                ...prev,
                                                                photoshopPath: result.path
                                                            }));
                                                        } else if (result.error) {
                                                            alert(`Error: ${result.error}`);
                                                        }
                                                    } else {
                                                        alert('File picker is only available in desktop app');
                                                    }
                                                } catch (error) {
                                                    console.error('Error selecting Photoshop path:', error);
                                                    alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                }
                                            }}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white transition-colors whitespace-nowrap cursor-pointer"
                                        >
                                            Browse
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave empty to auto-detect Photoshop installation
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ui' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-300 border-b border-gray-700 pb-2">Canvas Appearance</h3>

                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-400 font-medium">Background Color</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative group/color w-8 h-8 cursor-pointer rounded-full overflow-hidden border border-gray-600 shadow-md hover:scale-110 transition-transform">
                                            <input
                                                type="color"
                                                value={tempUISettings.canvasBackgroundColor || '#1f1f1f'}
                                                onChange={(e) => setTempUISettings(prev => ({ ...prev, canvasBackgroundColor: e.target.value }))}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div
                                                className="w-full h-full"
                                                style={{ backgroundColor: tempUISettings.canvasBackgroundColor || '#1f1f1f' }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-gray-500 w-16 text-right uppercase">{tempUISettings.canvasBackgroundColor || '#1f1f1f'}</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <p className="text-xs text-blue-200">
                                        💡 Solid background color for the canvas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-700 bg-gray-800 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium text-sm shadow-lg shadow-blue-500/20"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
