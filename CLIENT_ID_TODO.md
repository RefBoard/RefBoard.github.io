# Google Client ID 확인 필요

`.env` 파일의 `GOOGLE_CLIENT_ID` 값을 확인해서 `LoginScreen.tsx` 28번 라인에 입력해주세요.

**현재 코드:**
```tsx
const clientId = '1052217843844-your_client_id_here.apps.googleusercontent.com';
```

**`.env` 파일에서:**
```
GOOGLE_CLIENT_ID=여기에_있는_값을_복사
```

**또는 Google Cloud Console에서:**
1. https://console.cloud.google.com/apis/credentials
2. "OAuth 2.0 클라이언트 ID" 섹션
3. "RefBoard Desktop" 클릭
4. 클라이언트 ID 복사

형식: `1052217843844-xxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

이 값을 LoginScreen.tsx 28번 라인에 붙여넣으면 됩니다!
