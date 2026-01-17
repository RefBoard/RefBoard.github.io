# Google Cloud Console Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **NEW PROJECT**
3. Project name: `RefBoard`
4. Click **CREATE**

## Step 2: Enable Required APIs

1. In the sidebar, go to **APIs & Services** → **Library**
2. Search and enable these APIs:
   - **Google Drive API**
   - **Google OAuth2 API** (should be enabled by default)

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. User Type: Select **External** → **CREATE**
3. Fill in:
   - App name: `RefBoard`
   - User support email: (your email)
   - Developer contact: (your email)
4. Click **SAVE AND CONTINUE**
5. Scopes: Click **ADD OR REMOVE SCOPES**
   - Add: `.../auth/drive.file` (Create, edit, and delete only the specific files this app uses)
   - Add: `.../auth/userinfo.email`
   - Add: `.../auth/userinfo.profile`
6. Click **UPDATE** → **SAVE AND CONTINUE**
7. Test users: Add your email → **ADD** → **SAVE AND CONTINUE**
8. Click **BACK TO DASHBOARD**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: `RefBoard Desktop`
5. Click **CREATE**
6. A popup will show:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`
7. **IMPORTANT**: Copy both values!

## Step 5: Add Credentials to RefBoard

Create a file: `d:/Scripts/RefBoard/.env`

```
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret_here
```

## Step 6: Firebase Setup (for real-time collaboration)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Select your existing **RefBoard** project
4. Enable Google Analytics (optional)
5. Go to **Build** → **Realtime Database**
6. Click **Create Database**
7. Start in **test mode** (we'll secure it later)
8. Go to **Project settings** (gear icon)
9. Scroll to **Your apps** → Click web icon `</>`
10. App nickname: `RefBoard`
11. Click **Register app**
12. Copy the `firebaseConfig` object

Create a file: `d:/Scripts/RefBoard/firebase-config.json`

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "databaseURL": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}
```

---

## ✅ You're ready!

Once you've completed these steps, RefBoard will be able to:
- Authenticate users with Google
- Store boards in Google Drive
- Enable real-time collaboration
