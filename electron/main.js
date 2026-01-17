const { app, BrowserWindow, ipcMain, Menu, dialog, shell, protocol, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { google } = require('googleapis');

// Simple file-based store to avoid ESM issues with electron-store
class SimpleStore {
    constructor(opts) {
        const userDataPath = app.getPath('userData');
        this.path = path.join(userDataPath, opts.name + '.json');
        this.data = this.parseDataFile(this.path, opts.defaults);
    }

    get(key) {
        return this.data[key];
    }

    set(key, val) {
        this.data[key] = val;
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }

    delete(key) {
        delete this.data[key];
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }

    parseDataFile(filePath, defaults) {
        try {
            return JSON.parse(fs.readFileSync(filePath));
        } catch (error) {
            return defaults;
        }
    }
}

// --- TOKEN STORAGE (IN-MEMORY ONLY) ---
// User requested that login should NOT persist across app restarts for security.
// We use simple global variables so tokens are lost when the app closes.
const memoryStore = {
    google_access_token: null,
    google_refresh_token: null
};

// --- GOOGLE AUTH CONFIGURATION ---
// TODO: USER MUST FILL THIS SECRET FOR OFFLINE ACCESS TO WORK
const GOOGLE_CLIENT_ID = '145147670860-l0bu8h9lvmf1gjqd09q66g4jbb4i69q2.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = ''; // <--- PASTE YOUR CLIENT SECRET HERE

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'postmessage' // Special redirect URI for electron/receiving code from renderer
);

// Listen for auth code exchange
ipcMain.handle('auth-exchange-code', async (event, code) => {
    try {
        if (!GOOGLE_CLIENT_SECRET) {
            throw new Error('CLIENT_SECRET_MISSING');
        }
        console.log('Exchanging auth code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);

        // Save tokens in memory only
        if (tokens.refresh_token) {
            memoryStore.google_refresh_token = tokens.refresh_token;
            console.log('Refresh token saved (in-memory)');
        }

        if (tokens.access_token) {
            // Calculate expiry
            const expiryDate = tokens.expiry_date || (Date.now() + 3500 * 1000);
            memoryStore.google_access_token = {
                token: tokens.access_token,
                expiry: expiryDate
            };
            oauth2Client.setCredentials(tokens);
        }

        return { success: true, tokens };
    } catch (error) {
        console.error('Auth code exchange failed:', error);
        return { success: false, error: error.message };
    }
});

// Get valid access token (refresh if needed)
ipcMain.handle('auth-get-token', async () => {
    try {
        const storedAccess = memoryStore.google_access_token;
        const refreshToken = memoryStore.google_refresh_token;

        // Case 1: Valid access token exists
        if (storedAccess && storedAccess.token && storedAccess.expiry > Date.now() + 60000) {
            return { success: true, token: storedAccess.token };
        }

        // Case 2: No valid access token, but have refresh token
        if (refreshToken) {
            if (!GOOGLE_CLIENT_SECRET) {
                // Without secret, we can't refresh on backend usually, 
                // but if we used "Desktop" flow we might. Assuming Web flow here -> needs secret.
                return { success: false, error: 'CLIENT_SECRET_MISSING' };
            }

            console.log('Refreshing access token in background...');
            oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await oauth2Client.refreshAccessToken();

            // Save new access token
            const expiryDate = credentials.expiry_date || (Date.now() + 3500 * 1000);
            memoryStore.google_access_token = {
                token: credentials.access_token,
                expiry: expiryDate
            };

            // Update refresh token if returned (sometimes it rotates)
            if (credentials.refresh_token) {
                memoryStore.google_refresh_token = credentials.refresh_token;
            }

            return { success: true, token: credentials.access_token };
        }

        // Case 3: No tokens
        return { success: false, error: 'NO_TOKENS' };
    } catch (error) {
        console.error('Get token failed:', error);
        return { success: false, error: error.message };
    }
});

// Logout handler
ipcMain.handle('auth-logout', async () => {
    memoryStore.google_access_token = null;
    memoryStore.google_refresh_token = null;
    // Also revoke if possible, but optional
    return { success: true };
});


let mainWindow = null;
let localServer = null;

// Start local server for production to serve files via localhost
function startLocalServer() {
    return new Promise((resolve) => {
        const distPath = path.join(__dirname, '../dist');
        const port = 8080;

        localServer = http.createServer((req, res) => {
            let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);

            // Security: ensure file is within dist directory
            const resolvedPath = path.resolve(filePath);
            if (!resolvedPath.startsWith(path.resolve(distPath))) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not Found');
                    return;
                }

                // Set content type
                const ext = path.extname(filePath);
                const contentTypes = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.svg': 'image/svg+xml'
                };
                res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
                res.writeHead(200);
                res.end(data);
            });
        });

        localServer.listen(port, () => {
            console.log(`Local server started on http://localhost:${port}`);
            resolve();
        });
    });
}

