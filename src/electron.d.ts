interface ElectronAPI {
    toggleAlwaysOnTop: () => Promise<boolean>;
    setOpacity: (opacity: number) => Promise<void>;
    startWindowMove: (mouseX: number, mouseY: number) => void;
    moveWindow: (mouseX: number, mouseY: number) => void;
    endWindowMove: () => void;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    saveFile: (data: any) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
    saveFileAs: (data: any) => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
    openFile: () => Promise<{ success: boolean; canceled?: boolean; data?: any; path?: string; error?: string }>;
    savePSDFile: (fileData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    openInPhotoshop: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    selectPhotoshopPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
    setPhotoshopPath: (path: string) => Promise<{ success: boolean; error?: string }>;
    watchPSDFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    unwatchPSDFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    readPSDFile: (filePath: string) => Promise<{ success: boolean; data?: ArrayBuffer; error?: string }>;
    checkPSDFileModified: (filePath: string) => Promise<{ success: boolean; modifiedTime?: number; size?: number; error?: string }>;
    onPSDFileChanged: (callback: (data: { path: string }) => void) => void;
    removePSDFileChangedListener: () => void;
    openExternal: (url: string) => Promise<void>;
    readClipboardImage: () => Promise<{ success: boolean; data?: string; width?: number; height?: number; error?: string }>;
    copyImageToClipboard: (url: string) => Promise<{ success: boolean; error?: string }>;
    getPathForFile: (file: File) => string;
    onDeepLink: (callback: (url: string) => void) => void;

    // Auth
    exchangeGoogleAuthCode: (code: string) => Promise<{ success: boolean; tokens?: any; error?: string }>;
    getGoogleAccessToken: () => Promise<{ success: boolean; token?: string; error?: string }>;
    logoutGoogle: () => Promise<void>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
