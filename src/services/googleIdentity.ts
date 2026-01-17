/**
 * Google Identity Services for Drive API access
 * This handles OAuth separately from Firebase Auth to get proper Drive permissions
 */

let codeClient: any = null;

// Ensure Electron API types are available
// electronAPI is declared in electron.d.ts

// Initialize Google Identity Services

/**
 * Initialize Google Identity Services
 */
export function initGoogleIdentityServices() {
    // Load the GIS script
    if (!document.getElementById('gis-script')) {
        const script = document.createElement('script');
        script.id = 'gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
}

/**
 * Request Drive API access via Offline Access (Code Flow)
 */
export async function requestDriveAccess(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const checkGIS = setInterval(() => {
            if ((window as any).google?.accounts?.oauth2) {
                clearInterval(checkGIS);

                // Scenario A: Electron Environment (Offline Access / Refresh Tokens)
                if (window.electronAPI) {
                    codeClient = (window as any).google.accounts.oauth2.initCodeClient({
                        client_id: clientId,
                        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/cloud-platform',
                        ux_mode: 'popup',
                        callback: async (response: any) => {
                            if (response.error) {
                                console.error('GIS auth error:', response);
                                reject(new Error(response.error));
                                return;
                            }

                            if (response.code) {
                                console.log('Got auth code, exchanging via Electron...');
                                try {
                                    const result = await window.electronAPI!.exchangeGoogleAuthCode(response.code);
                                    if (result.success && result.tokens?.access_token) {
                                        const token = result.tokens.access_token;
                                        sessionStorage.setItem('google_access_token', token);
                                        console.log('✅ Offline Access setup complete. Token cached (session).');
                                        resolve(token);
                                    } else {
                                        console.error('Token exchange failed:', result.error);
                                        reject(new Error(result.error || 'Exchange failed'));
                                    }
                                } catch (err) {
                                    console.error('Electron IPC error:', err);
                                    reject(err);
                                }
                            }
                        },
                    });
                    codeClient.requestCode();
                }
                // Scenario B: Web Environment (Implicit Flow / Short-lived Tokens)
                else {
                    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/cloud-platform',
                        callback: (response: any) => {
                            if (response.error) {
                                console.error('GIS auth error (Web):', response);
                                reject(new Error(response.error));
                                return;
                            }

                            if (response.access_token) {
                                sessionStorage.setItem('google_access_token', response.access_token);
                                console.log('✅ Web Access setup complete. Token cached (session).');
                                resolve(response.access_token);
                            }
                        },
                    });
                    // Request token (interactive)
                    tokenClient.requestAccessToken();
                }
            }
        }, 100);

        // Timeout
        setTimeout(() => {
            clearInterval(checkGIS);
            reject(new Error('GIS init timeout'));
        }, 10000);
    });
}

/**
 * Check if we have a valid Drive access token
 */
export function hasDriveAccess(): boolean {
    return !!sessionStorage.getItem('google_access_token');
}

/**
 * Get the stored access token
 */
export function getDriveAccessToken(): string | null {
    return sessionStorage.getItem('google_access_token');
}

/**
 * Refresh the access token
 * - Electron: Uses stored Refresh Token
 * - Web: Triggers silent implicit flow (or prompts if needed)
 */
export async function refreshDriveAccessToken(clientId: string, allowPrompt: boolean = false): Promise<boolean> {
    // Scenario A: Electron
    if (window.electronAPI) {
        try {
            console.log('Requesting fresh token from Electron...');
            const result = await window.electronAPI.getGoogleAccessToken();

            if (result.success && result.token) {
                sessionStorage.setItem('google_access_token', result.token);
                console.log('✅ Token refreshed via Electron');
                return true;
            } else {
                console.warn('Background refresh failed:', result.error);
                if (allowPrompt) {
                    console.log('Attempting interactive re-login...');
                    try {
                        await requestDriveAccess(clientId);
                        return true;
                    } catch (err) {
                        return false;
                    }
                }
                return false;
            }
        } catch (error) {
            console.error('Electron refresh error:', error);
            return false;
        }
    }
    // Scenario B: Web
    else {
        // For Web, "refresh" essentially means asking for a new token again.
        // initTokenClient doesn't have "refresh_token".
        // We can try to requestAccessToken({ prompt: 'none' }) if we want silent, 
        // but initTokenClient instance creation is needed.
        // For simplicity reusing requestDriveAccess logic or just re-requesting.
        // If allowPrompt is false, we can't really do much in purely client-side without iframe tricks, 
        // unless GIS supports it. GIS initTokenClient always opens popup unless hinted otherwise?
        // Actually GIS implicit flow does not support silent refresh easily without user interaction or 'hint'.

        if (allowPrompt) {
            try {
                await requestDriveAccess(clientId);
                return true;
            } catch (err) {
                return false;
            }
        }
        return false;
    }
}