function createWindow() {
    // 아이콘 경로 설정
    const iconPath = path.join(__dirname, '../icon/RB_icon.png');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // To allow loading local resources easily
        },
        frame: false, // Frameless window as requested
        transparent: true, // Allow transparent background
        backgroundColor: '#00000000', // Start with transparent background
        opacity: 1.0,
        icon: fs.existsSync(iconPath) ? iconPath : undefined, // Windows/Linux용 아이콘
        titleBarStyle: 'hidden' // Hide title bar but keep window controls on macOS (optional, but good practice)
    });

    // Remove default menu to prevent it from intercepting keyboard shortcuts
    Menu.setApplicationMenu(null);

    // Ensure keyboard events are not intercepted by Electron
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Let the renderer process handle keyboard shortcuts
        // Don't prevent default here, let it bubble to the renderer
    });

    // In development, load from the Vite dev server
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // In production, use localhost server instead of file://
        // This allows Firebase to recognize the domain
        mainWindow.loadURL('http://localhost:8080');
    }
}

// 1. Register Protocol
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('refboard', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('refboard');
}

// 2. Handle Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // Find the refboard:// URL
            const url = commandLine.find(arg => arg.startsWith('refboard://'));
            if (url) {
                console.log('Received deep link (second instance):', url);
                mainWindow.webContents.send('deep-link', url);
            }
        }
    });

    app.whenReady().then(async () => {
        // Start local server in production mode
        if (process.env.NODE_ENV !== 'development') {
            await startLocalServer();
        }
        createWindow();

        // Handle init deep link (Windows/Linux)
        // argv: [exe, script, url] or [exe, url] in prod
        // We look for refboard:// in arguments
        const url = process.argv.find(arg => arg.startsWith('refboard://'));
        if (url) {
            console.log('Received deep link (init):', url);
            // Wait a bit for window to be ready or send immediately if safe?
            // Best to wait for dom-ready which is handled by mainWindow.loadURL flow, 
            // but we can send it once window is ready.
            // We'll set a handler in createWindow logic or just send it here with a slight delay
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('deep-link', url);
                }
            }, 3000); // 3s delay to ensure app is loaded
        }


        // IPC handler for always-on-top toggle
        ipcMain.handle('toggle-always-on-top', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                const isAlwaysOnTop = win.isAlwaysOnTop();
                win.setAlwaysOnTop(!isAlwaysOnTop);
                return !isAlwaysOnTop;
            }
            return false;
        });

        // IPC handler for opacity control
        ipcMain.handle('set-opacity', (event, opacity) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                win.setOpacity(opacity);
            }
        });

        // IPC handler for opening external URLs (for ads)
        ipcMain.handle('open-external', (event, url) => {
            shell.openExternal(url);
        });

        // IPC handler for reading image from clipboard (for Windows Snipping Tool, etc.)
        ipcMain.handle('read-clipboard-image', (event) => {
            try {
                const image = clipboard.readImage();
                if (image && !image.isEmpty()) {
                    // Convert to PNG buffer
                    const pngBuffer = image.toPNG();
                    // Convert to base64
                    const base64 = pngBuffer.toString('base64');
                    return {
                        success: true,
                        data: `data:image/png;base64,${base64}`,
                        width: image.getSize().width,
                        height: image.getSize().height
                    };
                }
                return { success: false, error: 'No image in clipboard' };
            } catch (error) {
                console.error('Failed to read clipboard image:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for copying image to clipboard (robust handling for all sources)
        ipcMain.handle('copy-image-to-clipboard', async (event, url) => {
            try {
                if (!url) return { success: false, error: 'No URL provided' };

                let image;

                if (url.startsWith('data:')) {
                    // Handle data URL
                    image = nativeImage.createFromDataURL(url);
                } else {
                    // Handle remote URL (fetch buffer)
                    try {
                        // Use built-in fetch (Node 18+) or net module
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        image = nativeImage.createFromBuffer(buffer);
                    } catch (fetchErr) {
                        console.error('Failed to fetch image for clipboard:', fetchErr);
                        return { success: false, error: `Fetch failed: ${fetchErr.message}` };
                    }
                }

                if (image && !image.isEmpty()) {
                    clipboard.writeImage(image);
                    return { success: true };
                } else {
                    return { success: false, error: 'Image created was empty' };
                }
            } catch (error) {
                console.error('Clipboard copy error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handlers for window controls
        ipcMain.on('minimize-window', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                win.minimize();
            }
        });

        ipcMain.on('maximize-window', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
            }
        });

        ipcMain.on('close-window', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                win.close();
            }
        });

        // Store initial window position and mouse position when dragging starts
        let dragStartWindowPos = null;
        let dragStartMousePos = null;
        let dragStartWindowSize = null;

        // IPC handler for window movement start
        ipcMain.on('window-move-start', (event, { mouseX, mouseY }) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                const [x, y] = win.getPosition();
                const [width, height] = win.getSize();
                dragStartWindowPos = { x, y };
                dragStartWindowSize = { width, height };
                dragStartMousePos = { x: mouseX, y: mouseY };
            }
        });

        // IPC handler for window movement
        ipcMain.on('window-move', (event, { mouseX, mouseY }) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win && dragStartWindowPos && dragStartMousePos && dragStartWindowSize) {
                // Calculate movement delta from start position
                // mouseX/Y are viewport coordinates (relative to window), so delta is correct
                const dx = mouseX - dragStartMousePos.x;
                const dy = mouseY - dragStartMousePos.y;

                // Use setBounds with fixed size to ensure size never changes
                win.setBounds({
                    x: dragStartWindowPos.x + dx,
                    y: dragStartWindowPos.y + dy,
                    width: dragStartWindowSize.width,
                    height: dragStartWindowSize.height
                });
            }
        });

        // IPC handler for window movement end
        ipcMain.on('window-move-end', () => {
            dragStartWindowPos = null;
            dragStartMousePos = null;
            dragStartWindowSize = null;
        });

        // Store current file path
        let currentFilePath = null;

        // IPC handler for save file
        ipcMain.handle('save-file', async (event, data) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return { success: false };

            try {
                let filePath = currentFilePath;

                if (!filePath) {
                    // Show save dialog
                    const result = await dialog.showSaveDialog(win, {
                        title: 'Save Board',
                        defaultPath: 'board.refboard',
                        filters: [
                            { name: 'RefBoard Files', extensions: ['refboard'] },
                            { name: 'All Files', extensions: ['*'] }
                        ]
                    });

                    if (result.canceled) {
                        return { success: false, canceled: true };
                    }
                    filePath = result.filePath;
                }

                // Write file
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                currentFilePath = filePath;
                return { success: true, path: filePath };
            } catch (error) {
                console.error('Save error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for save file as
        ipcMain.handle('save-file-as', async (event, data) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return { success: false };

            try {
                const result = await dialog.showSaveDialog(win, {
                    title: 'Save Board As',
                    defaultPath: 'board.refboard',
                    filters: [
                        { name: 'RefBoard Files', extensions: ['refboard'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });

                if (result.canceled) {
                    return { success: false, canceled: true };
                }

                const filePath = result.filePath;
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                currentFilePath = filePath;
                return { success: true, path: filePath };
            } catch (error) {
                console.error('Save as error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for open file
        ipcMain.handle('open-file', async (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return { success: false };

            try {
                const result = await dialog.showOpenDialog(win, {
                    title: 'Open Board',
                    filters: [
                        { name: 'RefBoard Files', extensions: ['refboard'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    properties: ['openFile']
                });

                if (result.canceled) {
                    return { success: false, canceled: true };
                }

                const filePath = result.filePaths[0];
                const fileData = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(fileData);
                currentFilePath = filePath;
                return { success: true, data, path: filePath };
            } catch (error) {
                console.error('Open error:', error);
                return { success: false, error: error.message };
            }
        });

        // Store file watchers for PSD files
        const fileWatchers = new Map();
        // Store debounce timers for file change events
        const fileChangeTimers = new Map();
        // Store last modified times to detect actual changes
        const lastModifiedTimes = new Map();

        // IPC handler for saving PSD file to temp directory
        // This saves the file and returns the path, which will be used as the "original" path
        ipcMain.handle('save-psd-file', async (event, { fileData, fileName }) => {
            try {
                const os = require('os');
                const tempDir = path.join(os.tmpdir(), 'refboard-psd');
                // Ensure temp directory exists
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // Use a unique filename to avoid conflicts
                const timestamp = Date.now();
                const uniqueFileName = `${timestamp}-${fileName}`;
                const filePath = path.join(tempDir, uniqueFileName);

                // fileData is ArrayBuffer, convert to Buffer
                const buffer = Buffer.from(fileData);
                fs.writeFileSync(filePath, buffer);

                return { success: true, path: filePath };
            } catch (error) {
                console.error('Save PSD file error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for selecting Photoshop executable path
        ipcMain.handle('select-photoshop-path', async (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return { success: false, error: 'No window' };

            try {
                const result = await dialog.showOpenDialog(win, {
                    title: 'Select Photoshop Executable',
                    filters: [
                        { name: 'Executable', extensions: ['exe'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    properties: ['openFile']
                });

                if (result.canceled) {
                    return { success: false, canceled: true };
                }

                const selectedPath = result.filePaths[0];
                if (selectedPath && fs.existsSync(selectedPath)) {
                    // Save to store
                    try {
                        const store = new SimpleStore({ name: 'settings', defaults: {} });
                        store.set('photoshopPath', selectedPath);
                        return { success: true, path: selectedPath };
                    } catch (e) {
                        console.error('Failed to save Photoshop path:', e);
                        return { success: false, error: 'Failed to save settings' };
                    }
                }

                return { success: false, error: 'Invalid path' };
            } catch (error) {
                console.error('Select Photoshop path error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for setting Photoshop path manually
        ipcMain.handle('set-photoshop-path', async (event, filePath) => {
            try {
                if (!filePath) {
                    return { success: false, error: 'Path is required' };
                }
                if (!fs.existsSync(filePath)) {
                    return { success: false, error: 'File does not exist' };
                }
                const store = new SimpleStore({ name: 'settings', defaults: {} });
                store.set('photoshopPath', filePath);
                return { success: true };
            } catch (error) {
                console.error('Set Photoshop path error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for opening file in Photoshop
        ipcMain.handle('open-in-photoshop', async (event, filePathOrUrl) => {
            console.log('Open in Photoshop request:', filePathOrUrl);
            try {
                let filePath = filePathOrUrl;

                // 1. Handle file:// URLs
                if (filePathOrUrl.startsWith('file://')) {
                    try {
                        const { fileURLToPath } = require('url');
                        filePath = fileURLToPath(filePathOrUrl);
                        console.log('Converted file:// to local path:', filePath);
                    } catch (e) {
                        console.error('Failed to convert file URL to path:', e);
                    }
                }

                // 2. Handle data URLs
                if (filePathOrUrl.startsWith('data:')) {
                    console.log('Handling data URL...');
                    try {
                        const matches = filePathOrUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
                        if (!matches || matches.length !== 3) {
                            throw new Error('Invalid data URL format');
                        }
                        const ext = `.${matches[1]}`;
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, 'base64');

                        const os = require('os');
                        const tempDir = path.join(os.tmpdir(), 'refboard-photoshop');
                        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                        filePath = path.join(tempDir, `refboard-data-${Date.now()}${ext}`);
                        fs.writeFileSync(filePath, buffer);
                        console.log('Data URL saved to temp file:', filePath);
                    } catch (error) {
                        console.error('Failed to process data URL:', error);
                        return { success: false, error: 'Failed to process base64 image.' };
                    }
                }

                // 3. Handle http/https URLs (Google Drive / Remote)
                else if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
                    console.log('Downloading image from URL:', filePathOrUrl);

                    try {
                        const response = await fetch(filePathOrUrl);
                        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);

                        const urlObj = new URL(filePathOrUrl);
                        let ext = path.extname(urlObj.pathname) || '.jpg';
                        if (ext === '') {
                            const contentType = response.headers.get('content-type');
                            if (contentType?.includes('png')) ext = '.png';
                            else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) ext = '.jpg';
                        }

                        const os = require('os');
                        const tempDir = path.join(os.tmpdir(), 'refboard-photoshop');
                        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                        filePath = path.join(tempDir, `refboard-remote-${Date.now()}${ext}`);
                        fs.writeFileSync(filePath, buffer);
                        console.log('Image downloaded to:', filePath);
                    } catch (downloadError) {
                        console.error('Failed to download image:', downloadError);
                        return { success: false, error: `Failed to download image: ${downloadError.message}` };
                    }
                }

                // 4. Final path resolution for local files
                // Only resolve if it's not a URL and not a data URL
                if (!path.isAbsolute(filePath) &&
                    !filePath.startsWith('http') &&
                    !filePath.startsWith('data:') &&
                    !filePath.startsWith('blob:') &&
                    !filePath.startsWith('refboard:')) {
                    filePath = path.resolve(filePath);
                    console.log('Resolved relative path to:', filePath);
                }

                // Now open the local file in Photoshop
                const platform = process.platform;
                let photoshopPath = null;

                // First, check if user has set a custom path in settings
                let store = null;
                try {
                    store = new SimpleStore({ name: 'settings', defaults: {} });
                    const customPath = store.get('photoshopPath');
                    if (customPath && fs.existsSync(customPath)) {
                        photoshopPath = customPath;
                        console.log('Using custom Photoshop path from settings:', photoshopPath);
                    }
                } catch (e) {
                    console.log('Failed to load settings store:', e);
                }

                if (platform === 'win32') {
                    // Method 1: Try to find Photoshop from registry
                    try {
                        const { execSync } = require('child_process');
                        // Try to get Photoshop path from registry
                        const registryPaths = [
                            'HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop',
                            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Adobe\\Photoshop',
                            'HKEY_CURRENT_USER\\SOFTWARE\\Adobe\\Photoshop'
                        ];

                        for (const regPath of registryPaths) {
                            try {
                                // Get all Photoshop versions from registry
                                const versions = execSync(`reg query "${regPath}" /s /v ApplicationPath 2>nul`, { encoding: 'utf-8' });
                                if (versions) {
                                    // Parse registry output to find latest version
                                    const lines = versions.split('\n').filter(line => line.includes('ApplicationPath'));
                                    if (lines.length > 0) {
                                        // Get the last (most recent) version
                                        const lastLine = lines[lines.length - 1];
                                        const match = lastLine.match(/REG_SZ\s+(.+)/);
                                        if (match && match[1]) {
                                            const appPath = match[1].trim();
                                            const psExe = path.join(appPath, 'Photoshop.exe');
                                            if (fs.existsSync(psExe)) {
                                                photoshopPath = psExe;
                                                break;
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                // Registry path not found, continue
                            }
                        }
                    } catch (e) {
                        console.log('Failed to read from registry:', e);
                    }

                    // Method 2: Try common Photoshop installation paths
                    if (!photoshopPath) {
                        const possiblePaths = [
                            'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
                            'C:\\Program Files\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
                            'C:\\Program Files\\Adobe\\Adobe Photoshop 2022\\Photoshop.exe',
                            'C:\\Program Files\\Adobe\\Adobe Photoshop 2021\\Photoshop.exe',
                            'C:\\Program Files\\Adobe\\Adobe Photoshop 2020\\Photoshop.exe',
                            'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
                            'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
                            'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2022\\Photoshop.exe',
                            'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2021\\Photoshop.exe',
                        ];

                        for (const psPath of possiblePaths) {
                            if (fs.existsSync(psPath)) {
                                photoshopPath = psPath;
                                break;
                            }
                        }
                    }

                    // Method 3: Try to find Photoshop by searching Program Files
                    if (!photoshopPath) {
                        try {
                            const programFilesPaths = [
                                'C:\\Program Files\\Adobe',
                                'C:\\Program Files (x86)\\Adobe'
                            ];

                            for (const basePath of programFilesPaths) {
                                if (fs.existsSync(basePath)) {
                                    const dirs = fs.readdirSync(basePath);
                                    // Find directories matching "Adobe Photoshop*"
                                    const psDirs = dirs.filter(dir => dir.startsWith('Adobe Photoshop'));
                                    if (psDirs.length > 0) {
                                        // Use the latest version (highest number)
                                        psDirs.sort().reverse();
                                        const latestDir = psDirs[0];
                                        const psExe = path.join(basePath, latestDir, 'Photoshop.exe');
                                        if (fs.existsSync(psExe)) {
                                            photoshopPath = psExe;
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('Failed to search Program Files:', e);
                        }
                    }

                    if (photoshopPath && fs.existsSync(filePath)) {
                        console.log('Opening file in Photoshop:', photoshopPath, filePath);
                        const { exec } = require('child_process');

                        // Using exec with manual quoting is often more reliable for Photoshop on Windows
                        // Especially since we want to launch it and forget it
                        const command = `"${photoshopPath}" "${filePath}"`;
                        exec(command, (error) => {
                            if (error) {
                                console.error('Photoshop execution error:', error);
                            }
                        });
                        return { success: true };
                    } else if (photoshopPath && !fs.existsSync(filePath)) {
                        console.error('File does not exist for Photoshop opening:', filePath);
                        return { success: false, error: `File not found: ${filePath}` };
                    } else {
                        console.log('Photoshop not found, trying to open with default application');
                        // Try to use file association to open with Photoshop
                        // Check if file extension is associated with Photoshop
                        const fileExt = path.extname(filePath).toLowerCase();
                        if (fileExt === '.psd' || fileExt === '.jpg' || fileExt === '.png') {
                            // Try to open with default application
                            try {
                                await shell.openPath(filePath);
                                return { success: false, error: 'Photoshop not found. Opened with default application instead.' };
                            } catch (e) {
                                console.error('Failed to open file:', e);
                            }
                        }
                        return { success: false, error: 'Photoshop not found.' };
                    }
                } else if (platform === 'darwin') {
                    // macOS: use open command with Photoshop
                    const { exec } = require('child_process');
                    exec(`open -a "Adobe Photoshop" "${filePath}"`, (error) => {
                        if (error) {
                            console.error('Failed to open in Photoshop:', error);
                            shell.openPath(filePath);
                        }
                    });
                    return { success: true };
                } else {
                    // Linux: try default application
                    await shell.openPath(filePath);
                    return { success: false, error: 'Photoshop opening not supported on Linux. Opened with default application.' };
                }
            } catch (error) {
                console.error('Open in Photoshop error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for watching PSD file changes
        ipcMain.handle('watch-psd-file', async (event, filePath) => {
            try {
                // Stop existing watcher for this file if any
                if (fileWatchers.has(filePath)) {
                    const watcher = fileWatchers.get(filePath);
                    watcher.close();
                    fileWatchers.delete(filePath);
                }

                // Clear any existing debounce timer
                if (fileChangeTimers.has(filePath)) {
                    clearTimeout(fileChangeTimers.get(filePath));
                    fileChangeTimers.delete(filePath);
                }

                // Store initial modified time
                try {
                    const stats = fs.statSync(filePath);
                    lastModifiedTimes.set(filePath, stats.mtimeMs);
                } catch (err) {
                    console.warn('Could not get initial file stats:', err);
                }

                // Create new watcher
                const win = BrowserWindow.fromWebContents(event.sender);
                const watcher = fs.watch(filePath, (eventType) => {
                    if (eventType === 'change') {
                        // Clear existing timer
                        if (fileChangeTimers.has(filePath)) {
                            clearTimeout(fileChangeTimers.get(filePath));
                        }

                        // Set new timer to debounce rapid file changes
                        const timer = setTimeout(() => {
                            try {
                                // Check if file actually changed (compare modification time)
                                const stats = fs.statSync(filePath);
                                const lastModified = lastModifiedTimes.get(filePath) || 0;

                                if (stats.mtimeMs > lastModified) {
                                    // File actually changed, update last modified time
                                    lastModifiedTimes.set(filePath, stats.mtimeMs);

                                    // Notify renderer process
                                    if (win && !win.isDestroyed()) {
                                        win.webContents.send('psd-file-changed', { path: filePath });
                                        console.log('PSD file changed:', filePath);
                                    }
                                }
                            } catch (err) {
                                console.error('Error checking file stats:', err);
                                // Still notify even if we can't check stats
                                if (win && !win.isDestroyed()) {
                                    win.webContents.send('psd-file-changed', { path: filePath });
                                }
                            }

                            fileChangeTimers.delete(filePath);
                        }, 500); // 500ms debounce delay

                        fileChangeTimers.set(filePath, timer);
                    }
                });

                fileWatchers.set(filePath, watcher);
                console.log('Started watching PSD file:', filePath);
                return { success: true };
            } catch (error) {
                console.error('Watch PSD file error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for unwatching PSD file
        ipcMain.handle('unwatch-psd-file', async (event, filePath) => {
            try {
                if (fileWatchers.has(filePath)) {
                    const watcher = fileWatchers.get(filePath);
                    watcher.close();
                    fileWatchers.delete(filePath);
                }
                // Clear debounce timer
                if (fileChangeTimers.has(filePath)) {
                    clearTimeout(fileChangeTimers.get(filePath));
                    fileChangeTimers.delete(filePath);
                }
                // Clear last modified time
                lastModifiedTimes.delete(filePath);
                return { success: true };
            } catch (error) {
                console.error('Unwatch PSD file error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for reading PSD file
        ipcMain.handle('read-psd-file', async (event, filePath) => {
            try {
                const fileData = fs.readFileSync(filePath);
                // Convert Buffer to ArrayBuffer
                const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
                return { success: true, data: arrayBuffer };
            } catch (error) {
                console.error('Read PSD file error:', error);
                return { success: false, error: error.message };
            }
        });

        // IPC handler for checking PSD file modification time
        ipcMain.handle('check-psd-file-modified', async (event, filePath) => {
            try {
                if (!fs.existsSync(filePath)) {
                    return { success: false, error: 'File does not exist' };
                }
                const stats = fs.statSync(filePath);
                return {
                    success: true,
                    modifiedTime: stats.mtimeMs,
                    size: stats.size
                };
            } catch (error) {
                console.error('Check PSD file modified error:', error);
                return { success: false, error: error.message };
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('window-all-closed', () => {
        // Stop local server before quitting
        if (localServer) {
            localServer.close();
            localServer = null;
        }
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
