const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
    setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),
    startWindowMove: (mouseX, mouseY) => ipcRenderer.send('window-move-start', { mouseX, mouseY }),
    moveWindow: (mouseX, mouseY) => ipcRenderer.send('window-move', { mouseX, mouseY }),
    endWindowMove: () => ipcRenderer.send('window-move-end'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    saveFileAs: (data) => ipcRenderer.invoke('save-file-as', data),
    openFile: () => ipcRenderer.invoke('open-file'),
    savePSDFile: (fileData, fileName) => ipcRenderer.invoke('save-psd-file', { fileData, fileName }),
    openInPhotoshop: (filePath) => ipcRenderer.invoke('open-in-photoshop', filePath),
    selectPhotoshopPath: () => ipcRenderer.invoke('select-photoshop-path'),
    setPhotoshopPath: (path) => ipcRenderer.invoke('set-photoshop-path', path),
    watchPSDFile: (filePath) => ipcRenderer.invoke('watch-psd-file', filePath),
    unwatchPSDFile: (filePath) => ipcRenderer.invoke('unwatch-psd-file', filePath),
    readPSDFile: (filePath) => ipcRenderer.invoke('read-psd-file', filePath),
    checkPSDFileModified: (filePath) => ipcRenderer.invoke('check-psd-file-modified', filePath),
    onPSDFileChanged: (callback) => {
        ipcRenderer.on('psd-file-changed', (event, data) => callback(data));
    },
    removePSDFileChangedListener: () => {
        ipcRenderer.removeAllListeners('psd-file-changed');
    },
    onDeepLink: (callback) => {
        ipcRenderer.on('deep-link', (event, url) => callback(url));
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
    copyImageToClipboard: (url) => ipcRenderer.invoke('copy-image-to-clipboard', url),
    getPathForFile: (file) => webUtils.getPathForFile(file),

    // Auth
    exchangeGoogleAuthCode: (code) => ipcRenderer.invoke('auth-exchange-code', code),
    getGoogleAccessToken: () => ipcRenderer.invoke('auth-get-token'),
    logoutGoogle: () => ipcRenderer.invoke('auth-logout'),
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type} -version`, process.versions[type])
    }
})
