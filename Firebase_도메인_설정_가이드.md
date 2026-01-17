# Firebase 인증 도메인 설정 가이드

## 🔍 문제 원인

Electron 앱에서 로컬 파일(`file://` 프로토콜)을 사용할 때 Firebase가 이를 허용된 도메인으로 인식하지 못해 발생하는 에러입니다.

**에러 메시지:**
```
firebase:error auth/unauthorized-domain
```

---

## ✅ 해결 방법: Firebase 콘솔에서 도메인 추가

### 1단계: Firebase 콘솔 접속

1. 브라우저에서 다음 URL 접속:
   **https://console.firebase.google.com/**

2. **RefBoard 프로젝트 선택**
   - 프로젝트 목록에서 `refboard-21681` 클릭

### 2단계: Authentication 설정 열기

1. 왼쪽 메뉴에서 **Build** → **Authentication** 클릭
2. 상단 탭에서 **Settings** (설정) 클릭
3. 아래로 스크롤하여 **Authorized domains** (승인된 도메인) 섹션 찾기

### 3단계: 도메인 추가

**Authorized domains** 섹션에서:

1. **Add domain** (도메인 추가) 버튼 클릭
2. 다음 도메인들을 하나씩 추가:

   ```
   file://
   ```

   또는 더 구체적으로:

   ```
   file:///
   ```

3. **Add** 버튼 클릭

**참고:** `file://`은 모든 로컬 파일을 허용합니다. 보안상 문제가 될 수 있지만, Electron 데스크톱 앱에서는 필요합니다.

### 4단계: 저장

설정이 자동으로 저장됩니다. 페이지를 새로고침하여 도메인이 추가되었는지 확인하세요.

---

## 🔧 대안: 커스텀 프로토콜 사용 (고급)

더 안전한 방법은 커스텀 프로토콜을 사용하는 것입니다:

### 1. Electron에서 커스텀 프로토콜 등록

`electron/main.js`에 추가:

```javascript
const { protocol } = require('electron');

app.whenReady().then(() => {
    // 커스텀 프로토콜 등록
    protocol.registerFileProtocol('refboard', (request, callback) => {
        const url = request.url.substr(12); // 'refboard://' 제거
        callback({ path: path.normalize(`${__dirname}/../dist/${url}`) });
    });
    
    createWindow();
});
```

### 2. 로드 URL 변경

```javascript
// 프로덕션 모드
mainWindow.loadURL('refboard://index.html');
```

### 3. Firebase 콘솔에 추가

```
refboard://
```

이 방법은 더 안전하지만 설정이 복잡합니다. 간단한 해결책은 `file://`을 추가하는 것입니다.

---

## ✅ 확인 방법

도메인을 추가한 후:

1. **Electron 앱 재시작**
   - 앱을 완전히 종료하고 다시 실행

2. **로그인 시도**
   - Google 로그인 버튼 클릭
   - 에러가 사라졌는지 확인

3. **개발자 도구 확인**
   - `Ctrl + Shift + I` (Windows)
   - Console 탭에서 에러 확인

---

## 📝 추가 참고사항

### 현재 허용된 도메인 목록

일반적으로 다음 도메인들이 기본적으로 포함되어 있습니다:
- `localhost`
- `refboard-21681.firebaseapp.com`
- `refboard-21681.web.app`

### Electron 앱을 위한 권장 설정

Electron 앱의 경우 다음 도메인들을 추가하는 것이 좋습니다:
- `file://` (모든 로컬 파일)
- 또는 `refboard://` (커스텀 프로토콜 사용 시)

---

## 🆘 여전히 문제가 있다면

1. **브라우저 캐시 삭제**
   - Firebase 콘솔에서 설정이 반영되지 않을 수 있습니다

2. **앱 완전히 재시작**
   - 앱을 완전히 종료하고 다시 실행

3. **Firebase 프로젝트 확인**
   - 올바른 프로젝트(`refboard-21681`)에 설정했는지 확인

4. **에러 메시지 확인**
   - 정확한 에러 메시지를 확인하여 다른 문제인지 확인

---

## 🎉 완료!

도메인을 추가하면 Electron 앱에서 Firebase 인증이 정상적으로 작동합니다!




