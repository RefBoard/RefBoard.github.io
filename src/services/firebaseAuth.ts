import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, onIdTokenChanged, User, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
export const FIREBASE_API_KEY = "AIzaSyD-CUcGgOEmiKVqhsMGNi3nw0hPFKP5QSs";
const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: "refboard-21681.firebaseapp.com",
    projectId: "refboard-21681",
    storageBucket: "refboard-21681.firebasestorage.app",
    messagingSenderId: "1052217843844",
    appId: "1:1052217843844:web:d13c695547c279d832e2d1",
    measurementId: "G-LSVG7VY51R",
    databaseURL: "https://refboard-21681-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set persistence to SESSION (clears on window close)
// This is critical for the "logout on restart" requirement
setPersistence(auth, browserSessionPersistence)
    .then(() => {
        console.log('Firebase persistence set to SESSION');
    })
    .catch((error) => {
        console.error('Failed to set persistence:', error);
    });

// Explicitly pass the database URL to avoid any config merging issues
const database = getDatabase(app, "https://refboard-21681-default-rtdb.firebaseio.com");
const googleProvider = new GoogleAuthProvider();

// Request additional OAuth scopes for Drive access
googleProvider.setCustomParameters({
    prompt: 'select_account consent',
    access_type: 'offline'
});

// Use full Drive scope (includes read/write for all files including shared)
googleProvider.addScope('https://www.googleapis.com/auth/drive');

export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Get OAuth credential for Drive API access
        // Note: credential is available but not used - Drive API uses Google Identity Services instead
        // REMOVED: Do not store Firebase-derived access token for Drive API.
        GoogleAuthProvider.credentialFromResult(result);
        // It belongs to the Firebase project (which usually lacks Drive API access)
        // and conflicts with the standalone Drive OAuth flow.
        // if (accessToken) {
        //    localStorage.setItem('google_access_token', accessToken);
        // }

        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
            },
        };
    } catch (error: any) {
        console.error('Sign in error:', error);
        return {
            success: false,
            error: error.message || 'Failed to sign in',
        };
    }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
    try {
        await firebaseSignOut(auth);
        localStorage.removeItem('google_access_token');
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
    return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            callback({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
            });
        } else {
            callback(null);
        }
    });
}

/**
 * Get Firebase database instance
 */
export function getFirebaseDatabase() {
    return database;
}

/**
 * Get Firebase auth instance
 */
export function getFirebaseAuth() {
    return auth;
}

/**
 * Refresh the authentication token
 * This should be called periodically to keep the user logged in
 */
export async function refreshAuthToken(): Promise<boolean> {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            return false;
        }

        // Force refresh the token
        await currentUser.getIdToken(true);
        console.log('Firebase token refreshed successfully');
        return true;
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}

/**
 * Listen to token changes and automatically refresh
 * This ensures tokens are refreshed before expiration
 */
export function onTokenChange(callback: (token: string | null) => void): () => void {
    return onIdTokenChanged(auth, async (user) => {
        if (user) {
            try {
                // Get fresh token
                const token = await user.getIdToken(true);
                callback(token);
            } catch (error) {
                console.error('Error getting token:', error);
                callback(null);
            }
        } else {
            callback(null);
        }
    });
}
